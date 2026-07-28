// context/AuthContext.tsx
import React, { createContext, useContext, useState } from "react";

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
  setAuth: (token: string, user: UserType) => void;
  clearAuth: () => void;
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

  return (
    <AuthContext.Provider value={{ accessToken, user, setAuth, clearAuth }}>
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
