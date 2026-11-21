import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SignDetail } from "@/components/learning/SignDetail";
import { SIGNS, getCategory, getSign } from "@/features/learning/content";

type Props = { params: Promise<{ id: string }> };

/**
 * Every sign id is known at build time, so each page is prerendered.
 * (`dynamicParams` is not supported with `cacheComponents`; an unknown id
 * reaches `notFound()` below instead.)
 */
export function generateStaticParams(): { id: string }[] {
  return SIGNS.map((sign) => ({ id: sign.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const sign = getSign(id);
  if (!sign) return { title: "Sign not found — Learn ISL" };
  return {
    title: `${sign.en} — Learn ISL`,
    description: `“${sign.en}” (${sign.hi}) in the ${getCategory(sign.category).title.en} category: English and Hindi meaning and where to look the sign up. The demonstration is pending a verified source.`,
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  if (!getSign(id)) notFound();
  return <SignDetail signId={id} />;
}
