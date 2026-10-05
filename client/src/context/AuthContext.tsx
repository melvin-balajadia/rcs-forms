// context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import api from "@/services/api";

type UserType = {
  id: number;
  fullname: string;
  site: string;
  email: string;
  contact: string;
  department: string;
  user_groups: string[]; // ✅ Changed from string to string[]
} | null;

type AuthContextType = {
  accessToken: string | null;
  user: UserType;
  loading: boolean;
  setAuth: (token: string, user: UserType) => void;
  clearAuth: () => void;
};

type RefreshResponse = {
  accessToken: string | null;
  user: {
    id: number;
    username: string;
    fullname: string;
    email: string;
    site: string;
    contact: string;
    department: string;
    user_groups: string[];
  } | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let _accessToken: string | null = null;
let _user: UserType = null;

export const getAuth = () => ({ accessToken: _accessToken, user: _user });
export const setAuthToken = (token: string, userInfo: UserType) => {
  _accessToken = token;
  _user = userInfo;
};
export const clearAuthToken = () => {
  _accessToken = null;
  _user = null;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserType>(null);
  const [loading, setLoading] = useState(true);

  const setAuth = (token: string, userInfo: UserType) => {
    setAccessToken(token);
    setUser(userInfo);
    setAuthToken(token, userInfo); // sync singleton
  };

  const clearAuth = () => {
    setAccessToken(null);
    setUser(null);
    clearAuthToken();
  };

  // ✅ Runs once for the whole app so every consumer shares one session check
  useEffect(() => {
    let isMounted = true;

    const verifyRefreshToken = async () => {
      try {
        const res = await api.post<RefreshResponse>(
          "/auth/refresh-token",
          {},
          { withCredentials: true },
        );

        // ✅ If no token returned (no cookie), just stop loading — don't clear auth
        if (!res.data?.accessToken || !res.data?.user) {
          if (isMounted) setLoading(false);
          return;
        }

        if (isMounted) {
          setAuth(res.data.accessToken, {
            id: res.data.user.id,
            fullname: res.data.user.fullname,
            email: res.data.user.email,
            site: res.data.user.site,
            contact: res.data.user.contact,
            department: res.data.user.department,
            user_groups: res.data.user.user_groups,
          });
        }
      } catch (err: any) {
        if (isMounted) {
          if (err?.response?.status !== 401) {
            clearAuth();
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (!accessToken) {
      verifyRefreshToken();
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{ accessToken, user, loading, setAuth, clearAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
