import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiPost, apiPut, apiDelete } from "@/services/api";

export const useFetch = <T>(key: string[], url: string) => {
  return useQuery<T>({
    queryKey: key,
    queryFn: () => apiGet<T>(url),
  });
};

export const useCreate = <T, TVariables = any>(
  key: string[],
  url: string,
  onSuccess?: (data: T) => void,
  onError?: (message: string) => void
) => {
  const queryClient = useQueryClient();

  return useMutation<T, any, TVariables>({
    mutationFn: (data: TVariables) => apiPost<T>(url, data),

    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: key });
      if (onSuccess) {
        onSuccess(data);
      } else {
        toast.success("Create Successful", {
          description: "Your record has been created.",
        });
      }
    },

    onError: (error: any) => {
      let backendMessage =
        error?.response?.data?.ErrorMessage ||
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Failed to create.";

      if (onError) {
        onError(backendMessage);
      } else {
        toast.error("Creation Failed", {
          description: backendMessage,
          action: { label: "Close", onClick: () => toast.dismiss() },
        });
      }

      console.error("Error during creation:", error);
    },
  });
};

export const useUpdate = <T>(
  key: string[],
  url: string,
  onSuccess?: (data: T) => void,
  onError?: (message: string) => void
) => {
  const queryClient = useQueryClient();

  return useMutation<T, any, any>({
    mutationFn: (data: any) => apiPut<T>(url, data),

    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: key });
      if (onSuccess) {
        onSuccess(data);
      } else {
        toast.success("Update Successful", {
          description: "The record was updated successfully.",
        });
      }
    },

    onError: (error: any) => {
      const backendMessage =
        error?.response?.data?.ErrorMessage ||
        error?.response?.data?.message ||
        error?.message ||
        "An unexpected error occurred.";

      toast.error("Update Failed", {
        description: backendMessage,
        action: { label: "Close", onClick: () => toast.dismiss() },
      });

      if (onError) onError(backendMessage);
    },
  });
};

export const useDelete = <T>(
  key: string[],
  url: string,
  onSuccess?: (data: T) => void,
  onError?: (message: string) => void
) => {
  const queryClient = useQueryClient();

  return useMutation<T, any, void>({
    mutationFn: () => apiDelete<T>(url),

    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: key });
      if (onSuccess) {
        onSuccess(data);
      } else {
        toast.success("Delete Successful", {
          description: "The record was deleted.",
        });
      }
    },

    onError: (error: any) => {
      const backendMessage =
        error?.response?.data?.ErrorMessage ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to delete.";

      if (onError) {
        onError(backendMessage);
      } else {
        toast.error("Delete Failed", {
          description: backendMessage,
        });
      }
    },
  });
};
