import { createHash, randomUUID } from "node:crypto";

import { type ApiErrorBody, TanoApiError, TanoConnectionError, TanoError } from "./errors.js";
import { parseKey, requestSignature } from "./signature.js";
import type {
  Case,
  CaseCreateParams,
  CaseData,
  CaseDecisionParams,
  CaseDecisionRecorded,
  CaseErasure,
  CaseImage,
  CaseListParams,
  CaseResults,
  JourneySession,
  Page,
  RequestOptions,
  SandboxSubmission,
  SessionCreateParams,
} from "./types.js";

export const VERSION = "0.1.1";
const DEFAULT_BASE_URL = "https://api.tano.africa";
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export interface TanoOptions {
  /** `tano_sandbox_…` pour le bac à sable, `tano_prod_…` en production. */
  apiKey: string;
  baseUrl?: string;
  /** Délai d'une tentative, en millisecondes. 30 s par défaut. */
  timeoutMs?: number;
  /** Réessais après une coupure réseau, un 429 ou un 5xx. 2 par défaut. */
  maxRetries?: number;
  fetch?: typeof fetch;
}

type Query = Record<string, string | number | readonly string[] | undefined>;

/**
 * Le client de l'API Tano.
 *
 * Il signe les créations (HMAC v2), pose une clé d'idempotence sur chacune et la garde d'un
 * réessai à l'autre : une requête rejouée après une coupure rend le même dossier, pas un second.
 */
export class Tano {
  readonly environment: "prod" | "sandbox" | "test";
  readonly cases: Cases;
  readonly sessions: Sessions;
  readonly sandbox: Sandbox;

  readonly #key: string;
  readonly #secret: string;
  readonly #baseUrl: string;
  readonly #timeoutMs: number;
  readonly #maxRetries: number;
  readonly #fetch: typeof fetch;
  /** Le dernier horodatage signé pour chaque requête identique (méthode, cible, corps). */
  readonly #lastSigned = new Map<string, number>();

  constructor(options: TanoOptions) {
    const parsed = parseKey(options.apiKey);
    if (parsed === null) {
      throw new TanoError("Clé d'API mal formée : attendue tano_<environnement>_<id>_<secret>.");
    }
    this.environment = parsed.environment;
    this.#key = options.apiKey.trim();
    this.#secret = parsed.secret;
    this.#baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.#timeoutMs = options.timeoutMs ?? 30_000;
    this.#maxRetries = options.maxRetries ?? 2;
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.cases = new Cases(this);
    this.sessions = new Sessions(this);
    this.sandbox = new Sandbox(this);
  }

  /**
   * L'horodatage à signer. La signature ne porte que sur l'horodatage, la méthode, la cible et le
   * corps : deux requêtes identiques dans la même seconde auraient la même, et l'API refuse une
   * signature déjà vue. Un réessai rapide, ou deux sessions demandées ensemble pour un même
   * dossier, prennent donc la seconde suivante ; l'API tolère cinq minutes d'écart.
   */
  #timestamp(method: string, target: string, payload: string): number {
    const id = createHash("sha256").update(`${method} ${target} `).update(payload).digest("hex");
    const now = Math.floor(Date.now() / 1000);
    const last = this.#lastSigned.get(id);
    const timestamp = last !== undefined && last >= now ? last + 1 : now;
    this.#lastSigned.delete(id);
    this.#lastSigned.set(id, timestamp);
    if (this.#lastSigned.size > 256) {
      const oldest = this.#lastSigned.keys().next().value;
      if (oldest !== undefined) this.#lastSigned.delete(oldest);
    }
    return timestamp;
  }

  /** Une lecture binaire (une image). Mêmes réessais et mêmes erreurs que `request`. */
  async requestBytes(path: string, options: RequestOptions = {}): Promise<CaseImage> {
    return this.#send("GET", path, "", undefined, options, async (response) => ({
      contentType: response.headers.get("content-type") ?? "application/octet-stream",
      data: Buffer.from(await response.arrayBuffer()),
    }));
  }

  /** Une requête brute, pour une route que le SDK n'expose pas encore. */
  async request<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    body?: unknown,
    options: RequestOptions & { query?: Query } = {},
  ): Promise<T> {
    const payload = body === undefined ? "" : JSON.stringify(body);
    return this.#send(
      method,
      path + queryString(options.query),
      payload,
      body,
      options,
      async (response) => {
        const text = await response.text();
        return (text === "" ? {} : safeJson(text)) as T;
      },
    );
  }

  async #send<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    target: string,
    payload: string,
    body: unknown,
    options: RequestOptions,
    read: (response: Response) => Promise<T>,
  ): Promise<T> {
    const idempotencyKey = method === "GET" ? undefined : (options.idempotencyKey ?? randomUUID());

    for (let attempt = 0; ; attempt += 1) {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.#key}`,
        Accept: "application/json",
        "User-Agent": `tano-node/${VERSION}`,
      };
      if (method !== "GET") {
        const timestamp = String(this.#timestamp(method, target, payload));
        headers["Content-Type"] = "application/json";
        headers["Idempotency-Key"] = idempotencyKey as string;
        headers["X-Tano-Timestamp"] = timestamp;
        headers["X-Tano-Signature"] = requestSignature(
          this.#secret,
          timestamp,
          method,
          target,
          payload,
        );
      }

      let response: Response;
      try {
        const timeout = AbortSignal.timeout(this.#timeoutMs);
        response = await this.#fetch(this.#baseUrl + target, {
          method,
          headers,
          ...(method === "GET" || body === undefined ? {} : { body: payload }),
          signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
        });
      } catch (error) {
        if (options.signal?.aborted) throw error;
        if (attempt < this.#maxRetries) {
          await pause(backoff(attempt));
          continue;
        }
        const reason = (error as Error).message;
        throw new TanoConnectionError(
          `L'API Tano n'a pas répondu (${reason}). Avec la même clé d'idempotence, rejouer la requête est sans risque.`,
        );
      }

      if (RETRYABLE.has(response.status) && attempt < this.#maxRetries) {
        await pause(retryAfter(response) ?? backoff(attempt));
        continue;
      }
      if (!response.ok) {
        const text = await response.text();
        const json: unknown = text === "" ? {} : safeJson(text);
        const error = (json as { error?: ApiErrorBody } | null)?.error ?? {};
        throw new TanoApiError(response.status, error, response.headers.get("x-request-id"));
      }
      return read(response);
    }
  }
}

class Cases {
  constructor(private readonly client: Tano) {}

  /** Ouvrir un dossier. */
  create(params: CaseCreateParams, options?: RequestOptions): Promise<Case> {
    return this.client.request("POST", "/v1/cases", params, options);
  }

  retrieve(id: string, options?: RequestOptions): Promise<Case> {
    return this.client.request("GET", `/v1/cases/${encodeURIComponent(id)}`, undefined, options);
  }

  /** Tout ce qui fonde la décision, sans donnée personnelle : l'état en un mot, la décision, la
   * reprise demandée, le compte rendu de chaque contrôle, les pièces reçues. */
  results(id: string, options?: RequestOptions): Promise<CaseResults> {
    return this.client.request(
      "GET",
      `/v1/cases/${encodeURIComponent(id)}/results`,
      undefined,
      options,
    );
  }

  /** Les données personnelles du dossier. Clé avec la permission `personal_data` ; la lecture est
   * inscrite au journal des consultations du dossier. */
  data(id: string, options?: RequestOptions): Promise<CaseData> {
    return this.client.request(
      "GET",
      `/v1/cases/${encodeURIComponent(id)}/data`,
      undefined,
      options,
    );
  }

  /** Une image du dossier (`pieces[].id` des résultats). Permission `personal_data`. */
  image(id: string, pieceId: string, options?: RequestOptions): Promise<CaseImage> {
    return this.client.requestBytes(
      `/v1/cases/${encodeURIComponent(id)}/images/${encodeURIComponent(pieceId)}`,
      options,
    );
  }

  /** Trancher un dossier **en revue** : approuver, refuser, ou demander une reprise. Permission
   * `decisions`. Le dossier conclut ensuite : webhook `case.decided` ou
   * `case.resubmission_requested`. Hors revue : `TanoApiError` `case_not_in_review`. */
  decide(
    id: string,
    params: CaseDecisionParams,
    options?: RequestOptions,
  ): Promise<CaseDecisionRecorded> {
    return this.client.request(
      "POST",
      `/v1/cases/${encodeURIComponent(id)}/decision`,
      params,
      options,
    );
  }

  /** Effacer les données personnelles d'un dossier **clos**. Permission `personal_data`. La
   * trace du dossier reste ; webhook `case.personal_data_erased`. */
  erase(id: string, options?: RequestOptions): Promise<CaseErasure> {
    return this.client.request("POST", `/v1/cases/${encodeURIComponent(id)}/erasure`, {}, options);
  }

  /** Une page de dossiers, du plus récent au plus ancien. */
  list(params: CaseListParams = {}, options?: RequestOptions): Promise<Page<Case>> {
    return this.client.request("GET", "/v1/cases", undefined, {
      ...options,
      query: {
        q: params.q,
        external_ref: params.external_ref,
        status: asList(params.status),
        country: asList(params.country),
        created_after: asDate(params.created_after),
        created_before: asDate(params.created_before),
        limit: params.limit,
        cursor: params.cursor,
      },
    });
  }

  /** Tous les dossiers qui répondent aux filtres, page après page. */
  async *listAll(params: CaseListParams = {}): AsyncGenerator<Case, void, undefined> {
    let cursor = params.cursor;
    for (;;) {
      const page = await this.list({ ...params, ...(cursor === undefined ? {} : { cursor }) });
      for (const item of page.data) yield item;
      if (!page.has_more || page.next_cursor === null) return;
      cursor = page.next_cursor;
    }
  }
}

class Sessions {
  constructor(private readonly client: Tano) {}

  /** Une session de parcours : son `url` est le lien à ouvrir, rendu une seule fois. */
  create(params: SessionCreateParams, options?: RequestOptions): Promise<JourneySession> {
    return this.client.request("POST", "/v1/sessions", params, options);
  }
}

class Sandbox {
  constructor(private readonly client: Tano) {}

  /** Bac à sable : faire comme si la personne avait terminé son parcours. Le nom de famille
   * déclaré choisit le résultat (TESTPASS, TESTREVIEW, TESTFAIL, TESTSANCTION…). */
  submit(caseId: string, options?: RequestOptions): Promise<SandboxSubmission> {
    return this.client.request(
      "POST",
      `/v1/sandbox/cases/${encodeURIComponent(caseId)}/submit`,
      {},
      options,
    );
  }
}

function queryString(query: Query | undefined): string {
  if (query === undefined) return "";
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) params.append(name, String(item));
  }
  const text = params.toString();
  return text === "" ? "" : `?${text}`;
}

function asList<T extends string>(value: T | readonly T[] | undefined): readonly T[] | undefined {
  if (value === undefined) return undefined;
  return typeof value === "string" ? [value] : (value as readonly T[]);
}

function asDate(value: string | Date | undefined): string | undefined {
  return value instanceof Date ? value.toISOString() : value;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function backoff(attempt: number): number {
  return Math.min(500 * 2 ** attempt, 4_000) * (0.75 + Math.random() / 2);
}

function retryAfter(response: Response): number | null {
  const value = Number(response.headers.get("retry-after"));
  return Number.isFinite(value) && value > 0 ? Math.min(value, 30) * 1000 : null;
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
