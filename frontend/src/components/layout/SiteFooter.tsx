"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/ui";
import { useMessages } from "@/i18n";
import { NAV_ITEMS, STUDIO_HREF, layoutMessages } from "./navigation";
import { DeleteLocalData } from "./DeleteLocalData";

const linkClass =
  "inline-flex min-h-11 items-center text-small font-semibold text-ink underline decoration-transparent underline-offset-4 transition-colors duration-200 ease-calm hover:decoration-ink";

/**
 * Site footer: navigation, an honest capability statement and the privacy
 * line. It links only to routes that exist and carries no invented contact
 * details.
 */
export function SiteFooter() {
  const t = useMessages(layoutMessages);

  return (
    <footer data-site-footer="" className="border-t border-line bg-background-secondary">
      <Container size="wide" className="grid gap-12 py-section-tight lg:grid-cols-12 lg:gap-8">
        <div className="flex flex-col gap-4 lg:col-span-4">
          <p className="text-h2 font-extrabold text-ink">RTSLR</p>
          <p className="max-w-[36ch] text-small text-muted">{t.footerTagline}</p>
        </div>

        <nav aria-label={t.footerNav} className="lg:col-span-3">
          <p className="mb-2 text-small font-semibold text-muted">{t.footerExplore}</p>
          <ul className="grid grid-cols-2 gap-x-6 lg:grid-cols-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>
                  {t.nav[item.key]}
                </Link>
              </li>
            ))}
            <li>
              <Link href={STUDIO_HREF} className={linkClass}>
                {t.footerStudio}
              </Link>
            </li>
          </ul>
        </nav>

        <div className="flex flex-col gap-8 lg:col-span-5">
          <div className="flex flex-col gap-2">
            <p className="text-small font-semibold text-ink">{t.capabilityTitle}</p>
            <p className="text-small text-muted">{t.capability}</p>
          </div>
          <div className="flex items-start gap-3 border-t border-line pt-6">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
            <p className="text-small text-ink">
              <span className="font-semibold">{t.privacyTitle}: </span>
              {t.privacy}
            </p>
          </div>
          <DeleteLocalData />
        </div>
      </Container>
    </footer>
  );
}
