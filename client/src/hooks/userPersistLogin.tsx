import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

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
    user_groups: string[]; // ✅ added
  } | null;
};

export function usePersistLogin() {
  const { accessToken, setAuth, clearAuth } = useAuth();
  const [loading, setLoading] = useState(true);

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
            user_groups: res.data.user.user_groups, // ✅ added
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

  return { loading };
}
