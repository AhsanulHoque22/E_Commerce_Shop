import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import { useAuthUi } from "@/store/authUi";
import { useSession } from "@/hooks/useSession";
import {
  AddressMapPicker,
  type MapAddress,
} from "@/components/AddressMapPicker";
import { PasswordInput } from "@/components/PasswordInput";
import { loadFacebookSdk } from "@/utils/loadFacebookSdk";
import {
  buildE164,
  DEFAULT_DIAL,
  isPlausibleE164,
  PHONE_DIAL_OPTIONS,
} from "@/utils/phoneE164";

type Mode = "login" | "register" | "forgot";

export function LoginModal() {
  const { loginOpen, closeLogin, pendingCart } = useAuthUi();
  const qc = useQueryClient();
  const { refetch } = useSession();
  const [mode, setMode] = useState<Mode>("login");

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [email, setEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPasswordConfirm, setRegPasswordConfirm] = useState("");
  const [phoneDial, setPhoneDial] = useState(DEFAULT_DIAL);
  const [phoneLocal, setPhoneLocal] = useState("");
  const regFullPhone = useMemo(
    () => buildE164(phoneDial, phoneLocal),
    [phoneDial, phoneLocal]
  );
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpDevHint, setOtpDevHint] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [consent, setConsent] = useState(false);
  const [sameAsPermanentForPresent, setSameAsPermanentForPresent] =
    useState(false);
  const [samePresentForDelivery, setSamePresentForDelivery] = useState(false);
  const [permanent, setPermanent] = useState<MapAddress | null>(null);
  const [present, setPresent] = useState<MapAddress | null>(null);
  const [delivery, setDelivery] = useState<MapAddress | null>(null);

  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const googleBtnRef = useRef<HTMLDivElement>(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
  const facebookAppId = import.meta.env.VITE_FACEBOOK_APP_ID ?? "";

  const afterAuthSuccess = useCallback(async () => {
    setError(null);
    await qc.invalidateQueries({ queryKey: ["me"] });
    await refetch();
    if (pendingCart) {
      await apiFetch("/api/cart/items", {
        method: "POST",
        body: JSON.stringify({
          productPublicId: pendingCart.productPublicId,
          quantity: pendingCart.quantity,
        }),
      });
      await qc.invalidateQueries({ queryKey: ["cart"] });
    }
    closeLogin();
  }, [qc, refetch, pendingCart, closeLogin]);

  const loginMut = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
      }),
    onSuccess: () => void afterAuthSuccess(),
    onError: (e: Error) => setError(e.message),
  });

  const otpMut = useMutation({
    mutationFn: () =>
      apiFetch<{ sent: boolean; devCode?: string }>("/api/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ phone: regFullPhone }),
      }),
    onSuccess: (data) => {
      setError(null);
      setOtpSent(true);
      setOtpDevHint(data.devCode ? `Dev code: ${data.devCode}` : null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const regMut = useMutation({
    mutationFn: () => {
      if (regPassword !== regPasswordConfirm) {
        throw new Error("Passwords do not match.");
      }
      if (!permanent) {
        throw new Error("Set your permanent address on the map or manually.");
      }
      return apiFetch<{ user: { publicId: string } }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email,
          password: regPassword,
          phone: regFullPhone,
          otpCode,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          consent,
          sameAsPermanentForPresent,
          samePresentForDelivery,
          permanentAddress: permanent,
          presentAddress: sameAsPermanentForPresent ? undefined : present,
          deliveryAddress: samePresentForDelivery ? undefined : delivery,
        }),
      });
    },
    onSuccess: () => void afterAuthSuccess(),
    onError: (e: Error) => setError(e.message),
  });

  const forgotMut = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean; message?: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: forgotEmail }),
      }),
    onSuccess: (data) => {
      setForgotMsg(
        data.message ??
          "If an account exists, check your email or the server log for the reset link."
      );
    },
    onError: (e: Error) => setForgotMsg(e.message),
  });

  const googleMut = useMutation({
    mutationFn: (idToken: string) =>
      apiFetch<{ user: { publicId: string } }>("/api/auth/google", {
        method: "POST",
        body: JSON.stringify({ idToken }),
      }),
    onSuccess: () => void afterAuthSuccess(),
    onError: (e: Error) => setError(e.message),
  });

  const facebookMut = useMutation({
    mutationFn: (accessToken: string) =>
      apiFetch<{ user: { publicId: string } }>("/api/auth/facebook", {
        method: "POST",
        body: JSON.stringify({ accessToken }),
      }),
    onSuccess: () => void afterAuthSuccess(),
    onError: (e: Error) => setError(e.message),
  });

  const googleMutRef = useRef(googleMut);
  googleMutRef.current = googleMut;

  useEffect(() => {
    if (!loginOpen || mode !== "login" || !googleClientId || !googleBtnRef.current) {
      return;
    }
    const el = googleBtnRef.current;
    el.innerHTML = "";

    const init = () => {
      const host = googleBtnRef.current;
      if (!window.google?.accounts?.id || !host) {
        return;
      }
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (res: { credential: string }) => {
          googleMutRef.current.mutate(res.credential);
        },
      });
      window.google.accounts.id.renderButton(host, {
        theme: "outline",
        size: "large",
        width: "100%",
        text: "continue_with",
      });
    };

    if (window.google?.accounts?.id) {
      init();
      return;
    }

    let script = document.querySelector(
      'script[data-shop-gis="1"]'
    ) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.dataset.shopGis = "1";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      document.head.appendChild(script);
    }
    if (window.google?.accounts?.id) {
      init();
    } else {
      script.addEventListener("load", init, { once: true });
    }
  }, [loginOpen, mode, googleClientId]);

  async function onFacebookClick() {
    setError(null);
    if (!facebookAppId) {
      setError("Facebook sign-in is not configured.");
      return;
    }
    try {
      await loadFacebookSdk(facebookAppId);
      window.FB!.login(
        (response) => {
          const t = response.authResponse?.accessToken;
          if (t) {
            facebookMut.mutate(t);
          } else if (response.status === "not_authorized" || !response.authResponse) {
            setError("Facebook login was cancelled.");
          }
        },
        { scope: "email" }
      );
    } catch {
      setError("Could not load Facebook.");
    }
  }

  useEffect(() => {
    if (!loginOpen) {
      setMode("login");
      setError(null);
      setOtpSent(false);
      setOtpDevHint(null);
      setForgotMsg(null);
      setRegPasswordConfirm("");
      setPhoneDial(DEFAULT_DIAL);
      setPhoneLocal("");
    }
  }, [loginOpen]);

  if (!loginOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-card"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-xl font-semibold">
            {mode === "login" && "Sign in"}
            {mode === "register" && "Create account"}
            {mode === "forgot" && "Forgot password"}
          </h2>
          <button
            type="button"
            className="text-sm text-muted hover:text-ink"
            onClick={closeLogin}
          >
            Close
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">
          {mode === "login" &&
            "Sign in with your email or phone number and password, or use Google or Facebook."}
          {mode === "register" &&
            "Phone verification is required. You can reuse addresses with the checkboxes below."}
          {mode === "forgot" &&
            "We will email a reset link if an account exists (check server logs in development)."}
        </p>

        {mode === "login" && (
          <div className="mt-6 space-y-4">
            <form
              className="space-y-4"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                const id = identifier.trim();
                if (!id) {
                  setError("Enter your email or phone number.");
                  return;
                }
                if (id.length < 3) {
                  setError("Enter a valid email or phone number.");
                  return;
                }
                if (!password) {
                  setError("Enter your password.");
                  return;
                }
                loginMut.mutate();
              }}
            >
              <div>
                <label className="block text-sm font-medium" htmlFor="id">
                  Email or phone
                </label>
                <input
                  id="id"
                  name="username"
                  autoComplete="username"
                  className="mt-1 w-full rounded-xl border border-border px-3 py-3 text-base outline-none focus:ring-2 focus:ring-accent"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="you@example.com or +8801…"
                />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-sm font-medium" htmlFor="pw">
                    Password
                  </label>
                  <button
                    type="button"
                    className="text-xs font-medium text-accent hover:underline"
                    onClick={() => {
                      setMode("forgot");
                      setForgotMsg(null);
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <PasswordInput
                  id="pw"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={setPassword}
                />
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <button
                type="submit"
                disabled={loginMut.isPending}
                className="min-h-11 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
              >
                {loginMut.isPending ? "Signing in…" : "Sign in"}
              </button>
            </form>
            {googleClientId ? (
              <div>
                <p className="text-center text-xs text-muted">or</p>
                <div
                  ref={googleBtnRef}
                  className="mt-2 flex min-h-[44px] justify-center"
                />
              </div>
            ) : null}
            {facebookAppId ? (
              <button
                type="button"
                onClick={() => void onFacebookClick()}
                disabled={facebookMut.isPending}
                className="w-full rounded-xl border border-border bg-[#1877F2] py-3 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
              >
                {facebookMut.isPending ? "Connecting…" : "Continue with Facebook"}
              </button>
            ) : null}
          </div>
        )}

        {mode === "forgot" && (
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setForgotMsg(null);
              forgotMut.mutate();
            }}
          >
            <div>
              <label className="block text-sm font-medium" htmlFor="fe">
                Email
              </label>
              <input
                id="fe"
                type="email"
                required
                autoComplete="email"
                className="mt-1 w-full rounded-xl border border-border px-3 py-3 outline-none focus:ring-2 focus:ring-accent"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
              />
            </div>
            {forgotMsg ? (
              <p className="text-sm text-green-700 dark:text-green-400">{forgotMsg}</p>
            ) : null}
            <button
              type="submit"
              disabled={forgotMut.isPending}
              className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {forgotMut.isPending ? "Sending…" : "Send reset link"}
            </button>
            <button
              type="button"
              className="w-full text-sm text-accent hover:underline"
              onClick={() => setMode("login")}
            >
              Back to sign in
            </button>
          </form>
        )}

        {mode === "register" && (
          <form
            className="mt-6 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              if (!consent) {
                setError("Please accept the privacy policy to continue.");
                return;
              }
              if (!otpSent) {
                setError("Request a verification code for your phone first.");
                return;
              }
              if (!permanent) {
                setError("Please set your permanent address.");
                return;
              }
              if (!sameAsPermanentForPresent && !present) {
                setError("Please set your present address or use same as permanent.");
                return;
              }
              if (!samePresentForDelivery && !delivery) {
                setError("Please set delivery address or use same as present.");
                return;
              }
              if (regPassword !== regPasswordConfirm) {
                setError("Passwords do not match.");
                return;
              }
              regMut.mutate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium" htmlFor="fn">
                  First name
                </label>
                <input
                  id="fn"
                  className="mt-1 w-full rounded-xl border border-border px-3 py-3 outline-none focus:ring-2 focus:ring-accent"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium" htmlFor="ln">
                  Last name
                </label>
                <input
                  id="ln"
                  className="mt-1 w-full rounded-xl border border-border px-3 py-3 outline-none focus:ring-2 focus:ring-accent"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor="ph-local">
                Phone (required, verified)
              </label>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <select
                  id="ph-cc"
                  aria-label="Country calling code"
                  className="w-full shrink-0 rounded-xl border border-border bg-bg px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-accent sm:max-w-[220px]"
                  value={phoneDial}
                  onChange={(e) => setPhoneDial(e.target.value)}
                >
                  {PHONE_DIAL_OPTIONS.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <input
                  id="ph-local"
                  required
                  autoComplete="tel-national"
                  inputMode="tel"
                  className="min-w-0 flex-1 rounded-xl border border-border px-3 py-3 outline-none focus:ring-2 focus:ring-accent"
                  value={phoneLocal}
                  onChange={(e) => setPhoneLocal(e.target.value)}
                  placeholder={
                    phoneDial === "+880"
                      ? "17XXXXXXXX (without +880)"
                      : "Mobile number (without country code)"
                  }
                />
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    if (!isPlausibleE164(regFullPhone)) {
                      setError("Enter a valid phone number (country code + mobile number).");
                      return;
                    }
                    otpMut.mutate();
                  }}
                  disabled={otpMut.isPending || !isPlausibleE164(regFullPhone)}
                  className="shrink-0 rounded-xl border border-border bg-bg px-4 py-3 text-sm font-medium hover:bg-surface disabled:opacity-50"
                >
                  {otpMut.isPending ? "Sending…" : "Send code"}
                </button>
              </div>
              {regFullPhone ? (
                <p className="mt-1 text-xs text-muted">
                  Full number: <span className="font-mono text-ink">{regFullPhone}</span>
                </p>
              ) : null}
              {otpDevHint ? (
                <p className="mt-1 text-xs text-amber-700">{otpDevHint}</p>
              ) : null}
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor="otp">
                Verification code
              </label>
              <input
                id="otp"
                required
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                className="mt-1 w-full rounded-xl border border-border px-3 py-3 outline-none focus:ring-2 focus:ring-accent"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit SMS code"
              />
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor="em">
                Email
              </label>
              <input
                id="em"
                type="email"
                required
                autoComplete="email"
                className="mt-1 w-full rounded-xl border border-border px-3 py-3 outline-none focus:ring-2 focus:ring-accent"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor="rpw">
                Password
              </label>
              <PasswordInput
                id="rpw"
                required
                minLength={8}
                autoComplete="new-password"
                value={regPassword}
                onChange={setRegPassword}
              />
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor="rpw2">
                Confirm password
              </label>
              <PasswordInput
                id="rpw2"
                required
                minLength={8}
                autoComplete="new-password"
                value={regPasswordConfirm}
                onChange={setRegPasswordConfirm}
              />
            </div>

            <AddressMapPicker
              label="Permanent address"
              value={permanent}
              onChange={setPermanent}
            />

            <label className="flex items-start gap-3 text-sm text-muted">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border text-accent"
                checked={sameAsPermanentForPresent}
                onChange={(e) => {
                  setSameAsPermanentForPresent(e.target.checked);
                  if (e.target.checked) {
                    setPresent(null);
                  }
                }}
              />
              <span>Present address is the same as permanent address</span>
            </label>
            {!sameAsPermanentForPresent ? (
              <AddressMapPicker
                label="Present address"
                value={present}
                onChange={setPresent}
              />
            ) : null}

            <label className="flex items-start gap-3 text-sm text-muted">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border text-accent"
                checked={samePresentForDelivery}
                onChange={(e) => {
                  setSamePresentForDelivery(e.target.checked);
                  if (e.target.checked) {
                    setDelivery(null);
                  }
                }}
              />
              <span>Delivery address is the same as present address</span>
            </label>
            {!samePresentForDelivery ? (
              <AddressMapPicker
                label="Delivery address"
                value={delivery}
                onChange={setDelivery}
              />
            ) : null}

            <label className="flex items-start gap-3 text-sm text-muted">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border text-accent"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                I have read the privacy policy and agree to the collection of my personal data.
              </span>
            </label>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={regMut.isPending}
              className="min-h-11 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
            >
              {regMut.isPending ? "Creating…" : "Create account"}
            </button>
          </form>
        )}

        {mode !== "forgot" ? (
          <button
            type="button"
            className="mt-4 w-full text-center text-sm text-accent hover:underline"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
          >
            {mode === "login"
              ? "New here? Create an account"
              : "Already have an account? Sign in"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
