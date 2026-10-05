import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getAuth } from "@/context/AuthContext";
import { canAccess } from "@/config/routePermissions";

export default function RoleProtectedRoute() {
  const { user } = getAuth();
  const { pathname } = useLocation();

  // ✅ AuthWrapper already waits for the session check before this mounts.
  // If user is not loaded yet, don't block
  if (!user) return <Outlet />;

  const userRoles: string[] = Array.isArray(user?.user_groups)
    ? user.user_groups
    : [];

  if (!canAccess(pathname, userRoles)) {
    return <Navigate to="/not-authorized" replace />;
  }

  return <Outlet />;
}
