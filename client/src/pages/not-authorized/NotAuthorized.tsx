import { LuShieldX } from "react-icons/lu";
import Button from "@/components/button";

export default function NotAuthorized() {
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 text-center">
      <LuShieldX className="text-6xl text-red-400" />
      <h1 className="text-2xl font-semibold text-gray-800">Access Denied</h1>
      <p className="text-gray-500 max-w-sm">
        You don't have permission to view this page. Please contact your
        administrator if you think this is a mistake.
      </p>
      <Button
        variant="buttonMain"
        onClick={() => {
          window.location.href = "/dashboard"; // ✅ force full reload
        }}
      >
        Go to Dashboard
      </Button>
    </div>
  );
}
