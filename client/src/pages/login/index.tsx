import Button from "../../components/button";
import TextField from "../../components/textfield";
import React, { useState } from "react";
import logo2 from "../../assets/logo2.png";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "@/services/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

type LoginRequest = {
  user_username: string;
  user_password: string;
};

type LoginResponse = {
  errorStatus: boolean;
  requiresReset?: boolean;
  message?: string;
  userSite?: string;
  userId?: number;
  userFullname?: string;
  userEmail?: string;
  userContact?: string;
  userDepartment?: string;
  userGroups?: string[];
  accessToken?: string;
};

export default function LoginPage() {
  const [form, setForm] = useState<LoginRequest>({
    user_username: "",
    user_password: "",
  });

  const navigate = useNavigate();
  const { setAuth } = useAuth();

  const { mutate: login, isPending } = useMutation<
    LoginResponse,
    any,
    LoginRequest
  >({
    mutationFn: (credentials) =>
      apiPost<LoginResponse>("/auth/login", credentials),

    onSuccess: (data) => {
      if (data.errorStatus) {
        toast.error("Login Failed", {
          description: data.message ?? "Invalid credentials",
          action: { label: "Close", onClick: () => toast.dismiss() },
        });
        return;
      }

      if (data.requiresReset) {
        navigate("/reset-password", { state: { userId: data.userId } });
        return;
      }

      setAuth(data.accessToken ?? "", {
        id: data.userId!,
        fullname: data.userFullname ?? "",
        site: data.userSite ?? "",
        email: data.userEmail ?? "",
        contact: data.userContact ?? "",
        department: data.userDepartment ?? "",
        user_groups: data.userGroups ?? [],
      });

      toast.success("Login Successful", {
        description: `Welcome back, ${data.userFullname}`,
      });

      navigate("/");
    },

    onError: (error: any) => {
      const backendMessage =
        error?.response?.data?.ErrorMessage ||
        error?.response?.data?.message ||
        error?.message ||
        "Login failed";

      toast.error("Login Failed", { description: backendMessage });
    },
  });

  const handleChange = (field: keyof LoginRequest, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login(form);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-lg flex flex-col gap-6 w-[35rem] h-[30rem] max-w-full items-center -mt-30">
        {/* Logo */}
        <div className="flex justify-center">
          <img src={logo2} alt="Logo" className="w-60 h-30 object-contain" />
        </div>

        {/* Input Fields & Button */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 items-center w-full"
        >
          <div className="w-full max-w-[25rem]">
            <TextField
              label="Username"
              placeholder="Enter your username"
              variant="textFieldLogin"
              value={form.user_username}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleChange("user_username", e.target.value)
              }
            />
          </div>

          <div className="w-full max-w-[25rem]">
            <TextField
              label="Password"
              type="password"
              placeholder="Enter your password"
              variant="textFieldLogin"
              value={form.user_password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleChange("user_password", e.target.value)
              }
            />
          </div>

          <div className="w-full max-w-[25rem] mt-2">
            <Button
              type="submit"
              variant="buttonLogin"
              className="w-full flex items-center justify-center"
              disabled={isPending}
            >
              Login
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
