import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";

export function SupportPage() {
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [ticket, setTicket] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () =>
      apiFetch<{ publicId: string }>("/api/complaints", {
        method: "POST",
        body: JSON.stringify({ email, subject, message }),
      }),
    onSuccess: (d) => setTicket(d.publicId),
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-3xl font-semibold">Support</h1>
      <p className="mt-2 text-sm text-muted">Submit a complaint or question.</p>
      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          mut.mutate();
        }}
      >
        <input
          className="w-full rounded-xl border border-border px-3 py-3"
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full rounded-xl border border-border px-3 py-3"
          required
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <textarea
          className="min-h-32 w-full rounded-xl border border-border px-3 py-3"
          required
          placeholder="Message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button
          type="submit"
          className="min-h-11 w-full rounded-xl bg-accent py-3 font-semibold text-white"
        >
          Submit
        </button>
      </form>
      {ticket && <p className="mt-4 text-sm">Ticket: {ticket}</p>}
    </div>
  );
}
