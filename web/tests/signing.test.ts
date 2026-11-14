import { afterEach, describe, expect, it, vi } from "vitest";

import { type MountedJourney, TanoWebError, mountSigning, signingEmbedUrl } from "../src/index.js";

const LINK = "https://verify.tano.africa/signer#tsig_jeton-de-signature-assez-long";
const ORIGIN = "https://verify.tano.africa";

let mounted: MountedJourney | null = null;
afterEach(() => {
  mounted?.destroy();
  mounted = null;
  document.body.innerHTML = "";
});

function mountPage(options: Omit<Parameters<typeof mountSigning>[1], "url">) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  mounted = mountSigning(host, { url: LINK, ...options });
  const frameWindow = { postMessage: vi.fn() } as unknown as Window;
  Object.defineProperty(mounted.iframe, "contentWindow", { value: frameWindow });
  const post = (data: unknown, origin = ORIGIN) =>
    window.dispatchEvent(new MessageEvent("message", { data, origin, source: frameWindow }));
  return { iframe: mounted.iframe, frameWindow, post };
}

describe("mountSigning", () => {
  it("encadre l'adresse intégrable de la signature, jeton dans le fragment", () => {
    const { iframe } = mountPage({});
    expect(iframe.src).toBe(
      "https://verify.tano.africa/signer/embed#tsig_jeton-de-signature-assez-long",
    );
    expect(iframe.allow).toBe("");
    expect(() => signingEmbedUrl("https://verify.tano.africa/#jeton")).toThrow(TanoWebError);
  });

  it("répond à la poignée de main, et rapporte l'issue", () => {
    const onSigned = vi.fn();
    const onStep = vi.fn();
    const { frameWindow, post, iframe } = mountPage({ onSigned, onStep, height: "640px" });
    post({ type: "tano:hello", version: 1 });
    expect(frameWindow.postMessage).toHaveBeenCalledWith({ type: "tano:init", version: 1 }, ORIGIN);
    post({ type: "tano:signing:step", step: "code" });
    post({ type: "tano:signing:signed", requestStatus: "completed" });
    expect(onStep).toHaveBeenCalledWith("code");
    expect(onSigned).toHaveBeenCalledWith("completed");
    // Une hauteur fixe : la page défile dans son cadre, le cadre ne la suit pas.
    post({ type: "tano:resize", height: 1100 });
    expect(iframe.style.height).toBe("640px");
  });

  it("n'écoute ni une autre origine ni une autre fenêtre", () => {
    const onSigned = vi.fn();
    const { post } = mountPage({ onSigned });
    post({ type: "tano:signing:signed", requestStatus: "completed" }, "https://ailleurs.example");
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "tano:signing:signed" },
        origin: ORIGIN,
        source: window,
      }),
    );
    expect(onSigned).not.toHaveBeenCalled();
  });
});
