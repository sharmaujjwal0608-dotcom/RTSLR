import { ArrowUpRight, Camera, FlaskConical, Hand, Play } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  Badge,
  Button,
  Card,
  Container,
  ExternalLink,
  Eyebrow,
  Heading,
  Input,
  Kbd,
  Lead,
  Notice,
  Reveal,
  Section,
  Select,
  Slider,
  StatusPill,
  Switch,
  Tabs,
  VisuallyHidden,
} from "@/components/ui";

export const metadata: Metadata = {
  title: "Design system",
  description: "Live reference for RTSLR design tokens and UI primitives.",
  robots: { index: false },
};

/* ------------------------------------------------------------------ data */

type Swatch = { name: string; utility: string; hex: string; swatch: string; note: string; dark?: boolean };

const surfaces: Swatch[] = [
  { name: "background", utility: "bg-background", hex: "#FAF6F0", swatch: "bg-background", note: "Page" },
  {
    name: "background-secondary",
    utility: "bg-background-secondary",
    hex: "#F2EBE2",
    swatch: "bg-background-secondary",
    note: "Alternate band, wells",
  },
  { name: "surface", utility: "bg-surface", hex: "#FFFFFF", swatch: "bg-surface", note: "Cards, inputs" },
  { name: "ink", utility: "text-ink / bg-ink", hex: "#101010", swatch: "bg-ink", note: "17.67:1 on cream", dark: true },
  { name: "muted", utility: "text-muted", hex: "#686662", swatch: "bg-muted", note: "5.32:1 on cream", dark: true },
  { name: "line", utility: "border-line", hex: "#E5DED5", swatch: "bg-line", note: "Hairlines (decorative)" },
  {
    name: "line-strong",
    utility: "border-line-strong",
    hex: "#8C857B",
    swatch: "bg-line-strong",
    note: "Control borders, 3.39:1",
    dark: true,
  },
];

const accents: Swatch[] = [
  { name: "accent", utility: "bg-accent", hex: "#D79C72", swatch: "bg-accent", note: "Marks only. 2.19:1, never text" },
  {
    name: "accent-ink",
    utility: "text-accent-ink",
    hex: "#8A4F24",
    swatch: "bg-accent-ink",
    note: "Accent as text, 6.05:1",
    dark: true,
  },
  { name: "accent-soft", utility: "bg-accent-soft", hex: "#F6E6D8", swatch: "bg-accent-soft", note: "Tint behind text" },
];

const statuses: { name: string; ink: string; soft: string; mark: string; hex: string; ratio: string }[] = [
  { name: "success", ink: "text-success-ink", soft: "bg-success-soft", mark: "bg-success", hex: "#1A6B48 on #E1F1E8", ratio: "5.54:1" },
  { name: "warning", ink: "text-warning-ink", soft: "bg-warning-soft", mark: "bg-warning", hex: "#7A4F00 on #FAEBC8", ratio: "6.04:1" },
  { name: "danger", ink: "text-danger-ink", soft: "bg-danger-soft", mark: "bg-danger", hex: "#A8261C on #FBE4E0", ratio: "5.84:1" },
  { name: "info", ink: "text-info-ink", soft: "bg-info-soft", mark: "bg-info", hex: "#28557F on #E2ECF5", ratio: "6.51:1" },
];

const typeScale: { utility: string; className: string; spec: string; sample: string }[] = [
  { utility: "text-display", className: "text-display", spec: "44 → 108px · 0.98 · −0.045em · 700", sample: "Turn signs into conversations." },
  { utility: "text-h1", className: "text-h1", spec: "36 → 64px · 1.04 · −0.035em · 700", sample: "Recognition that runs in your browser" },
  { utility: "text-h2", className: "text-h2", spec: "28 → 44px · 1.1 · −0.03em · 650", sample: "What the studio can and cannot do" },
  { utility: "text-h3", className: "text-h3", spec: "20 → 24px · 1.25 · −0.015em · 650", sample: "Hand landmarks, not video" },
  { utility: "text-h4", className: "text-h4", spec: "17px · 1.4 · 650", sample: "Camera permission" },
  { utility: "text-lead", className: "text-lead text-muted", spec: "17 → 21px · 1.55 · 400", sample: "An introduction sits under a heading and runs to about sixty characters a line." },
  { utility: "text-body", className: "text-body", spec: "16px · 1.65 · 400", sample: "Body copy for paragraphs and descriptions across every page." },
  { utility: "text-small", className: "text-small", spec: "14px · 1.55", sample: "Labels, buttons, table cells and secondary copy." },
  { utility: "text-caption", className: "text-caption text-muted", spec: "13px · 1.45", sample: "Hints, captions and metadata." },
  { utility: "font-mono text-label", className: "font-mono text-label", spec: "12px · 1.35 · +0.02em · IBM Plex Mono", sample: "landmarks 21 · handedness right" },
];

/* ---------------------------------------------------------------- helpers */

function SwatchGrid({ items }: { items: Swatch[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-4">
      {items.map((item) => (
        <li key={item.name} className="flex flex-col gap-3">
          <div
            className={`flex h-24 items-end rounded-card border border-line p-3 font-mono text-label ${item.swatch} ${
              item.dark ? "text-white" : "text-black"
            }`}
          >
            {item.hex}
          </div>
          <div>
            <p className="text-small font-semibold">{item.name}</p>
            <p className="font-mono text-label text-muted">{item.utility}</p>
            <p className="text-caption text-muted">{item.note}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Spec({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid gap-6 border-t border-line py-10 md:grid-cols-[14rem_1fr] md:gap-12">
      <Heading as="h3" size="h4">
        {title}
      </Heading>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

/* ------------------------------------------------------------------- page */

export default function DesignSystemPage() {
  return (
    <>
      <Section
        titleAs="h1"
        eyebrow="Reference"
        title="RTSLR design system"
        lead="Every token and primitive, rendered live. If something you need is missing here, ask for it rather than styling it locally."
        spacing="tight"
      >
        <nav aria-label="On this page">
          <Row>
            <Button href="#colour" variant="secondary" size="sm">
              Colour
            </Button>
            <Button href="#type" variant="secondary" size="sm">
              Type
            </Button>
            <Button href="#shape" variant="secondary" size="sm">
              Shape and space
            </Button>
            <Button href="#components" variant="secondary" size="sm">
              Components
            </Button>
            <Button href="#ink" variant="secondary" size="sm">
              Ink tone
            </Button>
          </Row>
        </nav>
      </Section>

      {/* ------------------------------------------------------------ colour */}
      <Section
        id="colour"
        tone="surface"
        title="Colour"
        lead="Cream, white and black do the work. Clay is a mark, not a paint. Status colours always arrive with an icon and words."
        spacing="tight"
      >
        <div className="flex flex-col gap-14">
          <SwatchGrid items={surfaces} />
          <SwatchGrid items={accents} />
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {statuses.map((status) => (
              <li key={status.name} className={`flex flex-col gap-3 rounded-card p-5 ${status.soft}`}>
                <span aria-hidden="true" className={`size-3 rounded-full ${status.mark}`} />
                <p className={`text-small font-semibold ${status.ink}`}>
                  {status.name}-ink on {status.name}-soft
                </p>
                <p className="font-mono text-label text-ink">
                  {status.hex} · {status.ratio}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* -------------------------------------------------------------- type */}
      <Section
        id="type"
        title="Type"
        lead="Manrope for Latin, Noto Sans Devanagari for Hindi, IBM Plex Mono for technical readouts. Sizes carry their own leading, tracking and weight."
        spacing="tight"
      >
        <dl>
          {typeScale.map((row) => (
            <div key={row.utility} className="grid gap-3 border-t border-line py-7 md:grid-cols-[14rem_1fr] md:gap-12">
              <dt>
                <p className="font-mono text-label font-medium">{row.utility}</p>
                <p className="text-caption text-muted">{row.spec}</p>
              </dt>
              <dd className={`min-w-0 ${row.className}`}>{row.sample}</dd>
            </div>
          ))}
          <div className="grid gap-3 border-t border-line py-7 md:grid-cols-[14rem_1fr] md:gap-12">
            <dt>
              <p className="font-mono text-label font-medium">lang=&quot;hi&quot;</p>
              <p className="text-caption text-muted">
                Tracking reset to 0, leading raised (headings 1.24–1.45, text 1.8)
              </p>
            </dt>
            <dd lang="hi" className="flex min-w-0 flex-col gap-4">
              <p className="text-h1">संकेतों को बातचीत में बदलें।</p>
              <p className="text-body text-muted">
                RTSLR भारतीय सांकेतिक भाषा (ISL) के लिए एक शोध मंच है। पहचान आपके ब्राउज़र में ही चलती है।
              </p>
            </dd>
          </div>
        </dl>
      </Section>

      {/* ------------------------------------------------------------- shape */}
      <Section
        id="shape"
        tone="secondary"
        title="Shape and space"
        lead="Controls are pills. Containers get rounder as they get larger. Shadows are warm, low and rare."
        spacing="tight"
      >
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <Heading as="h3" size="h4" className="mb-5">
              Radius
            </Heading>
            <ul className="grid grid-cols-2 gap-4">
              <li className="rounded-control border border-line bg-surface px-5 py-4 font-mono text-label">rounded-control</li>
              <li className="rounded-field border border-line bg-surface px-5 py-4 font-mono text-label">rounded-field 14px</li>
              <li className="rounded-card border border-line bg-surface px-5 py-8 font-mono text-label">rounded-card 20px</li>
              <li className="rounded-panel border border-line bg-surface px-5 py-8 font-mono text-label">rounded-panel 32px</li>
            </ul>
          </div>
          <div>
            <Heading as="h3" size="h4" className="mb-5">
              Shadow
            </Heading>
            <ul className="grid grid-cols-3 gap-4">
              <li className="rounded-card bg-surface px-4 py-8 font-mono text-label shadow-soft">shadow-soft</li>
              <li className="rounded-card bg-surface px-4 py-8 font-mono text-label shadow-lift">shadow-lift</li>
              <li className="rounded-card bg-surface px-4 py-8 font-mono text-label shadow-float">shadow-float</li>
            </ul>
          </div>
          <div className="lg:col-span-2">
            <Heading as="h3" size="h4" className="mb-5">
              Rhythm
            </Heading>
            <ul className="flex flex-col gap-3 font-mono text-label">
              <li className="flex items-center gap-4">
                <span aria-hidden="true" className="block h-3 w-gutter bg-accent" />
                px-gutter · 20 → 48px page gutter
              </li>
              <li className="flex items-center gap-4">
                <span aria-hidden="true" className="block h-3 w-section-tight bg-accent" />
                py-section-tight · 48 → 88px
              </li>
              <li className="flex items-center gap-4">
                <span aria-hidden="true" className="block h-3 w-section bg-accent" />
                py-section · 72 → 144px
              </li>
              <li className="text-muted">
                Containers: max-w-reading 672 · max-w-narrow 960 · max-w-page 1280 · max-w-wide 1472
              </li>
            </ul>
          </div>
        </div>
      </Section>

      {/* -------------------------------------------------------- components */}
      <Section
        id="components"
        tone="surface"
        title="Components"
        lead="Import from @/components/ui. Each primitive is shown with every variant and state."
        spacing="tight"
      >
        <Spec title="Button">
          <div className="flex flex-col gap-5">
            <Row>
              <Button size="lg" icon={<ArrowUpRight />}>
                Try live translation
              </Button>
              <Button size="lg" variant="secondary" icon={<Play />}>
                Watch demo
              </Button>
              <Button size="lg" variant="ghost">
                Read the method
              </Button>
            </Row>
            <Row>
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button leadingIcon={<Camera />}>Start camera</Button>
              <Button disabled>Disabled</Button>
              <Button variant="secondary" disabled>
                Disabled
              </Button>
            </Row>
            <Row>
              <Button size="sm">Small</Button>
              <Button size="sm" variant="secondary">
                Small
              </Button>
              <Button size="sm" variant="ghost">
                Small
              </Button>
              <Button href="/design-system#components" size="sm" variant="secondary" icon={<ArrowUpRight />}>
                Renders a link
              </Button>
            </Row>
            <p className="text-caption text-muted">
              lg 56px · md 44px · sm 36px (dense Studio toolbars only). Press <Kbd>Tab</Kbd> to see the focus ring.
            </p>
          </div>
        </Spec>

        <Spec title="Badge and StatusPill">
          <div className="flex flex-col gap-5">
            <Row>
              <Badge>Neutral</Badge>
              <Badge plain>v0.1</Badge>
              <Badge tone="success">Verified source</Badge>
              <Badge tone="warning">Experimental</Badge>
              <Badge tone="danger">Not validated</Badge>
              <Badge tone="info">Simulator</Badge>
              <Badge tone="info" icon={<FlaskConical />}>
                R&amp;D
              </Badge>
            </Row>
            <Row>
              <StatusPill>Camera off</StatusPill>
              <StatusPill tone="success">Hand detected</StatusPill>
              <StatusPill tone="warning">Low light</StatusPill>
              <StatusPill tone="danger">Camera blocked</StatusPill>
              <StatusPill tone="info" icon={<Hand />}>
                Legacy ASL prototype
              </StatusPill>
            </Row>
          </div>
        </Spec>

        <Spec title="Notice">
          <div className="flex max-w-2xl flex-col gap-4">
            <Notice title="Legacy ASL prototype">
              This classifier recognises American Sign Language fingerspelling. It is not Indian Sign Language
              recognition.
            </Notice>
            <Notice tone="warning" title="Experimental">
              No trained or validated ISL model exists yet. Output here comes from a simulator.
            </Notice>
            <Notice tone="danger" title="Camera access was blocked">
              Allow the camera in your browser&apos;s site settings, then start again.
            </Notice>
            <Notice tone="success" title="Template saved">
              Stored in this browser only.
            </Notice>
            <Notice tone="neutral" compact>
              Media pending a verified source.
            </Notice>
          </div>
        </Spec>

        <Spec title="Card">
          <div className="grid gap-5 md:grid-cols-3">
            <Card>
              <Heading as="h4" size="h4">
                outline
              </Heading>
              <p className="mt-2 text-small text-muted">Default. White sheet, hairline edge, no shadow.</p>
            </Card>
            <Card variant="sunken">
              <Heading as="h4" size="h4">
                sunken
              </Heading>
              <p className="mt-2 text-small text-muted">A well for readouts, code and secondary content.</p>
            </Card>
            <Card variant="raised">
              <Heading as="h4" size="h4">
                raised
              </Heading>
              <p className="mt-2 text-small text-muted">Only for things that float: Studio panels, popovers.</p>
            </Card>
          </div>
        </Spec>

        <Spec title="Tabs">
          <div className="flex flex-col gap-10">
            <Tabs
              label="Recognition source"
              items={[
                { id: "camera", label: "Camera", icon: <Camera />, content: <p className="text-small text-muted">Pill variant: a segmented control for switching modes inside a panel.</p> },
                { id: "simulator", label: "Simulator", content: <p className="text-small text-muted">Arrow keys move between tabs; Home and End jump to the ends.</p> },
                { id: "templates", label: "Templates", content: <p className="text-small text-muted">Panels stay mounted, so their state survives switching.</p> },
                { id: "off", label: "Unavailable", disabled: true, content: null },
              ]}
            />
            <Tabs
              variant="underline"
              label="R&D areas"
              items={[
                { id: "method", label: "Method", content: <p className="text-small text-muted">Underline variant: sub-navigation inside a page.</p> },
                { id: "data", label: "Data", content: <p className="text-small text-muted">Second panel.</p> },
                { id: "limits", label: "Limits", content: <p className="text-small text-muted">Third panel.</p> },
              ]}
            />
          </div>
        </Spec>

        <Spec title="Fields">
          <div className="grid max-w-3xl gap-x-10 gap-y-8 md:grid-cols-2">
            <Input label="Template name" placeholder="Morning practice" hint="Saved in this browser only." />
            <Input label="Email" type="email" defaultValue="name@" error="Enter a full email address, like name@example.org." />
            <Select
              label="Interface language"
              defaultValue="en"
              options={[
                { value: "en", label: "English" },
                { value: "hi", label: "हिन्दी" },
              ]}
            />
            <Input label="Disabled" defaultValue="Not editable" disabled />
            <Slider label="Confidence threshold" defaultValue={60} unit="%" hint="Predictions below this are hidden." />
            <div className="flex flex-col gap-5">
              <Switch label="Mirror camera" hint="Flip the preview horizontally." defaultChecked />
              <Switch label="Show hand landmarks" />
              <Switch label="Unavailable setting" disabled />
            </div>
          </div>
        </Spec>

        <Spec title="Text helpers">
          <div className="flex flex-col gap-5">
            <Eyebrow>Eyebrow names the subject of a section</Eyebrow>
            <Lead>Lead is the paragraph under a heading. It is muted and capped at about sixty characters.</Lead>
            <p className="text-body">
              Press <Kbd>Space</Kbd> to pause, <Kbd>Esc</Kbd> to stop the camera. Read the{" "}
              <ExternalLink href="https://www.w3.org/WAI/ARIA/apg/patterns/tabs/">WAI-ARIA tabs pattern</ExternalLink>.
            </p>
            <p className="text-small text-muted">
              VisuallyHidden renders text for screen readers only
              <VisuallyHidden> (this sentence continues for assistive technology)</VisuallyHidden>.
            </p>
          </div>
        </Spec>

        <Spec title="Reveal">
          <Reveal>
            <Card variant="sunken">
              <p className="text-small text-muted">
                This block faded in once when it entered the viewport. With reduced motion, printing or scripts off it
                is simply visible.
              </p>
            </Card>
          </Reveal>
        </Spec>
      </Section>

      {/* --------------------------------------------------------------- ink */}
      <Section
        id="ink"
        tone="ink"
        eyebrow="Section tone: ink"
        title="The same utilities, inverted"
        lead="Inside an ink section the tokens are re-scoped, so text-ink, text-muted, border-line and every primitive adapt without extra classes."
      >
        <div className="flex flex-col gap-8">
          <Row>
            <Button size="lg" icon={<ArrowUpRight />}>
              Open the studio
            </Button>
            <Button size="lg" variant="secondary">
              Secondary
            </Button>
            <Button size="lg" variant="ghost">
              Ghost
            </Button>
          </Row>
          <Row>
            <Badge>Neutral</Badge>
            <Badge tone="success">Verified source</Badge>
            <Badge tone="warning">Experimental</Badge>
            <StatusPill tone="danger">Camera blocked</StatusPill>
            <StatusPill tone="info">Simulator</StatusPill>
          </Row>
          <div className="grid gap-5 md:grid-cols-2">
            <Card>
              <Heading as="h3" size="h4">
                Card on ink
              </Heading>
              <p className="mt-2 text-small text-muted">Surface and line tokens shift with the tone.</p>
            </Card>
            <Notice tone="warning" title="Experimental">
              Notices keep their meaning and contrast.
            </Notice>
          </div>
        </div>
      </Section>

      <Container className="py-10">
        <p className="text-caption text-muted">
          Full specification, contrast table and page layouts: docs/DESIGN_SYSTEM.md.
        </p>
      </Container>
    </>
  );
}
