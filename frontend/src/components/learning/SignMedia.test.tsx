// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CATEGORIES, SIGNS, getSign, signsInCategory, type SignItem, type SignMedia as Media } from "@/features/learning/content";
import { SignMedia } from "./SignMedia";

afterEach(cleanup);

function hello(): SignItem {
  const sign = getSign("isl-greetings-hello");
  if (!sign) throw new Error("fixture sign missing");
  return sign;
}

/**
 * MOCK ENTRIES, FOR TESTS ONLY. These paths and credits are invented to
 * exercise the verified-media code path; no such files exist and nothing like
 * this may be added to shipped content without a real, licensed source.
 */
const MOCK_IMAGE: Media = {
  type: "image",
  src: "/test-only/mock-sign.png",
  alt: { en: "Mock alt text for a test image", hi: "परीक्षण चित्र का नकली वैकल्पिक पाठ" },
  captions: [],
  credit: "Mock Credit Org (test fixture)",
  licence: { name: "Mock Licence 1.0", url: "https://example.org/mock-licence" },
  sourceUrl: "https://example.org/mock-source",
  verifiedOn: "2000-01-01",
};

const MOCK_VIDEO: Media = {
  type: "video",
  src: "/test-only/mock-sign.mp4",
  poster: "/test-only/mock-poster.png",
  alt: { en: "Mock alt text for a test video", hi: "परीक्षण वीडियो का नकली वैकल्पिक पाठ" },
  captions: [
    { src: "/test-only/mock.en.vtt", srcLang: "en", label: "English" },
    { src: "/test-only/mock.hi.vtt", srcLang: "hi", label: "हिन्दी" },
  ],
  credit: "Mock Credit Org (test fixture)",
  licence: { name: "Mock Licence 1.0" },
  sourceUrl: "https://example.org/mock-source",
  verifiedOn: "2000-01-01",
};

const withMedia = (media: Media): SignItem => ({ ...hello(), media });

describe("SignMedia without media (every shipped item)", () => {
  it("shows the pending state with a working link to the dictionary source", () => {
    const { container } = render(<SignMedia sign={hello()} />);
    expect(container.querySelector('[data-media-state="pending"]')).not.toBeNull();
    expect(container.querySelector('[data-media-state="verified"]')).toBeNull();
    expect(screen.getByRole("heading", { name: "Demonstration pending verified source" })).toBeDefined();
    expect(screen.getByText("Pending verified source")).toBeDefined();

    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("https://islrtc.nic.in/");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.textContent).toContain("Look up “Hello” in the official dictionary (link not verified from our network)");
    expect(link.textContent).toContain("opens in a new tab");
  });

  it("shows no image, video or player controls", () => {
    const { container } = render(<SignMedia sign={hello()} />);
    expect(container.querySelector("img, video, track, figure")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("shows both meanings on the plate, each in its own language", () => {
    const { container } = render(<SignMedia sign={hello()} />);
    expect(container.querySelector('span[lang="en"]')?.textContent).toBe("Hello");
    expect(container.querySelector('span[lang="hi"]')?.textContent).toBe("नमस्ते");
  });

  it("can leave the word out where a heading already shows it", () => {
    const { container } = render(<SignMedia sign={hello()} showWord={false} />);
    expect(container.querySelector('span[lang="hi"]')).toBeNull();
    expect(screen.getByRole("link").getAttribute("href")).toBe("https://islrtc.nic.in/");
  });

  it("drops the 'not verified' wording once the source record is verified", () => {
    const sign: SignItem = { ...hello(), source: { ...hello().source, verified: true } };
    render(<SignMedia sign={sign} />);
    const text = screen.getByRole("link").textContent ?? "";
    expect(text).toContain("Look up “Hello” in the official ISLRTC dictionary");
    expect(text).not.toContain("not verified");
  });

  it("uses the requested heading level", () => {
    render(<SignMedia sign={hello()} headingAs="h4" />);
    expect(screen.getByRole("heading", { level: 4 })).toBeDefined();
  });

  it("is the state of every category in the shipped content", () => {
    expect(SIGNS.every((sign) => sign.media === null)).toBe(true);
    for (const category of CATEGORIES) {
      const { container, unmount } = render(<SignMedia sign={signsInCategory(category.id)[0]} />);
      expect(container.querySelector('[data-media-state="pending"]')).not.toBeNull();
      unmount();
    }
  });
});

describe("SignMedia with a verified image (mock entry)", () => {
  it("shows the image with its text alternative, credit, licence and source", () => {
    const { container } = render(<SignMedia sign={withMedia(MOCK_IMAGE)} />);
    expect(container.querySelector('[data-media-state="verified"]')).not.toBeNull();
    expect(container.querySelector('[data-media-state="pending"]')).toBeNull();
    expect(screen.queryByText("Demonstration pending verified source")).toBeNull();

    const image = screen.getByRole("img");
    expect(image.getAttribute("src")).toBe("/test-only/mock-sign.png");
    expect(image.getAttribute("alt")).toBe("Mock alt text for a test image");

    expect(screen.getByText("Verified source")).toBeDefined();
    expect(screen.getByText("Mock Credit Org (test fixture)")).toBeDefined();
    expect(screen.getByText("2000-01-01")).toBeDefined();
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "https://example.org/mock-licence",
      "https://example.org/mock-source",
    ]);
    expect(links[0].textContent).toContain("Mock Licence 1.0");
    expect(links.every((link) => link.getAttribute("rel") === "noopener noreferrer")).toBe(true);
  });

  it("has no video controls", () => {
    const { container } = render(<SignMedia sign={withMedia(MOCK_IMAGE)} />);
    expect(container.querySelector("video")).toBeNull();
    expect(screen.queryByRole("button", { name: "Replay" })).toBeNull();
  });
});

describe("SignMedia with a verified video (mock entry)", () => {
  const setup = () => {
    const utils = render(<SignMedia sign={withMedia(MOCK_VIDEO)} />);
    const video = utils.container.querySelector("video");
    if (!video) throw new Error("video not rendered");
    return { ...utils, video };
  };
  const tracks = (video: HTMLVideoElement) => [...video.querySelectorAll("track")];

  it("renders the video with native controls, poster and label, and never autoplays", () => {
    const { video } = setup();
    expect(video.getAttribute("src")).toBe("/test-only/mock-sign.mp4");
    expect(video.getAttribute("poster")).toBe("/test-only/mock-poster.png");
    expect(video.hasAttribute("controls")).toBe(true);
    expect(video.hasAttribute("autoplay")).toBe(false);
    expect(video.getAttribute("aria-label")).toBe("Demonstration video: Hello");
    expect(video.getAttribute("preload")).toBe("metadata");
  });

  it("turns captions on by default, in the interface language", () => {
    const { video } = setup();
    expect(tracks(video)).toHaveLength(1);
    const [track] = tracks(video);
    expect(track.getAttribute("kind")).toBe("captions");
    expect(track.getAttribute("src")).toBe("/test-only/mock.en.vtt");
    expect(track.getAttribute("srclang")).toBe("en");
    expect(track.hasAttribute("default")).toBe(true);
    expect((screen.getByRole("switch", { name: "Captions" }) as HTMLInputElement).checked).toBe(true);
  });

  it("switches captions off and on", () => {
    const { video } = setup();
    const toggle = screen.getByRole("switch", { name: "Captions" }) as HTMLInputElement;
    const language = screen.getByRole("combobox", { name: "Caption language" }) as HTMLSelectElement;

    fireEvent.click(toggle);
    expect(toggle.checked).toBe(false);
    expect(tracks(video)).toHaveLength(0);
    expect(language.disabled).toBe(true);

    fireEvent.click(toggle);
    expect(tracks(video)).toHaveLength(1);
    expect(language.disabled).toBe(false);
  });

  it("changes the caption language", () => {
    const { video } = setup();
    const language = screen.getByRole("combobox", { name: "Caption language" }) as HTMLSelectElement;
    expect(within(language).getAllByRole("option").map((option) => option.textContent)).toEqual(["English", "हिन्दी"]);
    fireEvent.change(language, { target: { value: "hi" } });
    expect(tracks(video)).toHaveLength(1);
    expect(tracks(video)[0].getAttribute("src")).toBe("/test-only/mock.hi.vtt");
    expect(tracks(video)[0].getAttribute("srclang")).toBe("hi");
  });

  it("changes the playback speed", () => {
    const { video } = setup();
    const speed = screen.getByRole("combobox", { name: "Playback speed" }) as HTMLSelectElement;
    expect(speed.value).toBe("1");
    expect(within(speed).getAllByRole("option").map((option) => option.getAttribute("value"))).toEqual(["0.5", "0.75", "1"]);
    expect(video.playbackRate).toBe(1);
    fireEvent.change(speed, { target: { value: "0.5" } });
    expect(video.playbackRate).toBe(0.5);
    fireEvent.change(speed, { target: { value: "0.75" } });
    expect(video.playbackRate).toBe(0.75);
  });

  it("replays from the start at the chosen speed", () => {
    const { video } = setup();
    const play = vi.spyOn(video, "play").mockResolvedValue(undefined);
    let position = 7;
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      get: () => position,
      set: (value: number) => {
        position = value;
      },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Playback speed" }), { target: { value: "0.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Replay" }));
    expect(position).toBe(0);
    expect(play).toHaveBeenCalledTimes(1);
    expect(video.playbackRate).toBe(0.5);
  });

  it("does not throw when the browser refuses to play", async () => {
    const { video } = setup();
    vi.spyOn(video, "play").mockRejectedValue(new Error("NotAllowedError"));
    fireEvent.click(screen.getByRole("button", { name: "Replay" }));
    await Promise.resolve();
    expect(screen.getByRole("button", { name: "Replay" })).toBeDefined();
  });

  it("says so when a video has no caption track, and offers no caption controls", () => {
    const { container } = render(<SignMedia sign={withMedia({ ...MOCK_VIDEO, captions: [] })} />);
    expect(screen.getByText("This video has no caption track.")).toBeDefined();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(container.querySelector("track")).toBeNull();
  });

  it("offers no language picker for a single caption track", () => {
    render(<SignMedia sign={withMedia({ ...MOCK_VIDEO, captions: [MOCK_VIDEO.captions[1]] })} />);
    expect(screen.getByRole("switch", { name: "Captions" })).toBeDefined();
    expect(screen.queryByRole("combobox", { name: "Caption language" })).toBeNull();
  });

  it("shows credit, licence without a link, and the source link", () => {
    setup();
    expect(screen.getByText("Mock Licence 1.0").closest("a")).toBeNull();
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["https://example.org/mock-source"]);
  });
});
