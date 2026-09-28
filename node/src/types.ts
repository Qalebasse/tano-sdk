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
  /** Votre référence, exacte. */
  external_ref?: string;
  status?: CaseStatus | readonly CaseStatus[];
  country?: string | readonly string[];
  created_after?: string | Date;
  created_before?: string | Date;
  limit?: number;
  cursor?: string;
}

/** L'état d'un dossier en un mot. `resubmission_requested` n'est pas un refus : la personne doit
 * reprendre des photos. `rejected` est un refus définitif (une révision reste possible). */
export type CaseState =
  | "awaiting_applicant"
  | "processing"
  | "in_review"
  | "resubmission_requested"
  | "approved"
  | "rejected"
  | "expired"
  | "abandoned"
  | (string & {});

export interface CheckReport {
  readonly step_name: string | null;
  readonly step_type: string | null;
  readonly occurred_at: string;
  readonly status: "ok" | "attention" | "failed" | null;
  readonly reasons: readonly string[];
  readonly measures: Readonly<Record<string, unknown>>;
}

/** `GET /v1/cases/{id}/results` : tout ce qui fonde la décision, sans donnée personnelle. */
export interface CaseResults {
  readonly case: {
    readonly id: string;
    readonly external_ref: string | null;
    readonly flow_name: string;
    readonly country: string;
    readonly status: CaseStatus;
    readonly environment: Environment;
    readonly created_at: string;
    readonly closed_at: string | null;
  };
  readonly state: CaseState;
  readonly decision: {
    readonly outcome: string;
    readonly reason_code: string;
    readonly automatic: boolean;
    readonly made_at: string;
    readonly revised: boolean;
  } | null;
  readonly resubmission: {
    readonly number: number;
    readonly steps: readonly string[];
    readonly reason_code: string | null;
  } | null;
  readonly signals: number;
  readonly checks: readonly CheckReport[];
  readonly duplicates: readonly Readonly<Record<string, unknown>>[];
  readonly pieces: readonly {
    readonly id: string;
    readonly subject: string;
    readonly status: string;
    readonly captured_at: string | null;
    readonly available: boolean;
  }[];
}

/** `GET /v1/cases/{id}/data` : les données personnelles. Clé avec la permission
 * `personal_data` ; chaque lecture est inscrite au journal du dossier. */
export interface CaseData {
  readonly access_id: string;
  readonly identity: {
    readonly fields: Readonly<Record<string, string | null>>;
    readonly agreements: Readonly<Record<string, string>>;
  } | null;
  readonly declared: Readonly<Record<string, string>>;
  readonly applicant_data: Readonly<Record<string, unknown>> | null;
  readonly questionnaires: readonly Readonly<Record<string, unknown>>[];
}

export interface CaseImage {
  readonly contentType: string;
  readonly data: Buffer;
}

/** `POST /v1/cases/{id}/decision` : trancher un dossier en revue. Permission `decisions`. */
export interface CaseDecisionParams {
  outcome: "approve" | "reject" | "resubmit";
  /** Un motif de la liste fermée (`identity_confirmed`, `document_forged`…). */
  reason_code: string;
  /** Pour `resubmit` : ce que la personne doit reprendre. */
  steps?: readonly ("document" | "face")[];
  comment?: string;
}

export interface CaseDecisionRecorded {
  readonly id: string;
  readonly case_id: string;
  readonly outcome: string;
  readonly case_outcome_notified: string | null;
}

/** `POST /v1/cases/{id}/erasure` : ce qui a été effacé, par nature. Des zéros au second appel. */
export interface CaseErasure {
  readonly case_id: string;
  readonly erased: Readonly<
    Record<"images" | "declared" | "identity" | "documents" | "review", number>
  >;
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
  /** Pour un dossier, aussi `external_ref`, `flow_name` et `environment`. */
  readonly object: {
    readonly id: string;
    readonly type: string;
    readonly external_ref?: string | null;
    readonly flow_name?: string;
    readonly environment?: Environment;
  };
  readonly data: T;
  /** `X-Tano-Delivery` : gardez-le pour écarter les doublons. */
  readonly delivery_id: string;
}
