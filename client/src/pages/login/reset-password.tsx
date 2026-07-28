import Button from "../../components/button";
import TextField from "../../components/textfield";
import React, { useState } from "react";
import logo2 from "../../assets/logo2.png";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "@/services/api";
import { toast } from "sonner";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import Spinner from "@/components/spinner";

type ResetPasswordRequest = {
  userId: number;
  newPassword: string;
  confirmPassword: string;
};

type ResetPasswordResponse = {
  errorStatus: boolean;
  message?: string;
};

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const userId = location.state?.userId as number;

  const [form, setForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const resetMutation = useMutation({
    mutationFn: (payload: ResetPasswordRequest) =>
      apiPost<ResetPasswordResponse>("/auth/reset-password", payload),

    onSuccess: (data: ResetPasswordResponse) => {
      if (data.errorStatus) {
        toast.error("Reset Failed", {
          description: data.message ?? "Something went wrong",
          action: { label: "Close", onClick: () => toast.dismiss() },
        });
        return;
      }

      toast.success("Password Updated", {
        description: "Please log in with your new password",
      });

      navigate("/login");
    },

    onError: (error: any) => {
      const backendMessage =
        error?.response?.data?.ErrorMessage ||
        error?.response?.data?.message ||
        error?.message ||
        "Reset failed";

      toast.error("Reset Failed", { description: backendMessage });
    },
  });

  if (!userId) {
    return <Navigate to="/login" replace />;
  }

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    resetMutation.mutate({ userId, ...form });
  };

  return (
    <div className="h-svh overflow-hidden bg-gray-100 flex items-center justify-center p-4">
      {/* Inner scroll (overflow-y-auto) is a fallback if content overflows on tiny screens */}
      <div
        className="
          bg-white rounded-xl shadow-lg
          w-full max-w-sm
          sm:max-w-md
          md:max-w-lg
          flex flex-col items-center
          overflow-y-auto
          px-5 py-6
          sm:px-8 sm:py-8
          gap-4
        "
      >
        {/* Logo — scales down on mobile */}
        <div className="flex justify-center w-full">
          <img
            src={logo2}
            alt="Logo"
            className="
              w-32 h-auto object-contain
              sm:w-44
              md:w-56
            "
          />
        </div>

        {/* Heading */}
        <div className="text-center">
          <h2 className="text-sm font-semibold text-gray-800 sm:text-base md:text-lg">
            Set a New Password
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Your account is using the default password. Please set a new one
            before continuing.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 items-center w-full"
        >
          <div className="w-full">
            <TextField
              label="New Password"
              type="password"
              placeholder="Enter new password"
              variant="textFieldLogin"
              value={form.newPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleChange("newPassword", e.target.value)
              }
            />
          </div>

          <div className="w-full">
            <TextField
              label="Confirm Password"
              type="password"
              placeholder="Confirm new password"
              variant="textFieldLogin"
              value={form.confirmPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleChange("confirmPassword", e.target.value)
              }
            />
          </div>

          <p className="text-xs text-gray-400 w-full">
            Must be at least 8 characters with an uppercase letter, a number,
            and a special character.
          </p>

          <div className="w-full">
            <Button
              type="submit"
              variant="buttonLogin"
              className="w-full flex items-center justify-center whitespace-nowrap"
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending ? <Spinner /> : "Update Password"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
