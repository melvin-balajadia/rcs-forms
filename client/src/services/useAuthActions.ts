import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiPost } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

export const useLogout = () => {
  const auth = useAuth();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async () => {
      // ✅ Include withCredentials to send cookies
      return await apiPost("/auth/logout", {}, { withCredentials: true });
    },
    onSuccess: () => {
      // ✅ Clear auth context
      auth.clearAuth();

      toast.success("Logged out successfully");
      navigate("/login");
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message || error?.message || "Logout failed.";
      toast.error("Logout Failed", { description: message });
    },
  });
};
