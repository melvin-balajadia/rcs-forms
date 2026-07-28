import { useNavigate } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import PageHeader from "@/components/page-header";
import TextField from "@/components/textfield";
import Button from "@/components/button";
import { LuFileText, LuCalendarX } from "react-icons/lu";
import { apiGet, apiPost } from "@/services/api";
import { Label } from "@/components/ui/label";
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
import { getAuth } from "@/context/AuthContext";

type Form = {
  form_id?: number | string;
  id?: number | string;
  form_name?: string;
  name?: string;
};

type Question = {
  form_question_id?: number;
  form_section_id?: number;
  text: string;
  type: string;
  required: boolean;
  choices: string[];
  subQuestions: Question[];
  options?: { label: string; value: string }[];
};

type Section = {
  form_section_id?: number;
  title: string;
  description: string;
  questions: Question[];
};

export default function CreateFormEntry() {
  const navigate = useNavigate();
  const today = new Date().toISOString().split("T")[0];
  const { user } = getAuth();

  useEffect(() => {
    if (user) {
      const userRoles = user.user_groups || [];
      const isRequestor =
        Array.isArray(userRoles) &&
        (userRoles.includes("requestor") ||
          userRoles.includes("all_access") ||
          userRoles.includes("qfd_admin"));

      if (!isRequestor) {
        toast.error("Access Denied", {
          description: "You don't have permission to create form entries.",
        });
        navigate("/form-entry");
      }
    }
  }, [user, navigate]);

  const [formData, setFormData] = useState({
    formType: "",
    area: "",
    date: today,
    site: "",
  });

  const [selectedForm, setSelectedForm] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const {
    data: forms,
    isLoading,
    isError,
  } = useQuery<Form[]>({
    queryKey: ["forms"],
    queryFn: async () => {
      const res = await apiGet<any>("/forms/all");
      if (Array.isArray(res)) return res;
      if (Array.isArray(res?.data)) return res.data;
      const arr = Object.values(res).find((v) => Array.isArray(v));
      return Array.isArray(arr) ? arr : [];
    },
  });

  const formTypeOptions = useMemo(() => {
    if (!Array.isArray(forms)) return [];
    const seen = new Set<string>();
    const opts: { label: string; value: string }[] = [];

    for (const f of forms) {
      const rawId =
        (f as any).form_id ?? (f as any).id ?? (f as any).formId ?? null;
      if (rawId == null) continue;

      const value = String(rawId).trim();
      if (!value || seen.has(value)) continue;

      seen.add(value);
      const label = (f as any).form_name ?? (f as any).name ?? `Form ${value}`;
      opts.push({ label: String(label).trim(), value });
    }
    return opts;
  }, [forms]);

  useEffect(() => {
    if (!formData.formType) {
      setSelectedForm(null);
      return;
    }

    const fetchForm = async () => {
      try {
        const res = await apiGet<any>(`/forms/get/${formData.formType}`);

        if (res) {
          const sections =
            res.sections?.map((section: any) => ({
              form_section_id: section.form_section_id,
              title: section.form_section_name,
              description: section.form_section_description,
              questions:
                section.questions?.map((q: any) => {
                  const questionId =
                    q.form_question_id || q.id || q.question_id || q.questionId;

                  return {
                    form_section_id: section.form_section_id,
                    form_question_id: questionId,
                    text: q.form_questions || q.text || q.question,
                    type: q.question_type || q.type,
                    required: q.required,
                    choices: q.choices || [],
                    subQuestions:
                      q.subQuestions?.map((subQ: any) => ({
                        form_section_id: section.form_section_id,
                        form_question_id: subQ.sub_question_id, // ✅ fixed
                        text: subQ.sub_questions,
                        type: subQ.question_type,
                        required: subQ.required,
                        choices: subQ.choices || [],
                        subQuestions: [],
                      })) || [],
                    options: q.options || [],
                  };
                }) ?? [],
            })) ?? [];

          setSelectedForm({ ...res, sections });
        }
      } catch (err) {
        console.error("Failed to fetch form details", err);
        setSelectedForm(null);
      }
    };
    fetchForm();
  }, [formData.formType]);

  const siteOptions = [
    { label: "Taytay", value: "Taytay" },
    { label: "Cabuyao", value: "Cabuyao" },
    { label: "Plaridel", value: "Plaridel" },
    { label: "Marilao", value: "Marilao" },
    { label: "Villasis", value: "Villasis" },
  ];

  const areaOptions = [
    { label: "Main", value: "Main" },
    { label: "Annex", value: "Annex" },
  ];

  const { mutate: submitEntry, isPending } = useMutation({
    // ✅ Submitting a brand-new entry goes straight to the first approver —
    // create it, then immediately submit it for approval in one action.
    mutationFn: async (payload: any) => {
      const res: any = await apiPost("/form-entries/create-builder", payload);
      if (payload.form_entry_status === "pending") {
        await apiPost("/form-entries/submit-approval", {
          form_entry_id: res.entry.id,
          user_id: payload.user_id,
        });
      }
      return res;
    },
    onSuccess: (_, variables) => {
      const isDraft = variables.form_entry_status === "draft";
      toast.success(
        isDraft
          ? "Draft saved successfully!"
          : "Form submitted for approval successfully!",
        {
          description: isDraft
            ? "You can continue editing it later."
            : "Redirecting to Form Entries page...",
        },
      );
      navigate("/form-entry");
    },
    onError: (err: any) => {
      console.error("Error submitting form:", err);
      toast.error("Error submitting form", {
        description:
          err?.response?.data?.message ||
          err?.message ||
          "Something went wrong",
      });
    },
  });

  const handleSubmit = (status: "draft" | "pending") => {
    if (!user) {
      toast.error("User not logged in!");
      return;
    }

    if (status === "pending") {
      if (!formData.formType || !formData.site || !formData.area) {
        toast.warning("Missing required fields", {
          description:
            "Please select Form Type, Site, and Area before submitting.",
        });
        return;
      }
    } else {
      if (!formData.formType) {
        toast.warning("Form Type required", {
          description: "Please select a Form Type to save a draft.",
        });
        return;
      }
    }

    const allAnswersList = Object.values(answers);

    const responses = allAnswersList
      .filter(
        (ans: any) => ans.parent_question_id === null && ans.form_question_id,
      )
      .map((ans: any) => {
        const subQuestionAnswers = allAnswersList
          .filter(
            (subAns: any) => subAns.parent_question_id === ans.form_question_id,
          )
          .map((subAns: any) => ({
            sub_question_id: subAns.form_question_id, // ✅ correct sub_question_id
            form_sub_value: subAns.value || "",
            remarks: subAns.remarks || "",
            action_item: subAns.action_item || "",
          }));

        return {
          form_question_id: Number(ans.form_question_id),
          form_value: ans.value || "",
          remarks: ans.remarks || "",
          action_item: ans.action_item || "",
          sub_values: subQuestionAnswers,
        };
      });

    if (status === "pending" && responses.length === 0) {
      toast.warning("No answers provided", {
        description: "Please answer at least one question before submitting.",
      });
      return;
    }

    if (status === "pending") {
      const responseByQuestion = new Map(
        responses.map((r) => [r.form_question_id, r]),
      );
      const subValueBySubQuestion = new Map();
      for (const r of responses) {
        for (const sv of r.sub_values || []) {
          subValueBySubQuestion.set(sv.sub_question_id, sv);
        }
      }

      const missing: string[] = [];
      for (const section of selectedForm?.sections || []) {
        for (const q of section.questions || []) {
          if (q.required) {
            const r = responseByQuestion.get(Number(q.form_question_id));
            if (!r || !String(r.form_value ?? "").trim()) {
              missing.push(q.text);
            }
          }
          for (const subQ of q.subQuestions || []) {
            if (subQ.required) {
              const sv = subValueBySubQuestion.get(
                Number(subQ.form_question_id),
              );
              if (!sv || !String(sv.form_sub_value ?? "").trim()) {
                missing.push(subQ.text);
              }
            }
          }
        }
      }

      if (missing.length > 0) {
        toast.warning("Missing required answers", {
          description: `Please answer: ${missing.join(", ")}`,
        });
        return;
      }
    }

    const payload = {
      user_id: user.id,
      form_id: Number(formData.formType),
      form_entry_site: formData.site || null,
      form_entry_area: formData.area || null,
      form_entry_date: formData.date || null,
      form_entry_archivestatus: 0,
      form_entry_status: status,
      responses,
    };

    submitEntry(payload);
  };

  const makeQuestionKey = (
    q: Question,
    sectionIndex: number,
    questionIndex: number,
    parentId?: number,
  ) => {
    const sectionId = q.form_section_id ?? sectionIndex;
    const qId = q.form_question_id ?? questionIndex;
    return `${sectionId}-${parentId ?? "root"}-${qId}-${questionIndex}`;
  };

  const renderQuestionUI = (
    q: Question,
    sectionIndex: number,
    questionIndex: number,
    parentId?: number,
  ) => {
    const qKey = makeQuestionKey(q, sectionIndex, questionIndex, parentId);
    const answer = answers[qKey] || { value: "", remarks: "", action_item: "" };

    const handleValueChange = (field: string, val: string) => {
      setAnswers((prev) => ({
        ...prev,
        [qKey]: {
          ...answer,
          form_question_id: q.form_question_id,
          form_section_id: q.form_section_id,
          parent_question_id: parentId ?? null,
          [field]: val,
        },
      }));
    };

    if (q.type === "text" || q.type === "paragraph") {
      return (
        <TextField
          key={qKey}
          value={answer.value}
          onChange={(e) => handleValueChange("value", e.target.value)}
          placeholder={
            q.type === "paragraph" ? "Paragraph answer" : "Text answer"
          }
          variant="textFieldMain"
        />
      );
    }

    if (q.type === "multiple") {
      return (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <Select
            key={`${qKey}-select`}
            value={answer.value ?? ""}
            onValueChange={(val) => handleValueChange("value", val)}
          >
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Y">Yes</SelectItem>
              <SelectItem value="N">No</SelectItem>
              <SelectItem value="NA">N/A</SelectItem>
            </SelectContent>
          </Select>

          <div className="w-full sm:flex-1">
            <TextField
              key={`${qKey}-remarks`}
              value={answer.remarks}
              onChange={(e) => handleValueChange("remarks", e.target.value)}
              placeholder="Remarks"
              variant="textFieldMain"
            />
          </div>

          <div className="w-full sm:flex-1">
            <TextField
              key={`${qKey}-action`}
              value={answer.action_item || ""}
              onChange={(e) => handleValueChange("action_item", e.target.value)}
              placeholder="Action Item"
              variant="textFieldMain"
            />
          </div>
        </div>
      );
    }

    if (q.type === "dropdown") {
      return (
        <div className="flex items-center gap-4">
          <Select
            key={`${qKey}-select`}
            value={answer.value ?? ""}
            onValueChange={(val) => handleValueChange("value", val)}
          >
            <SelectTrigger className="w-full sm:w-48">
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
      );
    }

    return <p className="text-gray-500">Unsupported question type</p>;
  };

  return (
    <div className="mx-3 sm:mx-4 md:mx-6 mt-5">
      <PageHeader
        icon={<LuFileText className="text-xl sm:text-2xl text-font-main" />}
        title="Create Form Entry"
        buttonText="Go Back"
        onButtonClick={() => navigate("/form-entry")}
        variant="default"
      />

      <div className="bg-white shadow-md p-3 sm:p-4 rounded mt-1">
        {/* 1 col mobile → 2 col tablet → 3 col desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-4 lg:gap-x-6 lg:gap-y-6 items-start">
          <div className="flex flex-col space-y-2">
            <Label>Form Type</Label>
            <Select
              value={formData.formType}
              onValueChange={(val) => handleChange("formType", val)}
              disabled={isLoading || isError}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    isLoading
                      ? "Loading forms..."
                      : isError
                        ? "Failed to load forms"
                        : "Select a Form Type"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {formTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col space-y-2">
            <Label>Area</Label>
            <Select
              value={formData.area}
              onValueChange={(val) => handleChange("area", val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an Area" />
              </SelectTrigger>
              <SelectContent>
                {areaOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col space-y-2">
            <Label>Site</Label>
            <Select
              value={formData.site}
              onValueChange={(val) => handleChange("site", val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a Site" />
              </SelectTrigger>
              <SelectContent>
                {siteOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-1">
            <TextField
              variant="textFieldMain"
              label="Date"
              type="date"
              value={formData.date}
              onChange={(e) => handleChange("date", e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 sm:mt-6">
          {!selectedForm ? (
            <div className="flex justify-center items-center h-48 sm:h-64 border-2 border-dashed border-gray-300 rounded-lg">
              <div className="text-center text-gray-500 px-4">
                <LuCalendarX className="mx-auto text-3xl sm:text-4xl mb-2 sm:mb-3 text-gray-400" />
                <p className="text-sm sm:text-lg">
                  Please select a form to display questions below
                </p>
              </div>
            </div>
          ) : (
            selectedForm.sections.map(
              (section: Section, sectionIndex: number) => (
                <div
                  key={sectionIndex}
                  className="bg-white shadow-md p-4 sm:p-6 rounded-lg mt-4 space-y-4"
                >
                  <div className="w-full md:w-1/2 space-y-1 sm:space-y-2">
                    <h2 className="text-lg sm:text-xl font-semibold text-font-main">
                      {section.title}
                    </h2>
                    <p className="text-sm sm:text-base text-font-secondary">
                      {section.description}
                    </p>
                  </div>

                  {section.questions?.map(
                    (q: Question, questionIndex: number) => (
                      <div
                        key={questionIndex}
                        className="space-y-2 border-b pb-4"
                      >
                        <div className="mt-2">
                          <label className="block font-medium text-sm sm:text-base text-font-main mb-1">
                            {q.text}{" "}
                            {q.required && (
                              <span className="text-red-500">*</span>
                            )}
                          </label>
                          {renderQuestionUI(q, sectionIndex, questionIndex)}
                        </div>

                        {q.subQuestions?.length > 0 && (
                          <div className="ml-3 sm:ml-6 mt-2 space-y-2 border-l-2 border-gray-200 pl-3 sm:pl-4">
                            {q.subQuestions.map(
                              (subQ: Question, subIndex: number) => (
                                <div key={subIndex}>
                                  <label className="block font-medium text-sm sm:text-base text-font-main mb-1">
                                    {subQ.text}{" "}
                                    {subQ.required && (
                                      <span className="text-red-500">*</span>
                                    )}
                                  </label>
                                  {renderQuestionUI(
                                    subQ,
                                    sectionIndex,
                                    subIndex,
                                    q.form_question_id,
                                  )}
                                </div>
                              ),
                            )}
                          </div>
                        )}
                      </div>
                    ),
                  )}
                </div>
              ),
            )
          )}
        </div>

        {/* Buttons: stack on mobile, row on sm+ */}
        <div className="flex flex-col-reverse gap-2 mt-4 sm:flex-row sm:justify-end sm:gap-3 sm:mt-6">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="buttonMain"
                disabled={isPending}
                className="w-full sm:w-auto"
              >
                {isPending ? "Saving..." : "Save as Draft"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle>Save as Draft</AlertDialogTitle>
                <AlertDialogDescription>
                  This will save your progress. You can continue editing this
                  form later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                <AlertDialogCancel className="w-full sm:w-auto">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  className="w-full sm:w-auto"
                  onClick={() => handleSubmit("draft")}
                >
                  Save Draft
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="buttonMain"
                disabled={isPending}
                className="w-full sm:w-auto"
              >
                {isPending ? "Submitting..." : "Submit"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Form Submission</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to submit this form entry? Please review
                  all your answers before proceeding.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                <AlertDialogCancel className="w-full sm:w-auto">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  className="w-full sm:w-auto"
                  onClick={() => handleSubmit("pending")}
                >
                  Continue
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
