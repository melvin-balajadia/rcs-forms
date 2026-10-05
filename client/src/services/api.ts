import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
} from "axios";
import { getAuth, setAuthToken, clearAuthToken } from "@/context/AuthContext";

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// 🔹 Request interceptor: attach access token
api.interceptors.request.use(
  (config) => {
    const { accessToken } = getAuth();
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Errors reach page code that often logs them whole (console.error(err)), and
// an Axios error carries the request: its Authorization header (the bearer
// token) and its body (e.g. a password). Strip both before handing it on.
const redact = (error: unknown) => {
  const config = (error as AxiosError)?.config;
  if (config) {
    if (config.headers) delete config.headers.Authorization;
    if (config.data !== undefined) config.data = "[redacted]";
  }
  return error;
};

// 🔹 Response interceptor: auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };

    // ✅ Case 1: Refresh endpoint itself failed → ignore silently
    if (
      error.response?.status === 401 &&
      originalRequest?.url?.includes("/auth/refresh-token")
    ) {
      // Don’t throw, just return the response (prevents console spam)
      return Promise.resolve(error.response);
    }

    // ✅ Case 2: Some other endpoint failed with 401 → try refresh once
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const res = await axios.post<{ accessToken: string }>(
          `${import.meta.env.VITE_API_URL}/api/auth/refresh-token`,
          {},
          { withCredentials: true }
        );

        const newAccessToken = res.data.accessToken;
        // No cookie: the session is gone
        if (!newAccessToken) throw new Error("Session expired");
        setAuthToken(newAccessToken, getAuth().user);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        return api(originalRequest);
      } catch (refreshError) {
        // The server ended the session (password reset, role change, archived
        // account). Reload on the login page so no stale user state remains.
        clearAuthToken();
        window.location.replace("/login");
        return Promise.reject(redact(refreshError));
      }
    }

    // ✅ Case 3: All other errors → propagate (without token or body)
    return Promise.reject(redact(error));
  }
);

// 🔹 Generic CRUD wrappers with proper AxiosResponse typing
export const apiGet = async <T>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> => {
  const res: AxiosResponse<T> = await api.get(url, config);
  return res.data;
};

export const apiPost = async <T>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<T> => {
  const res: AxiosResponse<T> = await api.post(url, data, config);
  return res.data;
};

export const apiPut = async <T>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<T> => {
  const res: AxiosResponse<T> = await api.put(url, data, config);
  return res.data;
};

export const apiDelete = async <T>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> => {
  const res: AxiosResponse<T> = await api.delete(url, config);
  return res.data;
};

export default api;
