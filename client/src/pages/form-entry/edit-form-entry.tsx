import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/page-header";
import TextField from "@/components/textfield";
import Button from "@/components/button";
import { LuFileText, LuCalendarX, LuEye } from "react-icons/lu";
import { apiGet, apiPut, apiPost } from "@/services/api";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getAuth } from "@/context/AuthContext";

type Question = {
  form_question_id?: number;
  form_section_id?: number;
  text: string;
  type: string;
  required: boolean;
  choices: string[];
  subQuestions: Question[];
};

type Section = {
  form_section_id?: number;
  title: string;
  description: string;
  questions: Question[];
};

type FormEntry = {
  id: number;
  user_id: number;
  form_id: number;
  form_entry_site: string;
  form_entry_area: string;
  form_entry_date: string;
  form_entry_archivestatus: number;
  form_entry_status: string;
  form_entry_return_count?: number; // ✅ NEW
  form_entry_returner_datetime?: string | null;
  form_entry_returner_remarks?: string | null;
  returner?: {
    id: number;
    user_firstname: string;
    user_lastname: string;
  } | null;
  Form?: {
    form_name: string;
  };
};

type Answer = {
  form_question_id: number;
  form_section_id: number;
  form_value: string;
  remarks: string;
  action_item: string;
};

type FormApprovalResponse = {
  user: {
    id: number;
    name: string;
    roles: string[];
  };
  forms: Array<{
    form_id: number;
    form_name: string;
    form_description: string;
    assignments: {
      first: boolean;
      second: boolean;
      third: boolean;
    };
  }>;
};

type TimelineEvent = {
  action: string;
  actionLabel: string;
  user: {
    id: number;
    name: string;
    email: string;
  } | null;
  datetime: string;
  remarks: string | null;
};

type ApprovalHistoryResponse = {
  formEntry: {
    id: number;
    form_name: string;
    status: string;
    site: string;
    area: string;
    date: string;
    returnCount?: number; // ✅ NEW
  };
  timeline: TimelineEvent[];
};

export default function EditFormEntry() {
  const navigate = useNavigate();
  const { entryId } = useParams<{ entryId: string }>();
  const { user } = getAuth();
  const queryClient = useQueryClient();

  const [formDetails, setFormDetails] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [meta, setMeta] = useState({
    site: "",
    area: "",
    date: "",
  });
  const [canUserApprove, setCanUserApprove] = useState(false);
  const [approvalRemarks, setApprovalRemarks] = useState("");
  const [rejectionRemarks, setRejectionRemarks] = useState("");
  const [returnRemarks, setReturnRemarks] = useState(""); // ✅ NEW: Return remarks state

  // ✅ Check user roles using array
  const userGroups = Array.isArray(user?.user_groups) ? user.user_groups : [];
  const isRequestor =
    userGroups.includes("requestor") ||
    userGroups.includes("all_access") ||
    userGroups.includes("qfd_admin");
  const isApprover =
    userGroups.includes("approver") ||
    userGroups.includes("all_access") ||
    userGroups.includes("qfd_admin");

  // Access control
  useEffect(() => {
    if (user && !isRequestor && !isApprover) {
      toast.error("Access Denied", {
        description: "You don't have permission to view this form entry.",
      });
      navigate("/form-entry");
    }
  }, [user, navigate, isRequestor, isApprover]);

  /* ===================== FETCH FORM ENTRY ===================== */
  const { data: formEntry, isLoading } = useQuery<FormEntry>({
    queryKey: ["form-entry", entryId],
    queryFn: async () => apiGet(`/form-entries/get/${entryId}`),
    enabled: !!entryId,
  });

  /* ===================== FETCH APPROVAL HISTORY ===================== */
  const { data: approvalHistory, isLoading: isLoadingHistory } =
    useQuery<ApprovalHistoryResponse>({
      queryKey: ["approval-history", entryId],
      queryFn: async () => apiGet(`/form-entries/${entryId}/approval-history`),
      enabled: !!entryId,
    });

  /* ===================== CHECK IF USER CAN APPROVE ===================== */
  useEffect(() => {
    if (!formEntry || !user || !isApprover) {
      setCanUserApprove(false);
      return;
    }

    const checkApprovalPermission = async () => {
      try {
        const currentStatus = formEntry.form_entry_status;
        if (currentStatus === "completed" || currentStatus === "rejected") {
          setCanUserApprove(false);
          return;
        }
        let requiredLevel: "first" | "second" | "third" | null = null;

        if (currentStatus === "submitted_first") {
          requiredLevel = "first";
        } else if (
          currentStatus === "approved_first" ||
          currentStatus === "submitted_second"
        ) {
          requiredLevel = "second";
        } else if (
          currentStatus === "approved_second" ||
          currentStatus === "submitted_third"
        ) {
          requiredLevel = "third";
        }

        if (!requiredLevel) {
          setCanUserApprove(false);
          return;
        }

        // ✅ all_access (IT/super admin) and qfd_admin can approve any form
        // at any level, without needing an explicit FormApprovers assignment.
        if (userGroups.includes("all_access") || userGroups.includes("qfd_admin")) {
          setCanUserApprove(true);
          return;
        }

        const response = await apiGet<FormApprovalResponse>(
          `/form-approvers/user/${user.id}`,
        );

        if (response?.forms) {
          const thisForm = response.forms.find(
            (f) => f.form_id === formEntry.form_id,
          );

          if (thisForm) {
            const assignments = thisForm.assignments;
            const canApprove =
              (requiredLevel === "first" && assignments.first) ||
              (requiredLevel === "second" && assignments.second) ||
              (requiredLevel === "third" && assignments.third);

            setCanUserApprove(canApprove);
          } else {
            setCanUserApprove(false);
          }
        } else {
          setCanUserApprove(false);
        }
      } catch (error) {
        console.error("Error checking approval permission:", error);
        setCanUserApprove(false);
      }
    };

    checkApprovalPermission();
  }, [formEntry, user, isApprover]);

  /* ===================== FETCH FORM STRUCTURE ===================== */
  useEffect(() => {
    if (!formEntry?.form_id) return;

    const fetchForm = async () => {
      const res = await apiGet<any>(`/forms/get/${formEntry.form_id}`);

      const sections =
        res.sections?.map((section: any) => ({
          form_section_id: section.form_section_id,
          title: section.form_section_name,
          description: section.form_section_description,
          questions:
            section.questions?.map((q: any) => ({
              form_section_id: section.form_section_id,
              form_question_id: q.id,
              text: q.form_questions,
              type: q.question_type,
              required: q.required,
              choices: q.choices || [],
              subQuestions:
                q.subQuestions?.map((subQ: any) => ({
                  form_section_id: section.form_section_id,
                  form_question_id: subQ.sub_question_id, //  FIX #1
                  text:
                    subQ.sub_question_text ||
                    subQ.sub_questions ||
                    subQ.text ||
                    "",
                  type: subQ.question_type,
                  required: subQ.required,
                  choices: subQ.choices || [],
                  subQuestions: [],
                })) || [],
            })) ?? [],
        })) ?? [];

      setFormDetails({ ...res, sections });
    };

    fetchForm();
  }, [formEntry?.form_id]);

  /* ===================== FETCH ANSWERS ===================== */
  useEffect(() => {
    if (!entryId || !formEntry) return;

    setMeta({
      site: formEntry.form_entry_site ?? "",
      area: formEntry.form_entry_area ?? "",
      date: formEntry.form_entry_date
        ? formEntry.form_entry_date.split("T")[0]
        : "",
    });

    const fetchAnswers = async () => {
      try {
        const res = await apiGet<any>(`/form-entries/entry/${entryId}`);

        if (Array.isArray(res)) {
          const answersMap: Record<string, any> = {};

          res.forEach((answer: any) => {
            // Map main question — prefix with "main" to avoid collisions with sub-question IDs
            const key = `main-${String(answer.form_section_id)}-${String(answer.form_question_id)}`;
            answersMap[key] = {
              form_question_id: answer.form_question_id,
              form_section_id: answer.form_section_id,
              form_value: answer.form_value || "",
              remarks: answer.remarks || "",
              action_item: answer.action_item || "",
              is_sub: false,
              parent_question_id: null,
            };

            if (Array.isArray(answer.FormQuestionSubValues)) {
              answer.FormQuestionSubValues.forEach((sub: any) => {
                const subQuestionId = sub.sub_question_id;
                const sectionId = answer.form_section_id;
                // prefix with "sub" to avoid collisions with main question IDs
                const subKey = `sub-${String(sectionId)}-${String(subQuestionId)}`;

                answersMap[subKey] = {
                  form_question_id: subQuestionId,
                  form_section_id: sectionId,
                  form_value: sub.form_sub_value || "",
                  remarks: sub.remarks || "",
                  action_item: sub.action_item || "",
                  is_sub: true,
                  parent_question_id: answer.form_question_id,
                };
              });
            }
          });

          setAnswers(answersMap);
        }
      } catch (error) {
        console.error("Error fetching answers:", error);
        toast.error("Failed to load form answers");
      }
    };

    fetchAnswers();
  }, [entryId, formEntry]);

  /* ===================== MUTATIONS ===================== */
  const { mutate: updateEntry, isPending: isUpdating } = useMutation({
    mutationFn: (payload: any) =>
      apiPut(`/form-entries/update-builder/${entryId}`, payload),
    onSuccess: (_, vars) => {
      toast.success(
        vars.form_entry_status === "draft"
          ? "Draft saved successfully"
          : "Form updated successfully",
      );
      queryClient.invalidateQueries({ queryKey: ["form-entry", entryId] });
      queryClient.invalidateQueries({ queryKey: ["formEntries"] });
      navigate("/form-entry");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to update form entry");
    },
  });

  const { mutate: submitForApproval, isPending: isSubmitting } = useMutation({
    mutationFn: (payload: any) =>
      apiPost("/form-entries/submit-approval", payload),
    onSuccess: () => {
      toast.success("Form submitted for approval successfully");
      queryClient.invalidateQueries({ queryKey: ["form-entry", entryId] });
      queryClient.invalidateQueries({ queryKey: ["formEntries"] });
      navigate("/form-entry");
    },
    onError: (err: any) => {
      console.error("Submit for approval error:", err);
      toast.error("Failed to submit for approval", {
        description:
          err?.response?.data?.message ||
          err?.message ||
          "Something went wrong",
      });
    },
  });

  // ✅ Merges "Save + move to pending" and "Submit for approval" into one
  // action so a fresh draft goes straight to the first approver.
  const { mutate: submitDraftForApproval, isPending: isSubmittingDraft } =
    useMutation({
      mutationFn: async (payload: any) => {
        await apiPut(`/form-entries/update-builder/${entryId}`, payload);
        return apiPost("/form-entries/submit-approval", {
          form_entry_id: payload.form_entry_id,
          user_id: payload.user_id,
        });
      },
      onSuccess: () => {
        toast.success("Form submitted for approval successfully");
        queryClient.invalidateQueries({ queryKey: ["form-entry", entryId] });
        queryClient.invalidateQueries({ queryKey: ["formEntries"] });
        navigate("/form-entry");
      },
      onError: (err: any) => {
        console.error("Submit draft for approval error:", err);
        toast.error("Failed to submit for approval", {
          description:
            err?.response?.data?.message ||
            err?.message ||
            "Your answers were saved — please try submitting again.",
        });
      },
    });

  const { mutate: approveOrReject, isPending: isApproving } = useMutation({
    mutationFn: (payload: any) => apiPost("/form-entries/approve", payload),
    onSuccess: (_, vars) => {
      toast.success(
        vars.action === "approve"
          ? "Form approved successfully"
          : "Form rejected successfully",
      );
      queryClient.invalidateQueries({ queryKey: ["form-entry", entryId] });
      queryClient.invalidateQueries({ queryKey: ["formEntries"] });
      queryClient.invalidateQueries({ queryKey: ["approval-history", entryId] });
      navigate("/form-entry");
    },
    onError: (err: any) => {
      console.error("Approval error:", err);
      toast.error("Failed to process approval", {
        description:
          err?.response?.data?.message ||
          err?.message ||
          "Something went wrong",
      });
    },
  });

  // ✅ NEW: Return mutation
  const { mutate: returnForm, isPending: isReturning } = useMutation({
    mutationFn: (payload: any) => apiPost("/form-entries/return", payload),
    onSuccess: () => {
      toast.success("Form returned successfully", {
        description: "The requestor can now edit and resubmit the form.",
      });
      queryClient.invalidateQueries({ queryKey: ["form-entry", entryId] });
      queryClient.invalidateQueries({ queryKey: ["formEntries"] });
      queryClient.invalidateQueries({ queryKey: ["approval-history", entryId] });
      navigate("/form-entry");
    },
    onError: (err: any) => {
      console.error("Return error:", err);
      toast.error("Failed to return form", {
        description:
          err?.response?.data?.message ||
          err?.message ||
          "Something went wrong",
      });
    },
  });

  /* ===================== HELPERS ===================== */
  const makeKey = (q: Question, sIdx: number, qIdx: number, isSub = false) =>
    `${isSub ? "sub" : "main"}-${String(q.form_section_id ?? sIdx)}-${String(q.form_question_id ?? qIdx)}`;

  const updateAnswer = (
    key: string,
    q: Question,
    field: string,
    value: string,
    parentQuestionId?: number,
  ) => {
    setAnswers((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {
          form_question_id: q.form_question_id!,
          sub_question_id:
            parentQuestionId !== undefined ? q.form_question_id! : undefined,
          form_section_id: q.form_section_id!,
          is_sub: parentQuestionId !== undefined,
          parent_question_id: parentQuestionId ?? null,
        }),
        [field]: value,
      },
    }));
  };

  const buildResponses = () => {
    const allAnswers = Object.values(answers);
    const mainAnswers = allAnswers.filter((a: any) => !a.is_sub);
    const subAnswers = allAnswers.filter((a: any) => a.is_sub);

    return mainAnswers.map((a: any) => ({
      form_question_id: a.form_question_id,
      form_value: a.form_value || "",
      remarks: a.remarks || "",
      action_item: a.action_item || "",
      sub_values: subAnswers
        .filter((s: any) => s.parent_question_id === a.form_question_id)
        .map((s: any) => ({
          sub_question_id: s.sub_question_id ?? s.form_question_id,
          form_sub_value: s.form_value || "",
          remarks: s.remarks || "",
          action_item: s.action_item || "",
        })),
    }));
  };

  const getMissingRequiredAnswers = (responses: ReturnType<typeof buildResponses>) => {
    const responseByQuestion = new Map(
      responses.map((r: any) => [r.form_question_id, r]),
    );
    const subValueBySubQuestion = new Map();
    for (const r of responses as any[]) {
      for (const sv of r.sub_values || []) {
        subValueBySubQuestion.set(sv.sub_question_id, sv);
      }
    }

    const missing: string[] = [];
    for (const section of formDetails?.sections || []) {
      for (const q of section.questions || []) {
        if (q.required) {
          const r: any = responseByQuestion.get(Number(q.form_question_id));
          if (!r || !String(r.form_value ?? "").trim()) {
            missing.push(q.text);
          }
        }
        for (const subQ of q.subQuestions || []) {
          if (subQ.required) {
            const sv: any = subValueBySubQuestion.get(
              Number(subQ.form_question_id),
            );
            if (!sv || !String(sv.form_sub_value ?? "").trim()) {
              missing.push(subQ.text);
            }
          }
        }
      }
    }
    return missing;
  };

  const handleUpdate = (status: "draft" | "pending" | "returned") => {
    if (!user) return toast.error("User not logged in");
    updateEntry({
      form_entry_id: Number(entryId),
      user_id: user.id,
      form_id: formEntry?.form_id,
      form_entry_site: meta.site || null,
      form_entry_area: meta.area || null,
      form_entry_date: meta.date || null,
      form_entry_archivestatus: 0,
      form_entry_status: status,
      responses: buildResponses(),
    });
  };

  const handleSubmitForApproval = () => {
    if (!user) return toast.error("User not logged in");
    submitForApproval({ form_entry_id: Number(entryId), user_id: user.id });
  };

  const handleSubmitDraftForApproval = () => {
    if (!user) return toast.error("User not logged in");
    const responses = buildResponses();

    const missing = getMissingRequiredAnswers(responses);
    if (missing.length > 0) {
      toast.warning("Missing required answers", {
        description: `Please answer: ${missing.join(", ")}`,
      });
      return;
    }

    submitDraftForApproval({
      form_entry_id: Number(entryId),
      user_id: user.id,
      form_id: formEntry?.form_id,
      form_entry_site: meta.site || null,
      form_entry_area: meta.area || null,
      form_entry_date: meta.date || null,
      form_entry_archivestatus: 0,
      form_entry_status: "pending",
      responses,
    });
  };

  const handleApproveOrReject = (action: "approve" | "reject") => {
    if (!user) return toast.error("User not logged in");
    const remarks = action === "approve" ? approvalRemarks : rejectionRemarks;
    approveOrReject({
      form_entry_id: Number(entryId),
      approver_id: user.id,
      action,
      remarks: remarks || "",
    });
  };

  const handleReturn = () => {
    if (!user) return toast.error("User not logged in");
    returnForm({
      form_entry_id: Number(entryId),
      returner_id: user.id,
      remarks: returnRemarks || "",
    });
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "submitted":
        return "📤";
      case "resubmitted":
        return "🔄";
      case "approved_first":
      case "approved_second":
      case "approved_third":
        return "✓";
      case "rejected":
        return "✗";
      case "returned":
        return "🔄";
      case "completed":
        return "🎉";
      default:
        return "●";
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "submitted":
      case "resubmitted":
        return "text-blue-600";
      case "approved_first":
      case "approved_second":
      case "approved_third":
      case "completed":
        return "text-green-600";
      case "rejected":
        return "text-red-600";
      case "returned":
        return "text-orange-600";
      default:
        return "text-gray-600";
    }
  };

  const formatDateTime = (datetime: string) => {
    return new Date(datetime).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const currentStatus = formEntry?.form_entry_status || "draft";
  const isDraft = currentStatus === "draft";
  const isPending = currentStatus === "pending";
  const isReturned = currentStatus === "returned";
  const isSubmittedFirst = currentStatus === "submitted_first";
  const isApprovedFirst = currentStatus === "approved_first";
  const isSubmittedSecond = currentStatus === "submitted_second";
  const isApprovedSecond = currentStatus === "approved_second";
  const isSubmittedThird = currentStatus === "submitted_third";
  const isCompleted = currentStatus === "completed";
  const isRejected = currentStatus === "rejected";

  // ✅ Users with a dual role (e.g. all_access/qfd_admin) are also
  // "isApprover" even when editing their own draft — only lock fields for
  // approvers reviewing someone else's entry, not the entry's own owner.
  const isOwner = formEntry?.user_id === user?.id;
  const fieldsDisabled =
    (isApprover && !isOwner) || (!isDraft && !isPending && !isReturned);
  const isPendingAction =
    isUpdating ||
    isSubmitting ||
    isSubmittingDraft ||
    isApproving ||
    isReturning;
  const pageTitle =
    isApprover && !isOwner ? "Review Form Entry" : "Edit Form Entry";

  const getStatusBadge = () => {
    const statusMap: Record<string, { text: string; className: string }> = {
      draft: { text: "Draft", className: "bg-gray-100 text-gray-700" },
      pending: {
        text: "Pending Submission",
        className: "bg-yellow-100 text-yellow-700",
      },
      returned: {
        text: "Returned for Correction",
        className: "bg-orange-100 text-orange-700",
      },
      submitted_first: {
        text: "Awaiting 1st Approval",
        className: "bg-blue-100 text-blue-700",
      },
      approved_first: {
        text: "Awaiting 2nd Approval",
        className: "bg-blue-100 text-blue-700",
      },
      submitted_second: {
        text: "Awaiting 2nd Approval",
        className: "bg-blue-100 text-blue-700",
      },
      approved_second: {
        text: "Awaiting 3rd Approval",
        className: "bg-blue-100 text-blue-700",
      },
      submitted_third: {
        text: "Awaiting 3rd Approval",
        className: "bg-blue-100 text-blue-700",
      },
      completed: { text: "Completed ✓", className: "bg-green-600 text-white" },
      rejected: { text: "Rejected ✗", className: "bg-red-600 text-white" },
    };

    const status = statusMap[currentStatus] || statusMap.draft;
    const returnCount = formEntry?.form_entry_return_count || 0;

    return (
      <span
        className={`px-3 py-1 rounded-full text-sm font-medium ${status.className}`}
      >
        {status.text}
        {returnCount > 0 && (
          <span className="ml-2 text-xs">(Returned {returnCount}x)</span>
        )}
      </span>
    );
  };

  if (isLoading) return null;

  return (
    <div className="mx-6 mt-5">
      <PageHeader
        icon={<LuFileText className="text-2xl text-font-main" />}
        title={pageTitle}
        buttonText="Go Back"
        onButtonClick={() => navigate("/form-entry")}
        variant="default"
      />

      <div className="bg-white shadow-md p-4 rounded mt-1">
        {/* STATUS BADGE */}
        <div className="mb-4">{getStatusBadge()}</div>

        {/* RETURN REASON BANNER */}
        {isReturned && (
          <div className="mb-4 rounded-md border border-orange-200 bg-orange-50 p-4">
            <p className="text-sm font-medium text-orange-800">
              This form was returned
              {formEntry?.returner
                ? ` by ${formEntry.returner.user_firstname} ${formEntry.returner.user_lastname}`
                : ""}
              {formEntry?.form_entry_returner_datetime
                ? ` on ${new Date(
                    formEntry.form_entry_returner_datetime,
                  ).toLocaleDateString()}`
                : ""}
              .
            </p>
            {formEntry?.form_entry_returner_remarks && (
              <p className="text-sm text-orange-700 mt-1">
                Remarks: {formEntry.form_entry_returner_remarks}
              </p>
            )}
            <p className="text-sm text-orange-700 mt-1">
              Please make the necessary corrections and resubmit.
            </p>
          </div>
        )}

        {/* META */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <Label>Form Type</Label>
            <TextField
              value={formEntry?.Form?.form_name || ""}
              disabled
              variant="textFieldMain"
            />
          </div>

          <div>
            <Label>Site</Label>
            <Select
              value={meta.site}
              onValueChange={(v) => setMeta((p) => ({ ...p, site: v }))}
              disabled={fieldsDisabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Site" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Taytay">Taytay</SelectItem>
                <SelectItem value="Cabuyao">Cabuyao</SelectItem>
                <SelectItem value="Plaridel">Plaridel</SelectItem>
                <SelectItem value="Marilao">Marilao</SelectItem>
                <SelectItem value="Villasis">Villasis</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Area</Label>
            <Select
              value={meta.area}
              onValueChange={(v) => setMeta((p) => ({ ...p, area: v }))}
              disabled={fieldsDisabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Area" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Main">Main</SelectItem>
                <SelectItem value="Annex">Annex</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <TextField
            label="Date"
            type="date"
            value={meta.date}
            onChange={(e) => setMeta((p) => ({ ...p, date: e.target.value }))}
            variant="textFieldMain"
            disabled={fieldsDisabled}
          />
        </div>

        {/* QUESTIONS */}
        <div className="mt-6">
          {!formDetails ? (
            <div className="flex justify-center items-center h-64 border-dashed border-2">
              <LuCalendarX className="text-4xl text-gray-400" />
            </div>
          ) : (
            formDetails.sections.map((section: Section, sIdx: number) => (
              <div key={sIdx} className="mt-4 p-6 shadow rounded space-y-4">
                <h2 className="text-xl font-semibold">{section.title}</h2>
                <p>{section.description}</p>

                {section.questions.map((q, qIdx) => {
                  const key = makeKey(q, sIdx, qIdx);
                  const ans = answers[key] || {};

                  return (
                    <div key={key} className="border-b pb-4">
                      <label className="font-medium">
                        {q.text}
                        {q.required && <span className="text-red-500"> *</span>}
                      </label>

                      {/* TEXT / PARAGRAPH */}
                      {(q.type === "text" || q.type === "paragraph") && (
                        <TextField
                          value={ans.form_value || ""}
                          onChange={(e) =>
                            updateAnswer(key, q, "form_value", e.target.value)
                          }
                          placeholder={
                            q.type === "paragraph"
                              ? "Paragraph answer"
                              : "Text answer"
                          }
                          variant="textFieldMain"
                          disabled={fieldsDisabled}
                        />
                      )}

                      {/* MULTIPLE */}
                      {q.type === "multiple" && (
                        <div className="flex gap-4 mt-2">
                          <Select
                            value={ans.form_value || ""}
                            onValueChange={(v) =>
                              updateAnswer(key, q, "form_value", v)
                            }
                            disabled={fieldsDisabled}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Y">Yes</SelectItem>
                              <SelectItem value="N">No</SelectItem>
                              <SelectItem value="NA">N/A</SelectItem>
                            </SelectContent>
                          </Select>

                          <TextField
                            value={ans.remarks || ""}
                            onChange={(e) =>
                              updateAnswer(key, q, "remarks", e.target.value)
                            }
                            placeholder="Remarks"
                            variant="textFieldMain"
                            disabled={fieldsDisabled}
                          />

                          <TextField
                            value={ans.action_item || ""}
                            onChange={(e) =>
                              updateAnswer(
                                key,
                                q,
                                "action_item",
                                e.target.value,
                              )
                            }
                            placeholder="Action Item"
                            variant="textFieldMain"
                            disabled={fieldsDisabled}
                          />
                        </div>
                      )}

                      {/* DROPDOWN */}
                      {q.type === "dropdown" && (
                        <div className="flex gap-4 mt-2">
                          <Select
                            value={ans.form_value || ""}
                            onValueChange={(v) =>
                              updateAnswer(key, q, "form_value", v)
                            }
                            disabled={fieldsDisabled}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Select an option" />
                            </SelectTrigger>
                            <SelectContent>
                              {q.choices?.map((choice, i) => (
                                <SelectItem key={i} value={choice}>
                                  {choice}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* SUB-QUESTIONS */}
                      {q.subQuestions?.length > 0 && (
                        <div className="ml-6 mt-2 space-y-2 border-l-2 border-gray-200 pl-4">
                          {q.subQuestions.map((subQ, subIdx) => {
                            const subKey = makeKey(subQ, sIdx, subIdx, true); // ✅ pass isSub = true
                            const subAns = answers[subKey] || {};

                            return (
                              <div key={subKey}>
                                <label className="block font-medium text-sm text-font-main mb-1">
                                  {subQ.text}
                                  {subQ.required && (
                                    <span className="text-red-500"> *</span>
                                  )}
                                </label>

                                {/* SUB TEXT / PARAGRAPH */}
                                {(subQ.type === "text" ||
                                  subQ.type === "paragraph") && (
                                  <TextField
                                    value={subAns.form_value || ""}
                                    onChange={(e) =>
                                      // ✅ FIX #4
                                      updateAnswer(
                                        subKey,
                                        subQ,
                                        "form_value",
                                        e.target.value,
                                        q.form_question_id,
                                      )
                                    }
                                    placeholder={
                                      subQ.type === "paragraph"
                                        ? "Paragraph answer"
                                        : "Text answer"
                                    }
                                    variant="textFieldMain"
                                    disabled={fieldsDisabled}
                                  />
                                )}

                                {/* SUB MULTIPLE */}
                                {subQ.type === "multiple" && (
                                  <div className="flex gap-4 mt-1">
                                    <Select
                                      value={subAns.form_value || ""}
                                      onValueChange={(v) =>
                                        // ✅ FIX #4
                                        updateAnswer(
                                          subKey,
                                          subQ,
                                          "form_value",
                                          v,
                                          q.form_question_id,
                                        )
                                      }
                                      disabled={fieldsDisabled}
                                    >
                                      <SelectTrigger className="w-32">
                                        <SelectValue placeholder="Select" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="Y">Yes</SelectItem>
                                        <SelectItem value="N">No</SelectItem>
                                        <SelectItem value="NA">N/A</SelectItem>
                                      </SelectContent>
                                    </Select>

                                    <TextField
                                      value={subAns.remarks || ""}
                                      onChange={(e) =>
                                        // ✅ FIX #4
                                        updateAnswer(
                                          subKey,
                                          subQ,
                                          "remarks",
                                          e.target.value,
                                          q.form_question_id,
                                        )
                                      }
                                      placeholder="Remarks"
                                      variant="textFieldMain"
                                      disabled={fieldsDisabled}
                                    />

                                    <TextField
                                      value={subAns.action_item || ""}
                                      onChange={(e) =>
                                        // ✅ FIX #4
                                        updateAnswer(
                                          subKey,
                                          subQ,
                                          "action_item",
                                          e.target.value,
                                          q.form_question_id,
                                        )
                                      }
                                      placeholder="Action Item"
                                      variant="textFieldMain"
                                      disabled={fieldsDisabled}
                                    />
                                  </div>
                                )}

                                {/* SUB DROPDOWN */}
                                {subQ.type === "dropdown" && (
                                  <div className="flex gap-4 mt-1">
                                    <Select
                                      value={subAns.form_value || ""}
                                      onValueChange={(v) =>
                                        // ✅ FIX #4
                                        updateAnswer(
                                          subKey,
                                          subQ,
                                          "form_value",
                                          v,
                                          q.form_question_id,
                                        )
                                      }
                                      disabled={fieldsDisabled}
                                    >
                                      <SelectTrigger className="w-48">
                                        <SelectValue placeholder="Select an option" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {subQ.choices?.map((choice, i) => (
                                          <SelectItem key={i} value={choice}>
                                            {choice}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* ACTIONS */}
        <div className="flex justify-end gap-4 mt-6">
          {/* REQUESTOR BUTTONS - Draft, Pending, or Returned */}
          {isRequestor && (isDraft || isPending || isReturned) && (
            <>
              {(isDraft || isReturned) && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="buttonMain" disabled={isPendingAction}>
                      {isPendingAction ? "Saving..." : "Save Draft"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Save as Draft</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to save this form entry as a
                        draft? You can continue editing it later.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() =>
                          handleUpdate(isReturned ? "returned" : "draft")
                        }
                      >
                        Continue
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {(isDraft || isReturned) && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="buttonMain" disabled={isPendingAction}>
                      {isPendingAction ? "Submitting..." : "Submit"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Form Submission</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to submit this form entry for
                        approval? Please review all your answers before
                        proceeding.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleSubmitDraftForApproval}>
                        Continue
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {isPending && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="buttonMain" disabled={isPendingAction}>
                      {isPendingAction
                        ? "Submitting..."
                        : "Submit for Approval"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Submission</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to submit this form for approval?
                        Once submitted, the form will be sent to the first
                        approver.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleSubmitForApproval}>
                        Continue
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          )}

          {/* ✅ APPROVER BUTTONS - Only show if NOT pending/draft/completed/rejected */}
          {isApprover &&
            canUserApprove &&
            !isPending &&
            !isDraft &&
            !isCompleted &&
            !isRejected && (
              <>
                {/* Reject Button */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="buttonMain" disabled={isPendingAction}>
                      Reject
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Rejection</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to reject this form entry? This
                        action is final and the form cannot be resubmitted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="space-y-2">
                      <Label>Remarks (Optional)</Label>
                      <Textarea
                        placeholder="Provide reason for rejection..."
                        value={rejectionRemarks}
                        onChange={(e) => setRejectionRemarks(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <AlertDialogFooter>
                      <AlertDialogCancel
                        onClick={() => setRejectionRemarks("")}
                      >
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleApproveOrReject("reject")}
                      >
                        Confirm Rejection
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {/* ✅ Return Button */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="buttonMain" disabled={isPendingAction}>
                      Return
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Return Form to Requestor
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        The form will be returned to the requestor for
                        corrections. They can edit and resubmit for approval.
                      </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="space-y-2">
                      <Label>Remarks (Optional)</Label>
                      <Textarea
                        placeholder="Explain what needs to be corrected..."
                        value={returnRemarks}
                        onChange={(e) => setReturnRemarks(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setReturnRemarks("")}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction onClick={handleReturn}>
                        Return Form
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {/* Approve Button */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="buttonMain" disabled={isPendingAction}>
                      Approve
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Approval</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to approve this form entry? The
                        form will proceed to the next approval stage.
                      </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="space-y-2">
                      <Label>Remarks (Optional)</Label>
                      <Textarea
                        placeholder="Add any comments or notes..."
                        value={approvalRemarks}
                        onChange={(e) => setApprovalRemarks(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setApprovalRemarks("")}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleApproveOrReject("approve")}
                      >
                        Confirm Approval
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}

          {isApprover && !canUserApprove && !isCompleted && !isRejected && (
            <div className="text-gray-500 text-sm italic">
              You are not assigned as an approver for this form at the current
              stage.
            </div>
          )}

          {isCompleted && (
            <div className="text-green-600 font-semibold">✓ Form Completed</div>
          )}

          {isRejected && (
            <div className="text-red-600 font-semibold">✗ Form Rejected</div>
          )}

          {isRequestor &&
            (isSubmittedFirst ||
              isApprovedFirst ||
              isSubmittedSecond ||
              isApprovedSecond ||
              isSubmittedThird) && (
              <div className="text-blue-600 text-sm italic">
                Form is currently in the approval process.
              </div>
            )}
        </div>

        {/* ✅ VIEW APPROVAL HISTORY BUTTON */}
        {!isDraft && !isPending && (
          <div className="flex justify-center items-center gap-4 mt-8 pt-6 border-t">
            <Dialog>
              <DialogTrigger asChild>
                <button className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                  <LuEye className="w-4 h-4" />
                  View Approval History
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Approval History</DialogTitle>
                </DialogHeader>

                {isLoadingHistory ? (
                  <div className="py-8 text-center text-gray-500">
                    Loading history...
                  </div>
                ) : !approvalHistory?.timeline ? (
                  <div className="py-8 text-center text-gray-500">
                    No approval history available
                  </div>
                ) : (
                  <div className="space-y-1">
                    {approvalHistory.timeline.map((event, index) => {
                      const isLast =
                        index === approvalHistory.timeline.length - 1;

                      return (
                        <div key={index} className="flex gap-4">
                          {/* Timeline Line & Dot */}
                          <div className="flex flex-col items-center">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold ${getActionColor(
                                event.action,
                              )} bg-white border-2 border-current`}
                            >
                              {getActionIcon(event.action)}
                            </div>
                            {!isLast && (
                              <div className="w-0.5 h-full min-h-[60px] bg-gray-300" />
                            )}
                          </div>

                          {/* Event Details */}
                          <div className="flex-1 pb-6">
                            <div className="font-semibold text-gray-800">
                              {event.actionLabel}
                            </div>
                            {event.user && (
                              <div className="text-sm text-gray-600">
                                {event.user.name}
                              </div>
                            )}
                            <div className="text-xs text-gray-500">
                              {formatDateTime(event.datetime)}
                            </div>
                            {event.remarks && (
                              <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700 border-l-2 border-gray-300">
                                💬 {event.remarks}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
    </div>
  );
}
