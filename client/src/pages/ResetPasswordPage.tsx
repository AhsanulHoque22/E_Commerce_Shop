import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { PasswordInput } from "@/components/PasswordInput";
import { apiFetch } from "@/services/api";

export function ResetPasswordPage() {
  const [sp] = useSearchParams();
  const token = sp.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean }>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      }),
    onSuccess: () => {
      setMsg("Your password has been updated. You can sign in now.");
    },
    onError: (e: Error) => setMsg(e.message),
  });

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-2xl font-semibold">Reset password</h1>
      <p className="mt-2 text-sm text-muted">
        Choose a new password for your account.
      </p>
      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          if (password !== password2) {
            setMsg("Passwords do not match.");
            return;
          }
          if (!token) {
            setMsg("Invalid reset link.");
            return;
          }
          mut.mutate();
        }}
      >
        <div>
          <label className="block text-sm font-medium" htmlFor="np">
            New password
          </label>
          <PasswordInput
            id="np"
            minLength={8}
            required
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="np2">
            Confirm password
          </label>
          <PasswordInput
            id="np2"
            minLength={8}
            required
            autoComplete="new-password"
            value={password2}
            onChange={setPassword2}
          />
        </div>
        {msg ? (
          <p
            className={
              msg.includes("updated")
                ? "text-sm text-green-700"
                : "text-sm text-red-600"
            }
          >
            {msg}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={mut.isPending}
          className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
        >
          {mut.isPending ? "Saving…" : "Update password"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        <Link to="/" className="text-accent hover:underline">
          Back to shop
        </Link>
      </p>
    </div>
  );
}
