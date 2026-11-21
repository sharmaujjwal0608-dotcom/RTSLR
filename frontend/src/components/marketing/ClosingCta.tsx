import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { Button, Section } from "@/components/ui";
import type { SectionTone } from "@/components/ui";

export type ClosingCtaProps = {
  title: ReactNode;
  lead?: ReactNode;
  primary: { href: string; label: ReactNode };
  secondary?: { href: string; label: ReactNode };
  tone?: SectionTone;
};

/** The short centred call to action that closes a marketing page. */
export function ClosingCta({ title, lead, primary, secondary, tone = "cream" }: ClosingCtaProps) {
  return (
    <Section tone={tone} spacing="tight" align="center" title={title} lead={lead}>
      <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Button href={primary.href} size="lg" icon={<ArrowUpRight />}>
          {primary.label}
        </Button>
        {secondary ? (
          <Button href={secondary.href} size="lg" variant="secondary">
            {secondary.label}
          </Button>
        ) : null}
      </div>
    </Section>
  );
}
