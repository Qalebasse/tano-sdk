import { afterEach, describe, expect, it, vi } from "vitest";

import { TanoWebError, checkJourneyUrl, handleReturn, launch } from "../src/index.js";

const JOURNEY_URL = "https://parcours.tano.africa/#jeton";

afterEach(() => vi.restoreAllMocks());

function fakePopup() {
  const popup = { close: vi.fn() } as unknown as Window;
  const open = vi.spyOn(window, "open").mockReturnValue(popup);
  return { popup, open };
}

describe("le lien du parcours", () => {
  it("doit être en HTTPS, sauf en local", () => {
    expect(() => checkJourneyUrl("http://parcours.exemple/#t")).toThrow(TanoWebError);
    expect(() => checkJourneyUrl("javascript:alert(1)")).toThrow(TanoWebError);
    expect(checkJourneyUrl("http://localhost:5173/#t").hostname).toBe("localhost");
  });
});

describe("launch", () => {
  it("ouvre une fenêtre, et bascule dans l'onglet si elle est bloquée", () => {
    const { open } = fakePopup();
    expect(launch({ url: JOURNEY_URL }).mode).toBe("popup");
    expect(open).toHaveBeenCalledWith(
      JOURNEY_URL,
      "tano-journey",
      expect.stringContaining("popup"),
    );

    open.mockReturnValue(null);
    const assign = vi.spyOn(window.location, "assign").mockImplementation(() => {});
    expect(launch({ url: JOURNEY_URL }).mode).toBe("redirect");
    expect(assign).toHaveBeenCalledWith(JOURNEY_URL);
  });

  it("dit que la fenêtre est bloquée quand on refuse la bascule", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    expect(() => launch({ url: JOURNEY_URL, fallbackToRedirect: false })).toThrow(/bloquée/);
  });
});

describe("le retour", () => {
  it("prévient l'onglet d'origine, qui confirme : la fenêtre se ferme", async () => {
    fakePopup();
    const onReturn = vi.fn();
    const handle = launch({ url: JOURNEY_URL, onReturn });
    const close = vi.spyOn(window, "close").mockImplementation(() => {});

    await expect(handleReturn()).resolves.toBe("popup");
    await handle.returned;
    expect(onReturn).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it("sans onglet qui attend, c'est une page : on y reste", async () => {
    const close = vi.spyOn(window, "close").mockImplementation(() => {});
    await expect(handleReturn({ timeoutMs: 50 })).resolves.toBe("page");
    expect(close).not.toHaveBeenCalled();
  });

  it("n'écoute plus une fois fermé", async () => {
    const { popup } = fakePopup();
    const onReturn = vi.fn();
    launch({ url: JOURNEY_URL, onReturn }).close();
    expect(popup.close).toHaveBeenCalled();
    await expect(handleReturn({ timeoutMs: 50 })).resolves.toBe("page");
    expect(onReturn).not.toHaveBeenCalled();
  });
});
