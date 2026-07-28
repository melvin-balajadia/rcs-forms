import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getAuth } from "@/context/AuthContext";
import { canAccess } from "@/config/routePermissions";
import { usePersistLogin } from "@/hooks/userPersistLogin";

export default function RoleProtectedRoute() {
  const { user } = getAuth();
  const { pathname } = useLocation();
  const { loading } = usePersistLogin();

  // ✅ Wait for session to load before checking roles
  if (loading) return <div>Loading session...</div>;

  // ✅ If user is not loaded yet, don't block
  if (!user) return <Outlet />;

  const userRoles: string[] = Array.isArray(user?.user_groups)
    ? user.user_groups
    : [];

  if (!canAccess(pathname, userRoles)) {
    return <Navigate to="/not-authorized" replace />;
  }

  return <Outlet />;
}
