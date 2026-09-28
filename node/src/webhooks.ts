import { WebhookSignatureError } from "./errors.js";
import { deliverySignature, sameSignature } from "./signature.js";
import type { WebhookEvent } from "./types.js";

type Headers =
  | Readonly<Record<string, string | readonly string[] | undefined>>
  | globalThis.Headers;

function header(headers: Headers, name: string): string | undefined {
  if (typeof (headers as globalThis.Headers).get === "function") {
    return (headers as globalThis.Headers).get(name) ?? undefined;
  }
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (key.toLowerCase() === wanted) {
      return Array.isArray(value)
        ? (value[0] as string | undefined)
        : (value as string | undefined);
    }
  }
  return undefined;
}

export interface VerifyOptions {
  /** L'écart toléré avec l'horodatage de la livraison, en secondes. Cinq minutes par défaut. */
  toleranceSeconds?: number;
  now?: Date;
}

/**
 * Vérifier une livraison et la lire. Passez le **corps brut** (Buffer ou chaîne), jamais un objet
 * déjà désérialisé : la signature porte sur les octets reçus.
 *
 * Lève `WebhookSignatureError` si la signature est absente, fausse ou trop ancienne.
 */
export function verifyWebhook<T = Record<string, unknown>>(
  body: Buffer | string,
  headers: Headers,
  secret: string,
  options: VerifyOptions = {},
): WebhookEvent<T> {
  const timestamp = header(headers, "x-tano-timestamp");
  const signature = header(headers, "x-tano-signature");
  if (timestamp === undefined || signature === undefined || !/^\d+$/.test(timestamp)) {
    throw new WebhookSignatureError("En-têtes X-Tano-Timestamp et X-Tano-Signature attendus.");
  }
  const tolerance = options.toleranceSeconds ?? 300;
  const now = (options.now ?? new Date()).getTime() / 1000;
  if (Math.abs(now - Number(timestamp)) > tolerance) {
    throw new WebhookSignatureError("Livraison trop ancienne ou horloge décalée.");
  }
  if (!sameSignature(signature, deliverySignature(secret, timestamp, body))) {
    throw new WebhookSignatureError("Signature invalide : vérifiez le secret et le corps brut.");
  }
  const parsed = JSON.parse(typeof body === "string" ? body : body.toString("utf8")) as Omit<
    WebhookEvent<T>,
    "delivery_id"
  >;
  return { ...parsed, delivery_id: header(headers, "x-tano-delivery") ?? "" };
}
