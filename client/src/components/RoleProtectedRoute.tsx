import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { canAccess } from "@/config/routePermissions";

export default function RoleProtectedRoute() {
  // useAuth (not getAuth) so the check re-runs when the user changes
  const { user } = useAuth();
  const { pathname } = useLocation();

  // AuthWrapper waits for the session check, and ProtectedRoute requires a
  // session, so a missing user here means the session is unusable: send them
  // to log in rather than letting them through unchecked.
  if (!user) return <Navigate to="/login" replace />;

  const userRoles: string[] = Array.isArray(user.user_groups)
    ? user.user_groups
    : [];

  if (!canAccess(pathname, userRoles)) {
    return <Navigate to="/not-authorized" replace />;
  }

  return <Outlet />;
}
