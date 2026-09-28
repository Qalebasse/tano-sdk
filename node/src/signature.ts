import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * La signature des requêtes (v2) et celle des webhooks (v1), telles que l'API les calcule.
 *
 * Requête : `v2=` + hex(HMAC-SHA256(secret, horodatage.MÉTHODE.cible.corps)), le secret étant la
 * dernière partie de la clé. Webhook : `v1=` + hex(HMAC-SHA256(secret_webhook, horodatage.corps)).
 * Toujours sur les octets exacts : un JSON re-sérialisé n'est plus ce qui a été signé.
 */

const KEY = /^tano_(prod|sandbox|test)_([a-z0-9]{8})_([a-z0-9]{32})$/;

export interface ParsedKey {
  readonly environment: "prod" | "sandbox" | "test";
  readonly secret: string;
}

export function parseKey(key: string): ParsedKey | null {
  const match = KEY.exec(key.trim());
  if (match === null) return null;
  return { environment: match[1] as ParsedKey["environment"], secret: match[3] as string };
}

export function requestSignature(
  secret: string,
  timestamp: string,
  method: string,
  target: string,
  body: string,
): string {
  const digest = createHmac("sha256", secret)
    .update(`${timestamp}.${method.toUpperCase()}.${target}.`)
    .update(body)
    .digest("hex");
  return `v2=${digest}`;
}

export function deliverySignature(
  secret: string,
  timestamp: string,
  body: Buffer | string,
): string {
  return `v1=${createHmac("sha256", secret).update(`${timestamp}.`).update(body).digest("hex")}`;
}

/** Comparer en temps constant : une comparaison ordinaire dit, par sa durée, où elle diverge. */
export function sameSignature(received: string, expected: string): boolean {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
