import { useNavigate } from "react-router-dom";
import { LuFileText } from "react-icons/lu";
import PageHeader from "@/components/page-header";
import { statusOf } from "@/lib/httpErrors";

type Props = {
  title: string;
  error: unknown;
  onRetry: () => void;
};

// Shown instead of the form when an entry can't be loaded. The API answers
// 404 both for entries that don't exist and for ones the user may not see,
// so the message covers both without revealing which.
export default function EntryLoadError({ title, error, onRetry }: Props) {
  const navigate = useNavigate();
  const status = statusOf(error);
  const denied = status === 404 || status === 403 || !error;

  return (
    <div className="mx-6 mt-5">
      <PageHeader
        icon={<LuFileText className="text-2xl text-font-main" />}
        title={title}
        buttonText="Go Back"
        onButtonClick={() => navigate("/form-entry")}
        variant="default"
      />
      <div
        className="mt-1 flex flex-col items-center rounded bg-white p-10 text-center shadow-md"
        role="alert"
      >
        <p className="text-base font-semibold text-gray-800">
          {denied
            ? "Entry not found or you don't have access"
            : "Couldn't load this entry"}
        </p>
        <p className="mt-1 max-w-md text-sm text-gray-500">
          {denied
            ? "It may have been archived, or it belongs to someone else. Check the link, or find the entry in the list."
            : "Something went wrong while loading it. Check your connection and try again."}
        </p>
        <div className="mt-5 flex gap-3">
          {!denied && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Try again
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate("/form-entry")}
            className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
          >
            Back to Form Entries
          </button>
        </div>
      </div>
    </div>
  );
}
