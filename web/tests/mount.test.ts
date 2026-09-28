import { afterEach, describe, expect, it, vi } from "vitest";

import { type MountedJourney, embedUrl, mount } from "../src/index.js";

const LIEN = "https://verify.tano.africa/#jeton-1";
const ORIGINE = "https://verify.tano.africa";

let monte: MountedJourney | null = null;
afterEach(() => {
  monte?.destroy();
  monte = null;
  document.body.innerHTML = "";
});

/** Le cadre, avec une fenêtre qu'on observe : les messages en viennent, les réponses y vont. */
function monter(options: Parameters<typeof mount>[1]) {
  const hote = document.createElement("div");
  document.body.appendChild(hote);
  monte = mount(hote, options);
  const fenetre = { postMessage: vi.fn() } as unknown as Window;
  Object.defineProperty(monte.iframe, "contentWindow", { value: fenetre });
  const envoyer = (data: unknown, origin = ORIGINE, source: unknown = fenetre) =>
    window.dispatchEvent(new MessageEvent("message", { data, origin, source: source as Window }));
  return { iframe: monte.iframe, fenetre, envoyer };
}

describe("mount", () => {
  it("encadre l'adresse d'intégration, caméra déléguée, sans référent", () => {
    const { iframe } = monter({ url: LIEN });
    expect(iframe.src).toBe("https://verify.tano.africa/embed#jeton-1");
    expect(iframe.allow).toBe("camera");
    expect(iframe.referrerPolicy).toBe("no-referrer");
    expect(embedUrl("https://verify.tano.africa/?x=1#t").toString()).toBe(
      "https://verify.tano.africa/embed#t",
    );
  });

  it("répond à la poignée de main, vers l'origine du parcours seulement", () => {
    const { fenetre, envoyer } = monter({ url: LIEN });
    envoyer({ type: "tano:hello", version: 1 });
    expect(fenetre.postMessage).toHaveBeenCalledWith({ type: "tano:init", version: 1 }, ORIGINE);
  });

  it("relaie les événements du parcours, et ignore ceux d'ailleurs", () => {
    const onStep = vi.fn();
    const onCompleted = vi.fn();
    const { iframe, envoyer } = monter({ url: LIEN, onStep, onCompleted });
    envoyer({ type: "tano:step", step: "face" });
    envoyer({ type: "tano:resize", height: 812 });
    envoyer({ type: "tano:completed" });
    // Une autre origine, ou une autre fenêtre de la même origine : ignorées.
    envoyer({ type: "tano:completed" }, "https://evil.example");
    envoyer({ type: "tano:completed" }, ORIGINE, window);
    expect(onStep).toHaveBeenCalledWith("face");
    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(iframe.style.height).toBe("812px");
  });

  it("reprend dans le même cadre quand le lien expire, si on lui en donne un autre", async () => {
    const onEnded = vi.fn();
    const { iframe, envoyer } = monter({
      url: LIEN,
      onEnded,
      onExpired: async () => "https://verify.tano.africa/#jeton-2",
    });
    envoyer({ type: "tano:ended", reason: "expired" });
    await vi.waitFor(() => expect(iframe.src).toBe("https://verify.tano.africa/embed#jeton-2"));
    expect(onEnded).not.toHaveBeenCalled();
  });

  it("dit la fin sans rappel de renouvellement", () => {
    const onEnded = vi.fn();
    const { envoyer } = monter({ url: LIEN, onEnded });
    envoyer({ type: "tano:ended", reason: "declined" });
    envoyer({ type: "tano:ended", reason: "expired" });
    expect(onEnded.mock.calls).toEqual([["declined"], ["expired"]]);
  });
});
