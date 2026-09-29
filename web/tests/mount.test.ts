import { afterEach, describe, expect, it, vi } from "vitest";

import { type MountedJourney, embedUrl, mount } from "../src/index.js";

const JOURNEY_URL = "https://verify.tano.africa/#jeton-1";
const JOURNEY_ORIGIN = "https://verify.tano.africa";

let mounted: MountedJourney | null = null;
afterEach(() => {
  mounted?.destroy();
  mounted = null;
  document.body.innerHTML = "";
});

/** Le cadre, avec une fenêtre qu'on observe : les messages en viennent, les réponses y vont. */
function mountJourney(options: Parameters<typeof mount>[1]) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  mounted = mount(host, options);
  const frameWindow = { postMessage: vi.fn() } as unknown as Window;
  Object.defineProperty(mounted.iframe, "contentWindow", { value: frameWindow });
  const post = (data: unknown, origin = JOURNEY_ORIGIN, source: unknown = frameWindow) =>
    window.dispatchEvent(new MessageEvent("message", { data, origin, source: source as Window }));
  return { iframe: mounted.iframe, frameWindow, post };
}

describe("mount", () => {
  it("encadre l'adresse d'intégration, caméra déléguée, sans référent", () => {
    const { iframe } = mountJourney({ url: JOURNEY_URL });
    expect(iframe.src).toBe("https://verify.tano.africa/embed#jeton-1");
    expect(iframe.allow).toBe("camera");
    expect(iframe.referrerPolicy).toBe("no-referrer");
    expect(embedUrl("https://verify.tano.africa/?x=1#t").toString()).toBe(
      "https://verify.tano.africa/embed#t",
    );
  });

  it("répond à la poignée de main, vers l'origine du parcours seulement", () => {
    const { frameWindow, post } = mountJourney({ url: JOURNEY_URL });
    post({ type: "tano:hello", version: 1 });
    expect(frameWindow.postMessage).toHaveBeenCalledWith(
      { type: "tano:init", version: 1 },
      JOURNEY_ORIGIN,
    );
  });

  it("relaie les événements du parcours, et ignore ceux d'ailleurs", () => {
    const onStep = vi.fn();
    const onCompleted = vi.fn();
    const { iframe, post } = mountJourney({ url: JOURNEY_URL, onStep, onCompleted });
    post({ type: "tano:step", step: "face" });
    post({ type: "tano:resize", height: 812 });
    post({ type: "tano:completed" });
    // Une autre origine, ou une autre fenêtre de la même origine : ignorées.
    post({ type: "tano:completed" }, "https://evil.example");
    post({ type: "tano:completed" }, JOURNEY_ORIGIN, window);
    expect(onStep).toHaveBeenCalledWith("face");
    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(iframe.style.height).toBe("812px");
  });

  it("reprend dans le même cadre quand le lien expire, si on lui en donne un autre", async () => {
    const onEnded = vi.fn();
    const { iframe, post } = mountJourney({
      url: JOURNEY_URL,
      onEnded,
      onExpired: async () => "https://verify.tano.africa/#jeton-2",
    });
    post({ type: "tano:ended", reason: "expired" });
    await vi.waitFor(() => expect(iframe.src).toBe("https://verify.tano.africa/embed#jeton-2"));
    expect(onEnded).not.toHaveBeenCalled();
  });

  it("dit la fin sans rappel de renouvellement", () => {
    const onEnded = vi.fn();
    const { post } = mountJourney({ url: JOURNEY_URL, onEnded });
    post({ type: "tano:ended", reason: "declined" });
    post({ type: "tano:ended", reason: "expired" });
    expect(onEnded.mock.calls).toEqual([["declined"], ["expired"]]);
  });
});
