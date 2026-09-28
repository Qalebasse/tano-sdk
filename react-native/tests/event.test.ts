import { describe, expect, it } from "vitest";

import { journeyUrlAllowed, originOf, parseEvent } from "../src/event";

describe("les événements du parcours", () => {
  it("se lisent", () => {
    expect(parseEvent('{"type":"tano:ready","version":1}')).toEqual({ type: "ready" });
    expect(parseEvent('{"type":"tano:step","step":"face"}')).toEqual({
      type: "step",
      step: "face",
    });
    expect(parseEvent('{"type":"tano:completed"}')).toEqual({ type: "completed" });
    expect(parseEvent('{"type":"tano:ended","reason":"expired"}')).toEqual({
      type: "ended",
      reason: "expired",
    });
  });

  it("ignorent ce qui n'en est pas", () => {
    expect(parseEvent("pas du json")).toBeNull();
    expect(parseEvent('{"type":"tano:resize","height":8}')).toBeNull();
    expect(parseEvent('{"type":"tano:step"}')).toBeNull();
  });
});

describe("les liens", () => {
  it("n'admettent que HTTPS ou localhost, et se comparent par origine", () => {
    expect(journeyUrlAllowed("https://verify.tano.africa/#t")).toBe(true);
    expect(journeyUrlAllowed("http://localhost:5188/#t")).toBe(true);
    expect(journeyUrlAllowed("http://verify.tano.africa/#t")).toBe(false);
    expect(originOf("https://Verify.tano.africa:443/v1/x")).toBe("https://verify.tano.africa");
  });
});
