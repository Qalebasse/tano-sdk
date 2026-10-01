/**
 * Le SDK navigateur de Tano.
 *
 * Votre serveur crée la session (`POST /v1/sessions`, avec `return_url`) et donne son `url` à la
 * page. `launch` ouvre le parcours dans une fenêtre, ou dans l'onglet si la fenêtre est bloquée.
 * À la fin, la personne arrive sur votre page de retour, qui appelle `handleReturn` : l'onglet
 * d'origine est prévenu, la fenêtre se ferme.
 *
 * Pourquoi ce détour : le parcours se coupe de la page qui l'a ouvert
 * (`Cross-Origin-Opener-Policy`), pour qu'aucune page tierce ne puisse le piloter. Votre page de
 * retour, elle, est sur votre domaine : elle parle à votre onglet par un `BroadcastChannel`.
 *
 * Le SDK ne transporte aucun résultat. La décision se lit côté serveur (webhook `case.decided`,
 * ou `GET /v1/cases/{id}`) : un message de navigateur se falsifie, une signature non.
 */

export type LaunchMode = "popup" | "redirect";

export interface LaunchOptions {
  /** Le lien de la session, tel que rendu par `POST /v1/sessions`. */
  readonly url: string;
  /** `popup` par défaut. */
  readonly mode?: LaunchMode;
  /** Si la fenêtre est bloquée, ouvrir le parcours dans l'onglet. Vrai par défaut. */
  readonly fallbackToRedirect?: boolean;
  /** La personne est arrivée sur votre page de retour : allez lire le dossier côté serveur. */
  readonly onReturn?: () => void;
  readonly width?: number;
  readonly height?: number;
}

export interface JourneyHandle {
  /** Comment le parcours s'est finalement ouvert. */
  readonly mode: LaunchMode;
  /** Résolue au retour de la personne (fenêtre seulement ; en redirection, l'onglet s'en va). */
  readonly returned: Promise<void>;
  /** Cesser d'écouter, et fermer la fenêtre si elle est encore à portée. */
  close(): void;
}

export type ReturnContext = "popup" | "page";

export interface HandleReturnOptions {
  /** Combien attendre la réponse de l'onglet d'origine, en millisecondes. 800 par défaut. */
  readonly timeoutMs?: number;
}

export const CHANNEL = "tano-journey";
const WINDOW_NAME = "tano-journey";

type Message =
  | { readonly type: "tano:returned"; readonly id: string }
  | { readonly type: "tano:ack"; readonly id: string };

export class TanoWebError extends Error {
  override readonly name = "TanoWebError";
  readonly code: "invalid_url" | "popup_blocked" | "unsupported";
  constructor(code: TanoWebError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

/** Le lien d'un parcours : HTTPS, ou `http://localhost` pour le développement. */
export function checkJourneyUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new TanoWebError("invalid_url", "Lien de parcours illisible.");
  }
  const local = parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !local) {
    throw new TanoWebError("invalid_url", "Le lien du parcours doit être en HTTPS.");
  }
  return parsed;
}

function features(width: number, height: number): string {
  const left = Math.max(0, Math.round((window.screen.width - width) / 2));
  const top = Math.max(0, Math.round((window.screen.height - height) / 2));
  return `popup,width=${width},height=${height},left=${left},top=${top}`;
}

/** Ouvrir le parcours. Appelez-le depuis un clic : un navigateur bloque une fenêtre ouverte sans
 * geste de la personne. */
export function launch(options: LaunchOptions): JourneyHandle {
  const url = checkJourneyUrl(options.url).toString();
  const wanted = options.mode ?? "popup";

  if (wanted === "popup") {
    const popup = window.open(
      url,
      WINDOW_NAME,
      features(options.width ?? 480, options.height ?? 760),
    );
    if (popup !== null) return listen(popup, options);
    if (options.fallbackToRedirect === false) {
      throw new TanoWebError(
        "popup_blocked",
        "La fenêtre du parcours a été bloquée par le navigateur.",
      );
    }
  }
  window.location.assign(url);
  return { mode: "redirect", returned: new Promise<void>(() => {}), close: () => {} };
}

function listen(popup: Window, options: LaunchOptions): JourneyHandle {
  if (typeof BroadcastChannel === "undefined") {
    // Sans canal, on ne saura pas quand la personne revient : le parcours reste utilisable, le
    // serveur saura, par son webhook.
    return { mode: "popup", returned: new Promise<void>(() => {}), close: () => popup.close() };
  }
  const channel = new BroadcastChannel(CHANNEL);
  let settle: () => void = () => {};
  const returned = new Promise<void>((resolve) => {
    settle = resolve;
  });
  let done = false;
  channel.onmessage = (event: MessageEvent<Message>) => {
    if (event.data?.type !== "tano:returned" || done) return;
    done = true;
    channel.postMessage({ type: "tano:ack", id: event.data.id } satisfies Message);
    channel.close();
    options.onReturn?.();
    settle();
  };
  return {
    mode: "popup",
    returned,
    close: () => {
      done = true;
      channel.close();
      popup.close();
    },
  };
}

/**
 * À appeler sur votre page de retour. Rend `popup` si un onglet attendait ce retour (la fenêtre
 * tente alors de se fermer ; si le navigateur refuse, affichez « Vous pouvez fermer cette
 * fenêtre »), `page` sinon : le parcours avait été ouvert dans l'onglet même, continuez-y.
 */
export function handleReturn(options: HandleReturnOptions = {}): Promise<ReturnContext> {
  if (typeof BroadcastChannel === "undefined") return Promise.resolve("page");
  const channel = new BroadcastChannel(CHANNEL);
  const id = Math.random().toString(36).slice(2);
  return new Promise<ReturnContext>((resolve) => {
    const timer = setTimeout(() => {
      channel.close();
      resolve("page");
    }, options.timeoutMs ?? 800);
    channel.onmessage = (event: MessageEvent<Message>) => {
      if (event.data?.type !== "tano:ack" || event.data.id !== id) return;
      clearTimeout(timer);
      channel.close();
      resolve("popup");
      window.close();
    };
    channel.postMessage({ type: "tano:returned", id } satisfies Message);
  });
}

// ── Intégration dans la page (iframe) ────────────────────────────────────────

export type EmbedStep =
  | "consent"
  | "applicant"
  | "questionnaire"
  | "document"
  | "face"
  | "check"
  | "uploading"
  | "help";

export type EndReason = "declined" | "expired" | "invalid_link" | "later";

/** Ce que le parcours intégré dit à votre page. Aucun résultat : la décision se lit côté serveur. */
export type JourneyEvent =
  | { readonly type: "tano:ready"; readonly version: number }
  | { readonly type: "tano:step"; readonly step: EmbedStep }
  | { readonly type: "tano:completed" }
  | { readonly type: "tano:ended"; readonly reason: EndReason }
  | { readonly type: "tano:resize"; readonly height: number };

export interface MountOptions {
  /** Le lien de la session, tel que rendu par `POST /v1/sessions`. */
  readonly url: string;
  /** Le parcours est affiché, la page hôte reconnue. */
  readonly onReady?: () => void;
  readonly onStep?: (step: EmbedStep) => void;
  /** La personne a tout envoyé : allez lire le dossier côté serveur. */
  readonly onCompleted?: () => void;
  /** Le parcours s'est arrêté sans envoi : refus, lien expiré ou mort, « plus tard ». */
  readonly onEnded?: (reason: EndReason) => void;
  /** Tous les événements, tels quels. */
  readonly onEvent?: (event: JourneyEvent) => void;
  /**
   * Le lien a expiré : rendez-en un nouveau (votre serveur crée une session pour le même
   * dossier) et le parcours reprend dans le même cadre. Sans ce rappel, `onEnded("expired")`.
   */
  readonly onExpired?: () => Promise<string>;
  /** Suivre la hauteur du parcours (vrai par défaut) ; sinon, `minHeight` fixe. */
  readonly autoHeight?: boolean;
  readonly minHeight?: number;
  /** Le titre du cadre, lu par les lecteurs d'écran. */
  readonly title?: string;
}

export interface MountedJourney {
  readonly iframe: HTMLIFrameElement;
  /** Retirer le parcours de la page et cesser d'écouter. */
  destroy(): void;
}

/** L'adresse d'intégration d'un lien de session : même origine, chemin `/embed`, même fragment. */
export function embedUrl(url: string): URL {
  const parsed = checkJourneyUrl(url);
  parsed.pathname = "/embed";
  parsed.search = "";
  return parsed;
}

/**
 * Afficher le parcours dans votre page. Votre origine doit figurer parmi les domaines autorisés
 * (console, page Développeurs) : le parcours ne s'affiche qu'après s'être assuré, par une poignée
 * de main que le navigateur atteste, qu'il est bien dans une page à vous.
 */
export function mount(target: HTMLElement | string, options: MountOptions): MountedJourney {
  const host = typeof target === "string" ? document.querySelector<HTMLElement>(target) : target;
  if (host === null)
    throw new TanoWebError("invalid_url", `Élément introuvable : ${String(target)}.`);

  let current = embedUrl(options.url);
  const iframe = document.createElement("iframe");
  iframe.src = current.toString();
  // La caméra est déléguée au parcours, et à lui seul ; rien d'autre.
  iframe.allow = "camera";
  iframe.title = options.title ?? "Vérification d'identité";
  iframe.referrerPolicy = "no-referrer";
  iframe.style.border = "0";
  iframe.style.width = "100%";
  iframe.style.height = `${options.minHeight ?? 640}px`;
  host.appendChild(iframe);

  let renewing = false;
  const onMessage = (event: MessageEvent) => {
    if (event.source !== iframe.contentWindow || event.origin !== current.origin) return;
    const data = event.data as { type?: unknown } | null;
    if (data === null || typeof data.type !== "string") return;
    if (data.type === "tano:hello") {
      iframe.contentWindow?.postMessage({ type: "tano:init", version: 1 }, current.origin);
      return;
    }
    const journey = data as JourneyEvent;
    options.onEvent?.(journey);
    switch (journey.type) {
      case "tano:ready":
        options.onReady?.();
        break;
      case "tano:step":
        options.onStep?.(journey.step);
        break;
      case "tano:completed":
        options.onCompleted?.();
        break;
      case "tano:resize":
        if (options.autoHeight !== false) {
          iframe.style.height = `${Math.max(journey.height, options.minHeight ?? 0)}px`;
        }
        break;
      case "tano:ended":
        if (journey.reason === "expired" && options.onExpired !== undefined && !renewing) {
          renewing = true;
          options
            .onExpired()
            .then((fresh) => {
              current = embedUrl(fresh);
              iframe.src = current.toString();
            })
            .catch(() => options.onEnded?.("expired"))
            .finally(() => {
              renewing = false;
            });
          break;
        }
        options.onEnded?.(journey.reason);
        break;
    }
  };
  window.addEventListener("message", onMessage);
  return {
    iframe,
    destroy: () => {
      window.removeEventListener("message", onMessage);
      iframe.remove();
    },
  };
}
