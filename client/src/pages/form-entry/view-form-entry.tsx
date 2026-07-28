import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "@/components/page-header";
import TextField from "@/components/textfield";
import Button from "@/components/button";
import { LuFileText, LuCalendarX } from "react-icons/lu";
import { apiGet } from "@/services/api";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  User?: {
    user_username: string;
    user_firstname: string;
    user_lastname: string;
  };
  Form?: {
    form_name: string;
  };
};

type QuestionValue = {
  form_question_id: number;
  form_value: string;
  remarks: string;
  action_item: string;
  form_section_id: number;
};

export default function ViewFormEntry() {
  const navigate = useNavigate();
  const { entryId } = useParams<{ entryId: string }>();

  const [formDetails, setFormDetails] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, QuestionValue>>({});

  // Fetch form entry details
  const { data: formEntry, isLoading: isLoadingEntry } = useQuery<FormEntry>({
    queryKey: ["form-entry", entryId],
    queryFn: async () => {
      const res = await apiGet<any>(`/form-entries/get/${entryId}`);
      return res;
    },
    enabled: !!entryId,
  });

  // Fetch form structure
  useEffect(() => {
    if (!formEntry?.form_id) return;

    const fetchFormStructure = async () => {
      try {
        const res = await apiGet<any>(`/forms/get/${formEntry.form_id}`);

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
                      q.subQuestions?.map((subQ: any) => {
                        const subQuestionId =
                          subQ.form_question_id ||
                          subQ.id ||
                          subQ.question_id ||
                          subQ.questionId;

                        return {
                          form_section_id: section.form_section_id,
                          form_question_id: subQuestionId,
                          text:
                            subQ.sub_questions || subQ.text || subQ.question,
                          type: subQ.question_type || subQ.type,
                          required: subQ.required,
                          choices: subQ.choices || [],
                          subQuestions: [],
                        };
                      }) || [],
                  };
                }) ?? [],
            })) ?? [];

          setFormDetails({ ...res, sections });
        }
      } catch (err) {
        console.error("Failed to fetch form structure", err);
      }
    };

    fetchFormStructure();
  }, [formEntry?.form_id]);

  // Fetch question values/answers
  useEffect(() => {
    if (!entryId) return;

    const fetchAnswers = async () => {
      try {
        const res = await apiGet<any>(`/form-entries/entry/${entryId}`);

        if (Array.isArray(res)) {
          const answersMap: Record<string, QuestionValue> = {};

          res.forEach((answer: any) => {
            const key = `${answer.form_section_id}-${answer.form_question_id}`;

            // Check if this is a main answer (has Y/N/NA) or additional data
            const isMainAnswer = ["Y", "N", "NA"].includes(answer.form_value);

            if (isMainAnswer || !answersMap[key]) {
              // Store the main answer or create new entry if doesn't exist
              answersMap[key] = {
                form_question_id: answer.form_question_id,
                form_value: answer.form_value || "",
                remarks: answer.remarks || "",
                action_item: answer.action_item || "",
                form_section_id: answer.form_section_id,
              };
            }
          });

          setAnswers(answersMap);
        }
      } catch (err) {
        console.error("Failed to fetch answers", err);
      }
    };

    fetchAnswers();
  }, [entryId]);

  const makeQuestionKey = (
    q: Question,
    sectionIndex: number,
    questionIndex: number,
  ) => {
    const sectionId = q.form_section_id ?? sectionIndex;
    const qId = q.form_question_id ?? questionIndex;
    return `${sectionId}-${qId}`;
  };

  const renderQuestionUI = (
    q: Question,
    sectionIndex: number,
    questionIndex: number,
  ) => {
    const qKey = makeQuestionKey(q, sectionIndex, questionIndex);
    const answer = answers[qKey] || {
      form_value: "",
      remarks: "",
      action_item: "",
    };

    if (q.type === "text" || q.type === "paragraph") {
      return (
        <TextField
          key={qKey}
          value={answer.form_value}
          placeholder={
            q.type === "paragraph" ? "Paragraph answer" : "Text answer"
          }
          variant="textFieldMain"
          disabled
        />
      );
    }

    if (q.type === "multiple") {
      return (
        <div className="flex items-center gap-4">
          <Select value={answer.form_value ?? ""} disabled>
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
            key={`${qKey}-remarks`}
            value={answer.remarks}
            placeholder="Remarks"
            variant="textFieldMain"
            disabled
          />

          <TextField
            key={`${qKey}-action`}
            value={answer.action_item || ""}
            placeholder="Action Item"
            variant="textFieldMain"
            disabled
          />
        </div>
      );
    }

    if (q.type === "dropdown") {
      return (
        <div className="flex items-center gap-4">
          <Select value={answer.form_value ?? ""} disabled>
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
      );
    }

    return <p className="text-gray-500">Unsupported question type</p>;
  };

  if (isLoadingEntry) {
    return (
      <div className="mx-6">
        <PageHeader
          icon={<LuFileText className="text-2xl text-font-main" />}
          title="View Form Entry"
          buttonText="Go Back"
          onButtonClick={() => navigate("/form-entry")}
          variant="default"
        />
        <div className="bg-white shadow-md p-4 rounded mt-1">
          <p className="text-center text-gray-500">Loading form entry...</p>
        </div>
      </div>
    );
  }

  if (!formEntry) {
    return (
      <div className="mx-6">
        <PageHeader
          icon={<LuFileText className="text-2xl text-font-main" />}
          title="View Form Entry"
          buttonText="Go Back"
          onButtonClick={() => navigate("/form-entry")}
          variant="default"
        />
        <div className="bg-white shadow-md p-4 rounded mt-1">
          <p className="text-center text-red-500">Form entry not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-6 mt-5">
      <PageHeader
        icon={<LuFileText className="text-2xl text-font-main" />}
        title="View Form Entry"
        buttonText="Go Back"
        onButtonClick={() => navigate("/form-entry")}
        variant="default"
      />

      <div className="bg-white shadow-md p-4 rounded mt-1">
        {/* Form Entry Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-6 items-start">
          <div className="flex flex-col space-y-2">
            <Label>Form Type</Label>
            <TextField
              value={formEntry.Form?.form_name || "N/A"}
              variant="textFieldMain"
              disabled
            />
          </div>

          <div className="flex flex-col space-y-2">
            <Label>Area</Label>
            <TextField
              value={formEntry.form_entry_area}
              variant="textFieldMain"
              disabled
            />
          </div>

          <div className="flex flex-col space-y-2">
            <Label>Site</Label>
            <TextField
              value={formEntry.form_entry_site}
              variant="textFieldMain"
              disabled
            />
          </div>

          <TextField
            variant="textFieldMain"
            label="Date"
            type="date"
            value={formEntry.form_entry_date?.split("T")[0] || ""}
            disabled
          />

          <div className="flex flex-col space-y-2">
            <Label>Submitted By</Label>
            <TextField
              value={
                formEntry.User
                  ? `${formEntry.User.user_firstname} ${formEntry.User.user_lastname}`
                  : "N/A"
              }
              variant="textFieldMain"
              disabled
            />
          </div>
        </div>

        {/* Form Questions and Answers */}
        <div className="mt-6">
          {!formDetails ? (
            <div className="flex justify-center items-center h-64 border-2 border-dashed border-gray-300 rounded-lg">
              <div className="text-center text-gray-500">
                <LuCalendarX className="mx-auto text-4xl mb-3 text-gray-400" />
                <p className="text-lg">Loading form questions...</p>
              </div>
            </div>
          ) : (
            formDetails.sections.map(
              (section: Section, sectionIndex: number) => (
                <div
                  key={sectionIndex}
                  className="bg-white shadow-md p-6 rounded-lg mt-4 space-y-4"
                >
                  <div className="w-1/2 space-y-2">
                    <h2 className="text-xl font-semibold text-font-main">
                      {section.title}
                    </h2>
                    <p className="text-font-secondary">{section.description}</p>
                  </div>

                  {section.questions?.map(
                    (q: Question, questionIndex: number) => (
                      <div
                        key={questionIndex}
                        className="space-y-2 border-b pb-4"
                      >
                        <div className="mt-2">
                          <label className="block font-medium text-font-main mb-1">
                            {q.text}{" "}
                            {q.required && (
                              <span className="text-red-500">*</span>
                            )}
                          </label>
                          {renderQuestionUI(q, sectionIndex, questionIndex)}
                        </div>

                        {q.subQuestions?.length > 0 && (
                          <div className="ml-6 mt-2 space-y-2 border-l-2 border-gray-200 pl-4">
                            {q.subQuestions.map(
                              (subQ: Question, subIndex: number) => (
                                <div key={subIndex}>
                                  <label className="block font-medium text-font-main mb-1">
                                    {subQ.text}{" "}
                                    {subQ.required && (
                                      <span className="text-red-500">*</span>
                                    )}
                                  </label>
                                  {renderQuestionUI(
                                    subQ,
                                    sectionIndex,
                                    subIndex,
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

        <div className="flex justify-end mt-6 gap-4">
          <Button variant="buttonMain" onClick={() => navigate("/form-entry")}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
