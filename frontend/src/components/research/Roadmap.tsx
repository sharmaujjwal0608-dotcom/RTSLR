"use client";

import { Badge, type Tone } from "@/components/ui";
import type { RoadmapItem, RoadmapStatus } from "@/content/research/types";
import { defineMessages, useMessages } from "@/i18n";
import { cn } from "@/lib/cn";
import { DocSection, Mono } from "./parts";

const messages = defineMessages({
  en: {
    intro:
      "The order of work, from the source audit to review by the deaf community. A status changes only when the work has actually been done.",
    status: { done: "Done", in_progress: "In progress", planned: "Planned" } satisfies Record<RoadmapStatus, string>,
    summary: (done: number, active: number, planned: number) =>
      `${done} done, ${active} in progress, ${planned} planned`,
    dependsOn: "Depends on",
    listLabel: "Roadmap phases",
  },
  hi: {
    intro: "काम का क्रम — स्रोतों की जाँच से लेकर बधिर समुदाय की समीक्षा तक। कोई स्थिति तभी बदलती है जब काम वास्तव में हो चुका हो।",
    status: { done: "पूरा", in_progress: "जारी", planned: "नियोजित" } satisfies Record<RoadmapStatus, string>,
    summary: (done: number, active: number, planned: number) => `${done} पूरे, ${active} जारी, ${planned} नियोजित`,
    dependsOn: "इन पर निर्भर",
    listLabel: "रोडमैप के चरण",
  },
});

const statusTone: Record<RoadmapStatus, Tone> = { done: "success", in_progress: "info", planned: "neutral" };

/** Groups items by phase, keeping the order in which phases first appear. */
export function groupByPhase(items: readonly RoadmapItem[]): { phase: string; items: RoadmapItem[] }[] {
  const groups: { phase: string; items: RoadmapItem[] }[] = [];
  for (const item of items) {
    const group = groups.find((candidate) => candidate.phase === item.phase);
    if (group) group.items.push(item);
    else groups.push({ phase: item.phase, items: [item] });
  }
  return groups;
}

export function Roadmap({ roadmap }: { roadmap: RoadmapItem[] }) {
  const t = useMessages(messages);
  const phases = groupByPhase(roadmap);
  const count = (status: RoadmapStatus) => roadmap.filter((item) => item.status === status).length;

  return (
    <DocSection id="roadmap" intro={<p>{t.intro}</p>}>
      <p className="font-mono text-label text-ink">{t.summary(count("done"), count("in_progress"), count("planned"))}</p>

      {/* One vertical rule; each item hangs a marker on it. */}
      <ol aria-label={t.listLabel} className="mt-8 ml-2 flex max-w-narrow flex-col gap-12 border-l border-line-strong">
        {phases.map((group) => (
          <li key={group.phase} className="pl-6 sm:pl-8">
            <h3 lang="en" className="text-h3 break-words text-ink">
              {group.phase}
            </h3>
            <ol className="mt-5 flex flex-col gap-8">
              {group.items.map((item) => (
                <li
                  key={item.id}
                  id={item.id}
                  tabIndex={-1}
                  className="relative scroll-mt-40 outline-none lg:scroll-mt-28"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute top-1.5 -left-6 size-3 -translate-x-1/2 rounded-full border-2 border-ink sm:-left-8",
                      item.status === "done" ? "bg-ink" : item.status === "in_progress" ? "bg-accent" : "bg-background",
                    )}
                  />
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <Mono className="text-muted">{item.id}</Mono>
                    <Badge tone={statusTone[item.status]}>{t.status[item.status]}</Badge>
                  </div>
                  <h4 lang="en" className="mt-2 text-h4 break-words text-ink">
                    {item.title}
                  </h4>
                  <p lang="en" className="mt-2 max-w-reading text-small text-ink">
                    {item.description}
                  </p>
                  {item.dependsOn.length > 0 ? (
                    <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-caption text-muted">
                      <span>{t.dependsOn}</span>
                      {item.dependsOn.map((id) => (
                        <a
                          key={id}
                          href={`#${id}`}
                          className="font-mono text-label text-accent-ink underline decoration-line-strong underline-offset-4"
                        >
                          {id}
                        </a>
                      ))}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </DocSection>
  );
}
