// components/ProtectedRoute.tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute() {
  const { accessToken } = useAuth();

  // ✅ AuthWrapper already blocks rendering until the session check resolves,
  // so accessToken is always settled by the time this mounts.
  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />; // ✅ renders nested routes
}
