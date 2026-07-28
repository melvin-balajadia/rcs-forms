import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PageHeader from "@/components/page-header";
import Button from "@/components/button";
import Dropdown from "@/components/dropdown";
import TextField from "@/components/textfield";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { LuPencil, LuTrash2, LuCirclePlus, LuX } from "react-icons/lu";
import { useFetch, useUpdate } from "@/services/useCrud";
import { apiGet, apiPut } from "@/services/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type ApproverLevel = "first" | "second" | "third";

type EligibleUser = {
  id: number;
  name: string;
  email: string;
};

type FormApproversResponse = {
  form: { id: number; name: string; description: string };
  approvers: Record<ApproverLevel, { id: number }[]>;
};

type SubQuestion = {
  sub_question_id?: number;
  text: string;
  type: string;
  required: boolean;
  choices: string[];
};

type Question = {
  form_question_id?: number;
  text: string;
  type: string;
  required: boolean;
  choices: string[];
  subQuestions: SubQuestion[];
};

type Section = {
  form_section_id?: number;
  title: string;
  description: string;
  questions: Question[];
};

// ✅ Defined at module scope (not inside EditForm) so its identity stays
// stable across re-renders — otherwise React remounts the <input> on every
// keystroke and the field loses focus after each character.
const ChoicesEditor = ({
  choices,
  onAdd,
  onUpdate,
  onDelete,
}: {
  choices: string[];
  onAdd: () => void;
  onUpdate: (index: number, value: string) => void;
  onDelete: (index: number) => void;
}) => (
  <div className="mt-2 ml-1 space-y-1">
    {choices.map((choice, i) => (
      <div key={i} className="flex items-center gap-2">
        <span className="text-xs text-gray-400 w-4">{i + 1}.</span>
        <input
          type="text"
          placeholder={`Choice ${i + 1}`}
          value={choice}
          onChange={(e) => onUpdate(i, e.target.value)}
          className="flex-1 text-sm text-gray-700 border-b border-gray-200 focus:outline-none focus:border-primary pb-1"
        />
        <button
          type="button"
          onClick={() => onDelete(i)}
          className="text-red-400 hover:text-red-600"
        >
          <LuX className="text-sm" />
        </button>
      </div>
    ))}
    <button
      type="button"
      onClick={onAdd}
      className="text-xs text-blue-500 hover:text-blue-700 mt-1"
    >
      + Add choice
    </button>
  </div>
);

export default function EditForm() {
  const navigate = useNavigate();
  const { formId } = useParams<{ formId: string }>();

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formEffectiveDate, setFormEffectiveDate] = useState(""); // ✅ added
  const [formRevisionNumber, setFormRevisionNumber] = useState(""); // ✅ added
  const [sections, setSections] = useState<Section[]>([]);

  const {
    data: form,
    isLoading,
    isError,
  } = useFetch<any>(["form", formId ?? ""], `/forms/get/${formId}`);

  useEffect(() => {
    if (form) {
      setFormTitle(form.form_name || "");
      setFormDescription(form.form_description || "");
      setFormEffectiveDate(
        // ✅ added
        form.form_effective_date ? form.form_effective_date.split("T")[0] : "",
      );
      setFormRevisionNumber(form.form_revision_number || ""); // ✅ added
      setSections(
        form.sections?.map((section: any) => ({
          form_section_id: section.form_section_id,
          title: section.form_section_name,
          description: section.form_section_description,
          questions:
            section.questions?.map((q: any) => ({
              form_question_id: q.id,
              text: q.form_questions,
              type: q.question_type,
              required: q.required,
              choices: q.choices || [],
              subQuestions:
                q.subQuestions?.map((subQ: any) => ({
                  sub_question_id: subQ.sub_question_id,
                  text: subQ.sub_questions,
                  type: subQ.question_type,
                  required: subQ.required,
                  choices: subQ.choices || [],
                })) || [],
            })) ?? [],
        })) ?? [],
      );
    }
  }, [form]);

  const updateFormMutation = useUpdate<{ message: string }>(
    ["forms"],
    `/forms/update/${formId}`,
    () => {
      toast.success("Form updated successfully!", {
        description: "Redirecting to Forms page...",
        action: { label: "Close", onClick: () => toast.dismiss() },
      });
      navigate("/forms");
    },
    (errorMessage) => {
      toast.error(errorMessage || "Failed to update form.");
    },
  );

  /* ===================== FORM APPROVERS TAB ===================== */
  const queryClient = useQueryClient();
  const [approverSearch, setApproverSearch] = useState("");
  const [assignments, setAssignments] = useState<
    Record<ApproverLevel, Set<number>>
  >({
    first: new Set(),
    second: new Set(),
    third: new Set(),
  });

  const { data: formApprovers, isLoading: isLoadingApprovers } =
    useQuery<FormApproversResponse>({
      queryKey: ["form-approvers", formId],
      queryFn: async () => apiGet(`/form-approvers/form/${formId}`),
      enabled: !!formId,
    });

  useEffect(() => {
    if (formApprovers?.approvers) {
      setAssignments({
        first: new Set(formApprovers.approvers.first.map((u) => u.id)),
        second: new Set(formApprovers.approvers.second.map((u) => u.id)),
        third: new Set(formApprovers.approvers.third.map((u) => u.id)),
      });
    }
  }, [formApprovers]);

  const { data: eligibleUsers = [], isLoading: isLoadingUsers } = useQuery<
    EligibleUser[]
  >({
    queryKey: ["approver-eligible-users"],
    queryFn: async () => {
      const res: any = await apiGet(
        "/users/pagination?page=1&pageSize=1000",
      );
      return (res.data || [])
        .filter((u: any) => {
          // ✅ all_access users are IT dept and aren't managed by qfd_admin,
          // so only users with the approver role are assignable here.
          const roles = Array.isArray(u.user_groups) ? u.user_groups : [];
          return roles.includes("approver");
        })
        .map((u: any) => ({
          id: u.id,
          name: `${u.user_firstname} ${u.user_lastname}`,
          email: u.user_email,
        }));
    },
  });

  const filteredUsers = eligibleUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(approverSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(approverSearch.toLowerCase()),
  );

  const toggleApprover = (userId: number, level: ApproverLevel) => {
    setAssignments((prev) => {
      const next = new Set(prev[level]);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return { ...prev, [level]: next };
    });
  };

  const clearApprover = (userId: number) => {
    setAssignments((prev) => ({
      first: new Set([...prev.first].filter((id) => id !== userId)),
      second: new Set([...prev.second].filter((id) => id !== userId)),
      third: new Set([...prev.third].filter((id) => id !== userId)),
    }));
  };

  const saveApproversMutation = useMutation({
    mutationFn: async () =>
      apiPut(`/form-approvers/form/${formId}`, {
        assignments: {
          first: [...assignments.first],
          second: [...assignments.second],
          third: [...assignments.third],
        },
      }),
    onSuccess: () => {
      toast.success("Form approvers updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["form-approvers", formId] });
    },
    onError: (error: any) => {
      toast.error("Error updating form approvers", {
        description:
          error?.response?.data?.message ||
          error?.message ||
          "Something went wrong",
      });
    },
  });

  const handleAddSection = () => {
    setSections([...sections, { title: "", description: "", questions: [] }]);
  };

  const handleAddQuestion = (sectionIndex: number) => {
    const updatedSections = [...sections];
    updatedSections[sectionIndex].questions.push({
      text: "",
      type: "text",
      required: false,
      choices: [],
      subQuestions: [],
    });
    setSections(updatedSections);
  };

  const handleAddSubQuestion = (
    sectionIndex: number,
    questionIndex: number,
  ) => {
    const updatedSections = [...sections];
    updatedSections[sectionIndex].questions[questionIndex].subQuestions.push({
      text: "",
      type: "text",
      required: false,
      choices: [],
    });
    setSections(updatedSections);
  };

  const handleDeleteQuestion = (
    sectionIndex: number,
    questionIndex: number,
  ) => {
    const updatedSections = [...sections];
    updatedSections[sectionIndex].questions.splice(questionIndex, 1);
    setSections(updatedSections);
  };

  const handleDeleteSubQuestion = (
    sectionIndex: number,
    questionIndex: number,
    subIndex: number,
  ) => {
    const updatedSections = [...sections];
    updatedSections[sectionIndex].questions[questionIndex].subQuestions.splice(
      subIndex,
      1,
    );
    setSections(updatedSections);
  };

  const handleDeleteSection = (sectionIndex: number) => {
    const updatedSections = [...sections];
    updatedSections.splice(sectionIndex, 1);
    setSections(updatedSections);
  };

  const handleAddChoice = (sectionIndex: number, questionIndex: number) => {
    const updatedSections = [...sections];
    updatedSections[sectionIndex].questions[questionIndex].choices.push("");
    setSections(updatedSections);
  };

  const handleUpdateChoice = (
    sectionIndex: number,
    questionIndex: number,
    choiceIndex: number,
    value: string,
  ) => {
    const updatedSections = [...sections];
    updatedSections[sectionIndex].questions[questionIndex].choices[
      choiceIndex
    ] = value;
    setSections(updatedSections);
  };

  const handleDeleteChoice = (
    sectionIndex: number,
    questionIndex: number,
    choiceIndex: number,
  ) => {
    const updatedSections = [...sections];
    updatedSections[sectionIndex].questions[questionIndex].choices.splice(
      choiceIndex,
      1,
    );
    setSections(updatedSections);
  };

  const handleAddSubChoice = (
    sectionIndex: number,
    questionIndex: number,
    subIndex: number,
  ) => {
    const updatedSections = [...sections];
    updatedSections[sectionIndex].questions[questionIndex].subQuestions[
      subIndex
    ].choices.push("");
    setSections(updatedSections);
  };

  const handleUpdateSubChoice = (
    sectionIndex: number,
    questionIndex: number,
    subIndex: number,
    choiceIndex: number,
    value: string,
  ) => {
    const updatedSections = [...sections];
    updatedSections[sectionIndex].questions[questionIndex].subQuestions[
      subIndex
    ].choices[choiceIndex] = value;
    setSections(updatedSections);
  };

  const handleDeleteSubChoice = (
    sectionIndex: number,
    questionIndex: number,
    subIndex: number,
    choiceIndex: number,
  ) => {
    const updatedSections = [...sections];
    updatedSections[sectionIndex].questions[questionIndex].subQuestions[
      subIndex
    ].choices.splice(choiceIndex, 1);
    setSections(updatedSections);
  };

  const handleSubmit = () => {
    if (!formTitle.trim() || !formDescription.trim() || sections.length === 0) {
      toast.error(
        "Please fill out the form title, description, and add at least one section.",
        {
          description: "Redirecting to Forms page...",
          action: { label: "Close", onClick: () => toast.dismiss() },
        },
      );
      return;
    }

    for (const section of sections) {
      if (!section.title.trim()) {
        toast.error("Missing section title", {
          description: "Each section must have a title before submission.",
          action: { label: "Close", onClick: () => toast.dismiss() },
        });
        return;
      }

      for (const question of section.questions) {
        if (question.type === "dropdown" && question.choices.length === 0) {
          toast.error("Missing dropdown choices", {
            description: `Question "${question.text || "Untitled"}" needs at least one choice.`,
            action: { label: "Close", onClick: () => toast.dismiss() },
          });
          return;
        }

        for (const subQ of question.subQuestions) {
          if (subQ.type === "dropdown" && subQ.choices.length === 0) {
            toast.error("Missing dropdown choices", {
              description: `A sub-question under "${question.text || "Untitled"}" needs at least one choice.`,
              action: { label: "Close", onClick: () => toast.dismiss() },
            });
            return;
          }
        }
      }
    }

    updateFormMutation.mutate({
      form_id: formId,
      form_name: formTitle.trim(),
      form_description: formDescription.trim(),
      form_effective_date: formEffectiveDate || null, // ✅ added
      form_revision_number: formRevisionNumber || null, // ✅ added
      sections: sections.map((section) => ({
        form_section_id: section.form_section_id,
        form_section_name: section.title.trim() || "Untitled Section",
        form_section_description: section.description.trim(),
        questions: section.questions.map((q) => ({
          form_question_id: q.form_question_id,
          form_questions: q.text.trim() || "Untitled Question",
          question_type: q.type,
          required: q.required,
          choices:
            q.type === "dropdown" ? q.choices.filter((c) => c.trim()) : [],
          subQuestions: q.subQuestions.map((subQ) => ({
            sub_question_id: subQ.sub_question_id,
            sub_questions: subQ.text.trim() || "Untitled SubQuestion",
            question_type: subQ.type,
            required: subQ.required,
            choices:
              subQ.type === "dropdown"
                ? subQ.choices.filter((c) => c.trim())
                : [],
          })),
        })),
      })),
    });
  };

  if (isLoading) return <div className="p-6">Loading form...</div>;
  if (isError || !form)
    return <div className="p-6 text-red-500">Failed to load form.</div>;

  return (
    <div className="mx-6 mt-5">
      <PageHeader
        icon={<LuPencil className="text-2xl text-font-main" />}
        title="Edit Form"
        buttonText="Go Back"
        onButtonClick={() => navigate("/forms")}
        variant="default"
      />

      <Tabs defaultValue="information" className="mt-4">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="information">Form Information</TabsTrigger>
          <TabsTrigger value="approvers">Form Approvers</TabsTrigger>
        </TabsList>

        <TabsContent value="information">
      <div className="bg-white shadow-md p-6 rounded-lg mt-2 space-y-4">
        <div className="w-1/2 space-y-2">
          {/* Form Title */}
          <input
            type="text"
            placeholder="Untitled Form"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            className="w-full text-2xl font-semibold text-gray-800 border-b border-gray-200 focus:outline-none focus:border-primary pb-1"
          />

          {/* Form Description */}
          <textarea
            placeholder="Form description"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            className="w-full text-base text-gray-700 border-b border-gray-200 focus:outline-none focus:border-primary resize-none leading-snug"
            rows={2}
          />

          {/* ✅ Effective Date & Revision Number */}
          <div className="flex gap-4 pt-2">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-sm font-semibold text-gray-700">
                Effective Date{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="date"
                value={formEffectiveDate}
                onChange={(e) => setFormEffectiveDate(e.target.value)}
                className="text-sm text-gray-700 border-b border-gray-200 focus:outline-none focus:border-primary pb-1"
              />
            </div>

            <div className="flex flex-col gap-1 flex-1">
              <label className="text-sm font-semibold text-gray-700">
                Revision Number{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Rev 01"
                value={formRevisionNumber}
                onChange={(e) => setFormRevisionNumber(e.target.value)}
                className="text-sm text-gray-700 border-b border-gray-200 focus:outline-none focus:border-primary pb-1"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            variant="buttonMain"
            onClick={handleAddSection}
            className="w-auto"
          >
            + Add Section
          </Button>
        </div>
      </div>

      {sections.map((section, sectionIndex) => (
        <div
          key={sectionIndex}
          className="bg-white shadow-md p-6 rounded-lg mt-4 space-y-4"
        >
          <div className="w-1/2 space-y-2">
            <input
              type="text"
              placeholder="Section"
              value={section.title}
              onChange={(e) => {
                const updatedSections = [...sections];
                updatedSections[sectionIndex].title = e.target.value;
                setSections(updatedSections);
              }}
              className="w-full text-2xl font-semibold text-gray-800 border-b border-gray-200 focus:outline-none focus:border-primary pb-1"
            />
            <textarea
              placeholder="Section description"
              value={section.description}
              onChange={(e) => {
                const updatedSections = [...sections];
                updatedSections[sectionIndex].description = e.target.value;
                setSections(updatedSections);
              }}
              className="w-full text-base text-gray-700 border-b border-gray-200 focus:outline-none focus:border-primary resize-none leading-snug"
              rows={2}
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => handleDeleteSection(sectionIndex)}
              className="text-red-500 hover:text-red-700 flex items-center gap-1 text-sm"
            >
              <LuTrash2 className="text-lg" /> Delete Section
            </button>
          </div>

          {section.questions.map((question, questionIndex) => (
            <div key={questionIndex} className="space-y-2">
              <div className="flex items-center gap-3 mt-2 w-full">
                <input
                  type="text"
                  placeholder="Question"
                  value={question.text}
                  onChange={(e) => {
                    const updatedSections = [...sections];
                    updatedSections[sectionIndex].questions[
                      questionIndex
                    ].text = e.target.value;
                    setSections(updatedSections);
                  }}
                  className="flex-1 text-gray-800 border-b border-gray-200 focus:outline-none focus:border-primary pb-1"
                />

                <Dropdown
                  variant="dropdownMain"
                  value={question.type}
                  onChange={(val: string) => {
                    const updatedSections = [...sections];
                    updatedSections[sectionIndex].questions[
                      questionIndex
                    ].type = val;
                    if (val !== "dropdown") {
                      updatedSections[sectionIndex].questions[
                        questionIndex
                      ].choices = [];
                    }
                    setSections(updatedSections);
                  }}
                  options={[
                    { label: "Text", value: "text" },
                    { label: "Multiple Choice", value: "multiple" },
                    { label: "Dropdown", value: "dropdown" },
                  ]}
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="text-gray-800 hover:text-gray-600"
                    onClick={() =>
                      handleAddSubQuestion(sectionIndex, questionIndex)
                    }
                  >
                    <LuCirclePlus className="text-lg" />
                  </button>
                  <button
                    onClick={() =>
                      handleDeleteQuestion(sectionIndex, questionIndex)
                    }
                    className="text-red-500 hover:text-red-700"
                  >
                    <LuTrash2 className="text-lg" />
                  </button>
                </div>

                <span className="text-gray-300">|</span>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Required</span>
                  <Switch
                    checked={question.required}
                    onCheckedChange={(checked) => {
                      const updatedSections = [...sections];
                      updatedSections[sectionIndex].questions[
                        questionIndex
                      ].required = checked;
                      setSections(updatedSections);
                    }}
                  />
                </div>
              </div>

              {question.type === "dropdown" && (
                <div className="ml-4 border-l-2 border-blue-100 pl-4">
                  <ChoicesEditor
                    choices={question.choices}
                    onAdd={() => handleAddChoice(sectionIndex, questionIndex)}
                    onUpdate={(i, val) =>
                      handleUpdateChoice(sectionIndex, questionIndex, i, val)
                    }
                    onDelete={(i) =>
                      handleDeleteChoice(sectionIndex, questionIndex, i)
                    }
                  />
                </div>
              )}

              <div className="ml-10 space-y-2 border-l-2 border-gray-200 pl-4">
                {question.subQuestions.map((subQ, subIndex) => (
                  <div key={subIndex} className="space-y-1">
                    <div className="flex items-center gap-3 w-full">
                      <input
                        type="text"
                        placeholder="Sub Question"
                        value={subQ.text}
                        onChange={(e) => {
                          const updatedSections = [...sections];
                          updatedSections[sectionIndex].questions[
                            questionIndex
                          ].subQuestions[subIndex].text = e.target.value;
                          setSections(updatedSections);
                        }}
                        className="flex-1 text-gray-700 border-b border-gray-200 focus:outline-none focus:border-primary pb-1"
                      />

                      <Dropdown
                        variant="dropdownMain"
                        value={subQ.type}
                        onChange={(val: string) => {
                          const updatedSections = [...sections];
                          updatedSections[sectionIndex].questions[
                            questionIndex
                          ].subQuestions[subIndex].type = val;
                          if (val !== "dropdown") {
                            updatedSections[sectionIndex].questions[
                              questionIndex
                            ].subQuestions[subIndex].choices = [];
                          }
                          setSections(updatedSections);
                        }}
                        options={[
                          { label: "Text", value: "text" },
                          { label: "Multiple Choice", value: "multiple" },
                          { label: "Dropdown", value: "dropdown" },
                        ]}
                      />

                      <button
                        onClick={() =>
                          handleDeleteSubQuestion(
                            sectionIndex,
                            questionIndex,
                            subIndex,
                          )
                        }
                        className="text-red-500 hover:text-red-700"
                      >
                        <LuTrash2 className="text-lg" />
                      </button>

                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Required</span>
                        <Switch
                          checked={subQ.required}
                          onCheckedChange={(checked) => {
                            const updatedSections = [...sections];
                            updatedSections[sectionIndex].questions[
                              questionIndex
                            ].subQuestions[subIndex].required = checked;
                            setSections(updatedSections);
                          }}
                        />
                      </div>
                    </div>

                    {subQ.type === "dropdown" && (
                      <div className="ml-4 border-l-2 border-blue-100 pl-4">
                        <ChoicesEditor
                          choices={subQ.choices}
                          onAdd={() =>
                            handleAddSubChoice(
                              sectionIndex,
                              questionIndex,
                              subIndex,
                            )
                          }
                          onUpdate={(i, val) =>
                            handleUpdateSubChoice(
                              sectionIndex,
                              questionIndex,
                              subIndex,
                              i,
                              val,
                            )
                          }
                          onDelete={(i) =>
                            handleDeleteSubChoice(
                              sectionIndex,
                              questionIndex,
                              subIndex,
                              i,
                            )
                          }
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <Button
              type="button"
              variant="buttonMain"
              onClick={() => handleAddQuestion(sectionIndex)}
              className="w-auto"
            >
              + Add Question
            </Button>
          </div>
        </div>
      ))}

      {sections.length > 0 && (
        <div className="flex justify-end mt-6">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="buttonMain"
                disabled={updateFormMutation.isPending}
              >
                {updateFormMutation.isPending ? "Updating..." : "Update Form"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Form Update</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to save these changes to the form?
                  This will affect how the form appears to requestors.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleSubmit}>
                  Continue
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
        </TabsContent>

        <TabsContent value="approvers">
          <div className="bg-white shadow-md p-6 rounded-lg mt-2 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-700">
                Assign Approvers
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Select who can approve <span className="font-medium">{formTitle}</span>{" "}
                and at which level.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <TextField
                variant="textFieldMain"
                placeholder="Search users..."
                value={approverSearch}
                onChange={(e) => setApproverSearch(e.target.value)}
              />
              <p className="text-sm text-gray-500 whitespace-nowrap">
                {filteredUsers.length} user(s)
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <p className="text-sm text-blue-800">
                Only users with the Approver role are eligible.
              </p>
              <p className="text-sm text-blue-700 mt-1">
                You can assign multiple users to the same approval level.
              </p>
            </div>

            {isLoadingApprovers || isLoadingUsers ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Loading users...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-gray-500">
                  {approverSearch
                    ? "No users found matching your search"
                    : "No eligible users available"}
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredUsers.map((user) => {
                  const hasAnyAssignment =
                    assignments.first.has(user.id) ||
                    assignments.second.has(user.id) ||
                    assignments.third.has(user.id);

                  return (
                    <div
                      key={user.id}
                      className={`border rounded-lg p-4 ${
                        hasAnyAssignment
                          ? "border-blue-300 bg-blue-50"
                          : "border-gray-200"
                      }`}
                    >
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-800">
                          {user.name}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {user.email}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center gap-4">
                        <Label className="text-sm font-medium text-gray-700">
                          Assign as:
                        </Label>

                        <div className="flex items-center gap-4">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`user-${user.id}-first`}
                              checked={assignments.first.has(user.id)}
                              onCheckedChange={() =>
                                toggleApprover(user.id, "first")
                              }
                            />
                            <label
                              htmlFor={`user-${user.id}-first`}
                              className="text-sm cursor-pointer"
                            >
                              1st Approver
                            </label>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`user-${user.id}-second`}
                              checked={assignments.second.has(user.id)}
                              onCheckedChange={() =>
                                toggleApprover(user.id, "second")
                              }
                            />
                            <label
                              htmlFor={`user-${user.id}-second`}
                              className="text-sm cursor-pointer"
                            >
                              2nd Approver
                            </label>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`user-${user.id}-third`}
                              checked={assignments.third.has(user.id)}
                              onCheckedChange={() =>
                                toggleApprover(user.id, "third")
                              }
                            />
                            <label
                              htmlFor={`user-${user.id}-third`}
                              className="text-sm cursor-pointer"
                            >
                              3rd Approver
                            </label>
                          </div>

                          {hasAnyAssignment && (
                            <button
                              type="button"
                              onClick={() => clearApprover(user.id)}
                              className="text-sm text-red-600 hover:text-red-800 underline"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end pt-4 border-t">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="buttonMain"
                    disabled={saveApproversMutation.isPending}
                  >
                    {saveApproversMutation.isPending
                      ? "Saving..."
                      : "Save Form Approvers"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Approver Assignment</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to save these approver
                      assignments? This will change who can approve
                      submissions for this form.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => saveApproversMutation.mutate()}
                    >
                      Continue
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
