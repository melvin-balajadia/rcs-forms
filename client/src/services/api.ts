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
        setAuthToken(newAccessToken, getAuth().user);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        return api(originalRequest);
      } catch (refreshError) {
        clearAuthToken();
        return Promise.reject(refreshError);
      }
    }

    // ✅ Case 3: All other errors → propagate
    return Promise.reject(error);
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
