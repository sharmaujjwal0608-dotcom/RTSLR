import type { Metadata } from "next";
import { ArchitectureExplorer } from "@/components/research/ArchitectureExplorer";
import { DatasetExplorer } from "@/components/research/DatasetExplorer";
import { Experiments } from "@/components/research/Experiments";
import { FeatureSpec } from "@/components/research/FeatureSpec";
import { ModelExplorer } from "@/components/research/ModelExplorer";
import { Overview } from "@/components/research/Overview";
import { PublishedBenchmarks } from "@/components/research/PublishedBenchmarks";
import { References } from "@/components/research/References";
import { ResearchContents } from "@/components/research/ResearchContents";
import { ResearchHeader } from "@/components/research/ResearchHeader";
import { Roadmap } from "@/components/research/Roadmap";
import { Container } from "@/components/ui";
import { SOURCES_CHECKED_ON, loadResearchData } from "@/content/research";

export const metadata: Metadata = {
  title: "Research and development",
  description:
    "The RTSLR lab notebook: pipeline architecture, model kinds, feature specification, surveyed ISL datasets, planned experiments, published results from other groups, references and roadmap. No validated ISL model exists yet.",
};

/**
 * /research: one long document. The records come from research/data/*.json
 * (validated at build time); every interactive part is a client component.
 */
export default function ResearchPage() {
  const data = loadResearchData();

  return (
    <>
      <ResearchHeader
        checkedOn={SOURCES_CHECKED_ON}
        referenceCount={data.references.length}
        verifiedReferenceCount={data.references.filter((reference) => reference.verified).length}
        datasetCount={data.datasets.length}
        datasetsUsed={data.datasets.filter((dataset) => dataset.usedByRtslr).length}
        experimentCount={data.experiments.length}
      />
      <Container className="pb-section">
        {/* ResearchContents is sticky against this wrapper, so it must be its direct child. */}
        <div className="lg:grid lg:grid-cols-12 lg:gap-12">
          <ResearchContents />
          <div className="flex min-w-0 flex-col gap-20 lg:col-span-9">
            <Overview />
            <ArchitectureExplorer />
            <ModelExplorer />
            <FeatureSpec />
            <DatasetExplorer datasets={data.datasets} />
            <Experiments experiments={data.experiments} />
            <PublishedBenchmarks benchmarks={data.benchmarks} references={data.references} />
            <References references={data.references} />
            <Roadmap roadmap={data.roadmap} />
          </div>
        </div>
      </Container>
    </>
  );
}
