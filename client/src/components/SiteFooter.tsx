import type { ReactNode } from "react";

const WA = "8801834123393";
const PHONE_E164 = "+8801820223003";
const SUPPORT_EMAIL = "support@auroragadgets.test";

function IconWhatsApp({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={24}
      height={24}
      aria-hidden
      fill="currentColor"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function IconPhone({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={24}
      height={24}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}

function IconMapPin({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={24}
      height={24}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconShop({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={24}
      height={24}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="M10 12h4" />
      <path d="M12 12v9" />
    </svg>
  );
}

function IconFacebook({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={24}
      height={24}
      aria-hidden
      fill="currentColor"
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

type RowProps = {
  href?: string;
  icon: ReactNode;
  iconWrapClass: string;
  label: string;
  children: ReactNode;
};

function ContactRow({ href, icon, iconWrapClass, label, children }: RowProps) {
  const inner = (
    <>
      <span
        className={
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl " +
          iconWrapClass
        }
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium uppercase tracking-wide text-subtle">
          {label}
        </span>
        <span className="mt-0.5 block text-sm font-medium text-ink">{children}</span>
      </span>
    </>
  );

  if (href) {
    const external = href.startsWith("http");
    return (
      <a
        href={href}
        {...(external
          ? { target: "_blank", rel: "noopener noreferrer" }
          : { rel: "nofollow" })}
        className="flex items-start gap-3 rounded-xl py-1 transition-colors hover:bg-bg/80"
      >
        {inner}
      </a>
    );
  }

  return <div className="flex items-start gap-3 py-1">{inner}</div>;
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 lg:flex-row lg:justify-between lg:gap-16">
          <div className="max-w-md">
            <ContactRow
              icon={<IconShop className="h-6 w-6 text-ink" />}
              iconWrapClass="bg-bg border border-border text-ink"
              label="Shop"
            >
              R.B. Enterprise
            </ContactRow>
            <p className="mt-4 text-sm text-muted">
              Aurora Gadgets — trusted tech in Chittagong.
            </p>
            <div className="mt-5">
              <p className="text-xs font-medium uppercase tracking-wide text-subtle">
                For Support
              </p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="mt-1 inline-block text-sm font-medium text-ink underline-offset-2 hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>

          <div className="flex-1 lg:max-w-2xl">
            <h3 className="font-display text-sm font-semibold text-ink">Find Us</h3>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <ContactRow
              href={`https://wa.me/${WA}`}
              icon={<IconWhatsApp className="h-6 w-6 text-white" />}
              iconWrapClass="bg-[#25D366] shadow-sm"
              label="WhatsApp"
            >
              01834123393
            </ContactRow>
            <ContactRow
              href={`tel:${PHONE_E164}`}
              icon={<IconPhone className="h-6 w-6 text-white" />}
              iconWrapClass="bg-zinc-700 shadow-sm"
              label="Phone"
            >
              01820223003
            </ContactRow>
            <ContactRow
              icon={<IconMapPin className="h-6 w-6 text-white" />}
              iconWrapClass="bg-accent shadow-sm"
              label="Location"
            >
              #3B, Bipani Bitan, New Market, Chittagong
            </ContactRow>
            <ContactRow
              href="https://www.facebook.com/Aurora_Gadgets"
              icon={<IconFacebook className="h-6 w-6 text-white" />}
              iconWrapClass="bg-[#1877F2] shadow-sm"
              label="Facebook"
            >
              <span className="break-all">www.facebook.com/Aurora_Gadgets</span>
            </ContactRow>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-8 text-center text-xs text-subtle">
          <p className="text-[11px] leading-relaxed text-muted">
            © {new Date().getFullYear()} R.B. Enterprise. All rights reserved. Aurora Gadgets
            is a trading name of R.B. Enterprise.
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-subtle">
            Demo notice: This copyright notice is sample text for development and does not
            constitute legal advice. Replace with counsel-approved wording before production.
          </p>
          <p className="mt-3 text-subtle">Secure HTTPS checkout</p>
        </div>
      </div>
    </footer>
  );
}
