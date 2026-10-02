import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/services/api";
import { useAuth } from "@/context/AuthContext";

// Archiving hides a record everywhere but never deletes it. Only qfd_admin and
// all_access may archive (the server enforces this too).

type ArchiveKind =
  | "form"
  | "formEntry"
  | "savedReport"
  | "client"
  | "room"
  | "user"; // all_access only (User Management)

type ArchiveConfig = {
  request: (id: string) => Promise<unknown>;
  one: string;
  many: string;
  // Lists to refresh afterwards (React Query key prefixes)
  refresh: string[][];
};

const ARCHIVE: Record<ArchiveKind, ArchiveConfig> = {
  form: {
    request: (id) => api.put(`/forms/archive/${id}`),
    one: "form",
    many: "forms",
    refresh: [["forms"]],
  },
  formEntry: {
    request: (id) => api.put(`/form-entries/archive/${id}`),
    one: "entry",
    many: "entries",
    refresh: [["formEntries"], ["dashboard"], ["dashboard-charts"]],
  },
  savedReport: {
    request: (id) => api.delete(`/saved-reports/${id}`),
    one: "report",
    many: "reports",
    refresh: [["saved-reports"]],
  },
  client: {
    request: (id) => api.put(`/clients/archive/${id}`),
    one: "client",
    many: "clients",
    refresh: [["clients"]],
  },
  room: {
    request: (id) => api.put(`/rooms/archive/${id}`),
    one: "room",
    many: "rooms",
    refresh: [["rooms"]],
  },
  // Also ends the user's sessions and deactivates their approver assignments
  user: {
    request: (id) => api.put(`/users/archive/${id}`),
    one: "user",
    many: "users",
    refresh: [["user-management"], ["approver-eligible-users"]],
  },
};

export const ARCHIVE_ROLES = ["qfd_admin", "all_access"];

export function useCanArchive(): boolean {
  const { user } = useAuth();
  const roles = Array.isArray(user?.user_groups) ? user.user_groups : [];
  return roles.some((r) => ARCHIVE_ROLES.includes(r));
}

export const archiveNoun = (kind: ArchiveKind, count: number) =>
  count === 1 ? ARCHIVE[kind].one : ARCHIVE[kind].many;

// Returns archive(ids): archives each record, reports the outcome in a toast
// and refreshes the affected lists. Resolves with how many succeeded.
export function useArchive(kind: ArchiveKind) {
  const queryClient = useQueryClient();
  const config = ARCHIVE[kind];

  return async (ids: string[]): Promise<number> => {
    const results = await Promise.allSettled(ids.map((id) => config.request(id)));
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - succeeded;

    await Promise.all(
      config.refresh.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );

    if (succeeded > 0) {
      toast.success(
        `Archived ${succeeded} ${archiveNoun(kind, succeeded)}`,
        { description: "Hidden from lists, reports and the dashboard. Nothing was deleted." },
      );
    }
    if (failed > 0) {
      toast.error(`Couldn't archive ${failed} ${archiveNoun(kind, failed)}`, {
        description: "It may already be archived, or you may not have permission.",
      });
    }
    return succeeded;
  };
}
