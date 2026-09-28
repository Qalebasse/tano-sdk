import { describe, expect, it } from "vitest";

import { WebhookSignatureError, verifyWebhook } from "../src/index.js";

// Vecteur calculé par tano-core (`delivery_signature`).
const BODY = '{"type":"case.decided"}';
const HEADERS = {
  "X-Tano-Timestamp": "1790000000",
  "X-Tano-Signature": "v1=8e5d28525962ab99896db695a13c979052990b0a0edfbb011e5c94485bdd49d8",
  "X-Tano-Delivery": "dlv_1",
};
const NOW = new Date(1790000000 * 1000 + 30_000);

describe("la vérification des webhooks", () => {
  it("accepte une livraison signée par l'API, et rend l'événement", () => {
    const event = verifyWebhook(Buffer.from(BODY), HEADERS, "whsec_exemple", { now: NOW });
    expect(event).toMatchObject({ type: "case.decided", delivery_id: "dlv_1" });
  });

  it("lit les en-têtes sans tenir compte de la casse, ou depuis un objet Headers", () => {
    const lower = Object.fromEntries(Object.entries(HEADERS).map(([k, v]) => [k.toLowerCase(), v]));
    expect(verifyWebhook(BODY, lower, "whsec_exemple", { now: NOW }).type).toBe("case.decided");
    expect(verifyWebhook(BODY, new Headers(HEADERS), "whsec_exemple", { now: NOW }).type).toBe(
      "case.decided",
    );
  });

  it.each([
    ["un autre secret", BODY, HEADERS, "autre"],
    ["un corps modifié", '{"type":"case.decided" }', HEADERS, "whsec_exemple"],
    ["sans signature", BODY, { "X-Tano-Timestamp": "1790000000" }, "whsec_exemple"],
  ])("refuse %s", (_nom, body, headers, secret) => {
    expect(() => verifyWebhook(body, headers, secret, { now: NOW })).toThrow(WebhookSignatureError);
  });

  it("refuse une livraison trop ancienne", () => {
    const later = new Date(NOW.getTime() + 10 * 60_000);
    expect(() => verifyWebhook(BODY, HEADERS, "whsec_exemple", { now: later })).toThrow(/ancienne/);
  });
});
