/** Ce que le parcours dit à l'application. Aucun résultat : la décision se lit côté serveur. */
export type TanoEvent =
  | { readonly type: "ready" }
  | { readonly type: "step"; readonly step: string }
  | { readonly type: "completed" }
  | { readonly type: "ended"; readonly reason: string };

/** Lire un message du parcours (JSON) ; `null` pour ce qui n'est pas un événement connu. */
export function parseEvent(message: string): TanoEvent | null {
  let data: unknown;
  try {
    data = JSON.parse(message);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const { type, step, reason } = data as { type?: unknown; step?: unknown; reason?: unknown };
  switch (type) {
    case "tano:ready":
      return { type: "ready" };
    case "tano:step":
      return typeof step === "string" ? { type: "step", step } : null;
    case "tano:completed":
      return { type: "completed" };
    case "tano:ended":
      return typeof reason === "string" ? { type: "ended", reason } : null;
    default:
      return null;
  }
}

/** L'origine d'une adresse (`https://hote[:port]`), ou `null`. */
export function originOf(url: string): string | null {
  const match = /^(https?):\/\/([^/?#:]+)(:\d+)?/i.exec(url);
  if (match === null) return null;
  const [, scheme, host, port] = match as unknown as [string, string, string, string | undefined];
  const s = scheme.toLowerCase();
  const p = port === undefined || port === (s === "https" ? ":443" : ":80") ? "" : port;
  return `${s}://${host.toLowerCase()}${p}`;
}

/** Le lien d'un parcours : HTTPS, ou http://localhost pour le développement. */
export function journeyUrlAllowed(url: string): boolean {
  const origin = originOf(url);
  return (
    origin !== null &&
    (origin.startsWith("https://") || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
  );
}
