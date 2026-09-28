/**
 * Les objets de l'API, sous leurs noms de champs d'API (`snake_case`) : ce que la documentation
 * montre est ce que le SDK rend, sans traduction à apprendre.
 */

export type CaseStatus =
  | "created"
  | "collecting"
  | "processing"
  | "review"
  | "decided"
  | "abandoned"
  | "expired";

export type Environment = "prod" | "sandbox" | "test";

export interface Decision {
  readonly outcome: "approved" | "rejected" | (string & {});
  readonly reason_code: string | null;
  readonly made_at: string | null;
}

export interface CaseStep {
  readonly name: string;
  readonly type: string | null;
  readonly outcome: string | null;
  readonly check: string | null;
  readonly signals: number;
}

export interface Case {
  readonly id: string;
  readonly status: CaseStatus;
  readonly flow_name: string;
  readonly country: string;
  readonly external_ref: string | null;
  readonly created_at: string;
  readonly expires_at: string;
  readonly closed_at: string | null;
  readonly environment: Environment;
  /** Présents dans les listes, et dans la lecture d'un dossier quand l'API les rend. */
  readonly steps?: readonly CaseStep[];
  readonly signals?: number;
  readonly decision?: Decision | null;
}

/** Ce que vous savez déjà de la personne : confronté à la pièce, jamais cru ; préremplit le
 * formulaire du parcours. */
export interface DeclaredData {
  surname?: string;
  given_names?: string;
  birth_date?: string;
  place_of_birth?: string;
  country_of_birth?: string;
  sex?: "F" | "M" | "X";
  nationality?: string;
  phone?: string;
  email?: string;
  country?: string;
  city?: string;
  district?: string;
  street?: string;
  landmark?: string;
  postcode?: string;
  tax_residence_country?: string;
  tax_number?: string;
  father_name?: string;
  mother_name?: string;
}

export interface CaseCreateParams {
  /** Le nom du parcours, tel que dans la console. */
  flow_name: string;
  /** Le pays du dossier, en deux lettres (`CI`). */
  country: string;
  /** Votre référence : un dossier par intention, même si la requête est rejouée. */
  external_ref?: string;
  declared?: DeclaredData;
}

export interface CaseListParams {
  q?: string;
  status?: CaseStatus | readonly CaseStatus[];
  country?: string | readonly string[];
  created_after?: string | Date;
  created_before?: string | Date;
  limit?: number;
  cursor?: string;
}

export interface Page<T> {
  readonly data: readonly T[];
  readonly has_more: boolean;
  readonly next_cursor: string | null;
}

export interface SessionCreateParams {
  case_id: string;
  locale?: string;
  /** De 1 à 60 minutes. */
  lifetime_minutes?: number;
  /** Où revient la personne à la fin : HTTPS, sans paramètre ni fragment. Remplace celle du
   * parcours pour cette session. Le SDK web s'en sert pour la fenêtre. */
  return_url?: string;
}

/** Une session de parcours. `url` et `token` ne sont rendus qu'une fois : transmettez-les, ne
 * les stockez pas. */
export interface JourneySession {
  readonly id: string;
  readonly case_id: string;
  readonly token: string;
  readonly url: string;
  readonly expires_at: string;
}

export interface SandboxSubmission {
  readonly case_id: string;
  readonly session_id: string;
  readonly status: "submitted";
}

export interface RequestOptions {
  /** Réutilisez la même clé pour rejouer la même intention ; le SDK en tire une sinon. */
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export interface WebhookEvent<T = Record<string, unknown>> {
  readonly type: string;
  readonly occurred_at: string;
  readonly object: { readonly id: string; readonly type: string };
  readonly data: T;
  /** `X-Tano-Delivery` : gardez-le pour écarter les doublons. */
  readonly delivery_id: string;
}
