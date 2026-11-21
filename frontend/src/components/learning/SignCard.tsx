"use client";

import Link from "next/link";
import { Badge } from "@/components/ui";
import { signHref, type SignItem } from "@/features/learning/content";
import { FavouriteButton, SourceBadge, useCategoryTitle, useSignWords } from "./shared";

/**
 * One entry of the sign index: a hairline row on small screens, a compact
 * sheet from `md`. It shows meanings and source state only; never a depiction
 * of the sign.
 */
export function SignCard({ sign, headingAs: Heading = "h3" }: { sign: SignItem; headingAs?: "h2" | "h3" | "h4" }) {
  const words = useSignWords()(sign);
  const categoryTitle = useCategoryTitle();
  return (
    <li className="flex flex-col gap-3 border-b border-line py-5 md:rounded-card md:border md:bg-surface md:p-5">
      <div className="flex flex-col gap-1">
        <Heading className="text-h3 break-words text-ink">
          <Link
            href={signHref(sign.id)}
            lang={words.primaryLang}
            className="underline decoration-transparent underline-offset-4 transition-colors duration-200 ease-calm hover:decoration-ink"
          >
            {words.primary}
          </Link>
        </Heading>
        {words.secondary ? (
          <p lang={words.secondaryLang} className="text-body break-words text-muted">
            {words.secondary}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge plain>{categoryTitle(sign.category)}</Badge>
        <SourceBadge sign={sign} />
      </div>
      <FavouriteButton sign={sign} className="-ml-3 self-start md:mt-auto" />
    </li>
  );
}
