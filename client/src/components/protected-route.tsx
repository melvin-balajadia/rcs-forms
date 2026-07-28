// components/ProtectedRoute.tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { usePersistLogin } from "@/hooks/userPersistLogin";

export default function ProtectedRoute() {
  const { accessToken } = useAuth();
  const { loading } = usePersistLogin();

  if (loading) {
    return <div>Loading session...</div>; // avoid blank screen
  }

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />; // ✅ renders nested routes
}
