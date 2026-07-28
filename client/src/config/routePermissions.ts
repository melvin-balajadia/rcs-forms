export type UserRole = "requestor" | "approver" | "all_access" | "qfd_admin"; // ✅ added

export const routePermissions: Record<string, UserRole[]> = {
  "/": ["requestor", "approver", "all_access", "qfd_admin"],
  "/dashboard": ["requestor", "approver", "all_access", "qfd_admin"],
  "/forms": ["all_access", "qfd_admin"],
  "/form-entry": ["requestor", "approver", "all_access", "qfd_admin"],
  "/reports": ["all_access", "qfd_admin"],
  "/clients": ["all_access", "qfd_admin"],
  "/rooms": ["all_access", "qfd_admin"],
  "/user-management": ["all_access"],
  "/group-management": ["all_access"],
};

export const canAccess = (pathname: string, userRoles: string[]): boolean => {
  // ✅ Both all_access and qfd_admin can go anywhere
  if (userRoles.includes("all_access")) return true;

  const matchedKey = Object.keys(routePermissions)
    .filter((key) => key !== "/")
    .sort((a, b) => b.length - a.length)
    .find((key) => pathname.startsWith(key));

  const key = matchedKey ?? "/";
  const allowedRoles = routePermissions[key] ?? [];

  return userRoles.some((role) => allowedRoles.includes(role as UserRole));
};
