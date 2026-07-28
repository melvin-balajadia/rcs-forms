import { useNavigate } from "react-router-dom";
import { useState } from "react";
import PageHeader from "@/components/page-header";
import Button from "@/components/button";
import Dropdown from "@/components/dropdown";
import { Switch } from "@/components/ui/switch";
import { LuNotepadText, LuTrash2, LuCirclePlus, LuX } from "react-icons/lu";
import { useCreate } from "@/services/useCrud";
import { toast } from "sonner";

type SubQuestion = {
  text: string;
  type: string;
  required: boolean;
  choices: string[];
};

type Question = {
  text: string;
  type: string;
  required: boolean;
  choices: string[];
  subQuestions: SubQuestion[];
};

type Section = {
  title: string;
  description: string;
  questions: Question[];
};

// ✅ Defined at module scope (not inside CreateForm) so its identity stays
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

export default function CreateForm() {
  const navigate = useNavigate();
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formEffectiveDate, setFormEffectiveDate] = useState(""); // ✅ added
  const [formRevisionNumber, setFormRevisionNumber] = useState(""); // ✅ added
  const [sections, setSections] = useState<Section[]>([]);

  const createFormMutation = useCreate<{ message: string }>(
    ["forms"],
    "forms/builder",
    () => {
      toast.success("Form created successfully!", {
        description: "Redirecting to Forms page...",
        action: { label: "Close", onClick: () => toast.dismiss() },
      });
      navigate("/forms");
    },
  );

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

  // ── Choices helpers (question) ──
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

  // ── Choices helpers (sub-question) ──
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
      toast.error("Form incomplete", {
        description:
          "Please add a title, description, and at least one section.",
        action: { label: "Close", onClick: () => toast.dismiss() },
      });
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

    createFormMutation.mutate({
      form_name: formTitle.trim(),
      form_description: formDescription.trim(),
      form_effective_date: formEffectiveDate || null, // ✅ added
      form_revision_number: formRevisionNumber || null, // ✅ added
      sections: sections.map((section) => ({
        form_section_name: section.title.trim() || "Untitled Section",
        form_section_description: section.description.trim(),
        questions: section.questions.map((q) => ({
          form_questions: q.text.trim() || "Untitled Question",
          question_type: q.type,
          required: q.required,
          choices:
            q.type === "dropdown" ? q.choices.filter((c) => c.trim()) : [],
          subQuestions: q.subQuestions.map((subQ) => ({
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

  const questionTypeOptions = [
    { label: "Text", value: "text" },
    { label: "Multiple Choice", value: "multiple" },
    { label: "Dropdown", value: "dropdown" },
  ];

  return (
    <div className="mx-6 mt-5">
      <PageHeader
        icon={<LuNotepadText className="text-2xl text-font-main" />}
        title="Create New Form"
        buttonText="Go Back"
        onButtonClick={() => navigate("/forms")}
        variant="default"
      />

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

          {/* ✅ Delete Section Button */}
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
              {/* Main Question Row */}
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
                  options={questionTypeOptions}
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

              {/* Dropdown Choices Editor (question) */}
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

              {/* SubQuestions */}
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
                        options={questionTypeOptions}
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

                    {/* Dropdown Choices Editor (sub-question) */}
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
          <Button
            type="button"
            variant="buttonMain"
            onClick={handleSubmit}
            disabled={createFormMutation.isPending}
          >
            {createFormMutation.isPending ? "Submitting..." : "Submit Form"}
          </Button>
        </div>
      )}
    </div>
  );
}
