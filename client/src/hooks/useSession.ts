import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";

export type SessionUser = {
  publicId: string;
  email: string;
  role: "CUSTOMER" | "ADMIN";
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  phoneVerifiedAt: string | null;
};

export function useSession() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["me"],
    queryFn: () =>
      apiFetch<{ user: SessionUser | null }>("/api/auth/me"),
  });
  return {
    user: q.data?.user ?? null,
    loading: q.isLoading,
    refetch: q.refetch,
    clearSession: () => {
      void qc.invalidateQueries({ queryKey: ["me"] });
    },
    logout: async () => {
      await apiFetch<{ ok: boolean }>("/api/auth/logout", {
        method: "POST",
        body: JSON.stringify({}),
      });
      qc.setQueryData(["me"], { user: null });
    },
  };
}
