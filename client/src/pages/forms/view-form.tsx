import { useParams, useNavigate } from "react-router-dom";
import PageHeader from "@/components/page-header";
import Button from "@/components/button";
import TextField from "@/components/textfield";
import Dropdown from "@/components/dropdown";
import { LuEye } from "react-icons/lu";
import { useFetch } from "@/services/useCrud";

export default function ViewForm() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();

  const {
    data: form,
    isLoading,
    isError,
  } = useFetch<any>(["form", formId ?? ""], `/forms/get/${formId}`);

  if (!formId) return <div className="p-6 text-red-500">Invalid form ID.</div>;
  if (isLoading) return <div className="p-6">Loading form...</div>;
  if (isError || !form)
    return <div className="p-6 text-red-500">Failed to load form.</div>;

  const sections =
    form.sections?.map((section: any) => ({
      title: section.form_section_name,
      description: section.form_section_description,
      questions:
        section.questions?.map((q: any) => ({
          text: q.form_questions,
          type: q.question_type,
          required: q.required,
          choices: q.choices || [],
          subQuestions:
            q.subQuestions?.map((subQ: any) => ({
              text: subQ.sub_questions,
              type: subQ.question_type,
              required: subQ.required,
              choices: subQ.choices || [],
            })) || [],
          options: q.options || [],
        })) ?? [],
    })) ?? [];

  const renderQuestionUI = (q: any) => {
    switch (q.type) {
      case "text":
        return (
          <TextField
            value=""
            onChange={() => {}}
            disabled
            placeholder="Text answer"
            variant="textFieldMain"
          />
        );

      case "paragraph":
        return (
          <TextField
            value=""
            onChange={() => {}}
            disabled
            placeholder="Paragraph answer"
            variant="textFieldMain"
          />
        );

      case "multiple":
        return (
          <div className="flex items-center gap-4">
            <Dropdown
              value=""
              onChange={() => {}}
              disabled
              placeholder="Select"
              options={[
                { label: "Yes", value: "Y" },
                { label: "No", value: "N" },
                { label: "N/A", value: "NA" },
              ]}
              variant="dropdownMain"
              className="w-32"
            />
            <TextField
              value=""
              onChange={() => {}}
              disabled
              placeholder="Remarks"
              variant="textFieldMain"
            />
            <TextField
              value=""
              onChange={() => {}}
              disabled
              placeholder="Action Item"
              variant="textFieldMain"
            />
          </div>
        );

      case "dropdown":
        return (
          <Dropdown
            value=""
            onChange={() => {}}
            disabled
            placeholder="Select an option"
            options={
              q.choices?.map((choice: string) => ({
                label: choice,
                value: choice,
              })) || []
            }
            variant="dropdownMain"
            className="w-full max-w-md"
          />
        );

      default:
        return <p className="text-gray-500">Unsupported question type</p>;
    }
  };

  return (
    <div className="mx-6 mt-5">
      <PageHeader
        icon={<LuEye className="text-2xl text-font-main" />}
        title="View Form"
        buttonText="Go Back"
        onButtonClick={() => navigate("/forms")}
        variant="default"
      />

      {/* Form Info */}
      <div className="bg-white shadow-md p-6 rounded-lg mt-2 space-y-4">
        <div className="w-1/2 space-y-3">
          <h1 className="text-2xl font-semibold text-font-main">
            {form.form_name || "Untitled Form"}
          </h1>
          <p className="text-base text-font-secondary">
            {form.form_description}
          </p>

          {/* ✅ Effective Date & Revision Number */}
          {(form.form_effective_date || form.form_revision_number) && (
            <div className="flex gap-6 pt-1">
              {form.form_effective_date && (
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-gray-700">
                    Effective Date
                  </span>
                  <span className="text-sm text-gray-600">
                    {new Date(form.form_effective_date).toLocaleDateString(
                      "en-US",
                      { month: "long", day: "numeric", year: "numeric" },
                    )}
                  </span>
                </div>
              )}
              {form.form_revision_number && (
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-gray-700">
                    Revision Number
                  </span>
                  <span className="text-sm text-gray-600">
                    {form.form_revision_number}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sections */}
      {sections.map((section: any, sectionIndex: number) => (
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

          {section.questions?.map((q: any, questionIndex: number) => (
            <div key={questionIndex} className="space-y-2 border-b pb-4">
              <div className="mt-2">
                <label className="block font-medium text-font-main mb-1">
                  {q.text}{" "}
                  {q.required && <span className="text-red-500">*</span>}
                </label>
                {renderQuestionUI(q)}
              </div>

              {q.subQuestions?.length > 0 && (
                <div className="ml-6 mt-2 space-y-2 border-l-2 border-gray-200 pl-4">
                  {q.subQuestions.map((subQ: any, subIndex: number) => (
                    <div key={subIndex}>
                      <label className="block font-medium text-font-main mb-1">
                        {subQ.text}{" "}
                        {subQ.required && (
                          <span className="text-red-500">*</span>
                        )}
                      </label>
                      {renderQuestionUI(subQ)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      <div className="flex justify-end mt-6">
        <Button
          type="button"
          variant="buttonMain"
          onClick={() => navigate("/forms")}
        >
          Close
        </Button>
      </div>
    </div>
  );
}
