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

// ── Signature électronique ──────────────────────────────────────────────────

export type SignatureRequestStatus =
  | "draft"
  | "ongoing"
  | "completed"
  | "declined"
  | "expired"
  | "cancelled";

export type SignerStatus =
  | "pending"
  | "notified"
  | "opened"
  | "authenticated"
  | "signed"
  | "declined";

export type FieldKind =
  | "signature"
  | "initials"
  | "date"
  | "text"
  | "checkbox"
  | "mention"
  | "radio"
  | "signer_name"
  | "signer_email"
  | "read_only_text";

export type DateFormat =
  | "dd/MM/yyyy"
  | "dd-MM-yyyy"
  | "dd.MM.yyyy"
  | "yyyy-MM-dd"
  | "MM/dd/yyyy"
  | "dd MMMM yyyy";

/** Un champ placé sur une page, en points PDF depuis le coin **bas gauche** de la page. */
export interface SignatureFieldParams {
  /** L'indice du document dans la demande, à partir de 0. */
  document: number;
  kind: FieldKind;
  /** La page, à partir de 1. */
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** `true` par défaut. */
  required?: boolean;
  /** Pour `kind: "mention"` : la phrase à recopier, par exemple « Lu et approuvé » ; `%date%` y
   * devient la date du jour. */
  mention?: string;
  /** `text`, `checkbox`, `radio` : le libellé montré au signataire. */
  label?: string;
  /** `text` : de 1 à 500, 200 par défaut. */
  max_length?: number;
  /** `text` : la valeur proposée, que le signataire peut changer. */
  default_value?: string;
  /** `date` : `dd/MM/yyyy` par défaut ; `dd MMMM yyyy` écrit le mois en toutes lettres. */
  date_format?: DateFormat;
  /** `signature` : `detailed` (nom, date, heure) par défaut, ou `minimal` (le nom seul). */
  layout?: "minimal" | "detailed";
  /** `signature` : un motif inscrit sous la signature, 150 caractères au plus. */
  reason?: string;
  /** `radio` : le groupe de l'option (deux options au moins) et sa valeur. */
  group?: string;
  value?: string;
  /** `signer_name` : `full` par défaut, `given` ou `family`. */
  name_format?: "full" | "given" | "family";
  /** `read_only_text` : le texte inscrit tel quel. */
  text?: string;
}

export interface SignerParams {
  given_name: string;
  family_name: string;
  /** Pour `otp_email`. */
  email?: string;
  /** Pour `otp_sms`, au format international (`+2250701021234`). */
  phone?: string;
  auth_method: "otp_email" | "otp_sms";
  /** `signer` par défaut ; `approver` approuve sans champ de signature, `viewer` reçoit une copie. */
  role?: "signer" | "approver" | "viewer";
  /** Son rang en ordre séquentiel, à partir de 1. */
  position?: number;
  locale?: "fr" | "en";
  /** Pour les heures calmes des relances. `Africa/Abidjan` par défaut. */
  time_zone?: string;
  fields?: readonly SignatureFieldParams[];
  /** Les documents qu'il ne voit pas : leurs indices dans la demande, à partir de 0. Un
   * signataire ou un approbateur en voit au moins un ; aucun champ sur un document caché. */
  hidden_documents?: readonly number[];
  /** Celui de la demande par défaut. */
  delivery?: Delivery;
  /** Ses textes, qui l'emportent, clé par clé, sur ceux de la demande. */
  custom_text?: CustomText;
  /** Ses adresses de retour, qui l'emportent, clé par clé, sur celles de la demande. */
  redirect_urls?: RedirectUrls;
}

/** `email` : Tano invite et relance. `none` : Tano n'écrit pas, vous remettez le lien vous-même
 * (`signatureRequests.link`). */
export type Delivery = "email" | "none";

/** L'objet et le corps de l'invitation et de la relance, à la place de ceux de Tano.
 * `{organisation}`, `{request}` et `{given_name}` y sont remplacés ; le lien suit toujours. */
export interface CustomText {
  invitation_subject?: string;
  invitation_body?: string;
  reminder_subject?: string;
  reminder_body?: string;
}

/** Où la page de signature renvoie le signataire, en HTTPS. Tano y ajoute
 * `signature_request_id`, `signer_id` et `reference`. */
export interface RedirectUrls {
  success?: string;
  decline?: string;
  error?: string;
}

/** Un PDF à faire signer ou à sceller : ses octets, ou déjà en base 64. */
export type PdfContent = Uint8Array | string;

export interface SignatureRequestCreateParams extends SignatureRequestBaseParams {
  name: string;
  /** Les PDF : le SDK encode les octets en base 64. */
  documents: readonly { filename: string; content: PdfContent }[];
  signers: readonly SignerParams[];
  template_id?: undefined;
}

/** Une demande tirée d'un modèle : ses documents, ses rôles et leurs champs viennent du modèle. */
export interface SignatureRequestFromTemplateParams extends SignatureRequestBaseParams {
  template_id: string;
  /** Le nom du modèle par défaut. */
  name?: string;
  documents?: undefined;
  /** Une personne par rôle, dans l'ordre des rôles du modèle. */
  signers: readonly TemplateSignerParams[];
}

/** Une personne pour un rôle du modèle : son rang, son rôle et ses champs viennent du modèle. */
export type TemplateSignerParams = Pick<
  SignerParams,
  | "given_name"
  | "family_name"
  | "email"
  | "phone"
  | "auth_method"
  | "locale"
  | "delivery"
  | "custom_text"
  | "redirect_urls"
>;

/** Ce qu'une demande accepte qu'elle vienne de vos documents ou d'un modèle. Pour une demande
 * tirée d'un modèle, `ordering`, `expires_in_days`, `message` et `reminder_days` l'emportent sur
 * le modèle seulement s'ils sont envoyés. */
export interface SignatureRequestBaseParams {
  reference?: string;
  ordering?: "sequential" | "parallel";
  level?: "simple";
  message?: string;
  locale?: "fr" | "en";
  /** De 1 à 90. 30 par défaut. */
  expires_in_days?: number;
  /** Les jours de relance après l'invitation, deux au plus. `[2, 5]` par défaut, `[]` pour aucune. */
  reminder_days?: readonly number[];
  /** `true` pour envoyer la demande dans le même appel. */
  activate?: boolean;
  /** `email` par défaut. */
  delivery?: Delivery;
  custom_text?: CustomText;
  redirect_urls?: RedirectUrls;
  /** Vos paires clé → texte, jointes à chaque webhook de la demande. Pas de donnée personnelle. */
  metadata?: Readonly<Record<string, string | number>>;
}

export interface SignatureRequestUpdateParams {
  /** Fusionnées avec les métadonnées actuelles ; `null` retire une clé. */
  metadata?: Readonly<Record<string, string | number | null>>;
  /** Reporter l'échéance d'une demande en cours (90 jours au plus après l'envoi). */
  expires_at?: string | Date;
}

/** Corriger un signataire qui n'a pas répondu ; invité, il reçoit un nouveau lien. */
export interface SignerUpdateParams {
  given_name?: string;
  family_name?: string;
  email?: string;
  phone?: string;
  auth_method?: "otp_email" | "otp_sms";
}

export interface SignatureRequestSigner {
  readonly id: string;
  readonly position: number;
  readonly role: "signer" | "approver" | "viewer";
  readonly status: SignerStatus;
  readonly auth_method: "otp_email" | "otp_sms";
  /** L'adresse ou le numéro, masqués. */
  readonly contact: string | null;
  /** Rendu seulement à une clé qui porte la permission `personal_data`. */
  readonly name: string | null;
  readonly notified_at: string | null;
  readonly signed_at: string | null;
  /** Ses champs, ceux des ancres compris. */
  readonly fields?: readonly SignatureRequestField[];
  readonly delivery?: Delivery;
  readonly reminded_at?: string | null;
  /** Les identifiants (`sd_…`) des documents qu'il ne voit pas. */
  readonly hidden_documents?: readonly string[];
}

export interface SignatureRequest {
  readonly id: string;
  readonly name: string;
  readonly status: SignatureRequestStatus;
  readonly level: "simple";
  readonly ordering: "sequential" | "parallel";
  readonly reference: string | null;
  readonly environment: Environment;
  readonly created_at: string | null;
  readonly activated_at: string | null;
  readonly expires_at: string | null;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly reactivated_at?: string | null;
  /** Le modèle dont la demande est tirée. */
  readonly template_id?: string | null;
  readonly documents: readonly {
    readonly id: string;
    readonly position: number;
    readonly pages: number;
    readonly sha256: string;
  }[];
  readonly signers: readonly SignatureRequestSigner[];
}

/** Un champ d'un signataire tel que le service l'a posé — par coordonnées ou par ancre. */
export interface SignatureRequestField extends Partial<Omit<SignatureFieldParams, "document">> {
  readonly id: string;
  readonly document_id: string;
  readonly kind: FieldKind;
  readonly page: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly required: boolean;
}

export interface SignatureRequestSummary {
  readonly id: string;
  readonly name: string;
  readonly status: SignatureRequestStatus;
  readonly reference: string | null;
  readonly created_at: string | null;
  readonly environment: Environment;
}

export interface SignatureRequestListParams {
  status?: SignatureRequestStatus;
  /** Votre référence, exacte. */
  reference?: string;
  /** De 1 à 100. 50 par défaut. */
  limit?: number;
}

export interface SigningLink {
  /** Le lien de signature. Il remplace le précédent ; ne le stockez pas. */
  readonly url: string;
}

export interface SandboxAnswer {
  readonly id: string;
  readonly status: SignatureRequestStatus;
}

/** Un PDF téléchargé : ses octets et ce que disent ses en-têtes. */
export interface PdfFile {
  readonly data: Buffer;
  /** `X-Tano-Document-Sha256` : l'empreinte du fichier. */
  readonly sha256: string | null;
  /** `X-Tano-Document-Signed` : le document est-il la version signée. `null` hors document signé. */
  readonly signed: boolean | null;
  /** `X-Tano-Sandbox` : un spécimen de bac à sable, sans valeur. */
  readonly sandbox: boolean;
}

// ── Modèles de signature ────────────────────────────────────────────────────

export type SignerRole = "signer" | "approver" | "viewer";

/** Un rôle du modèle : la personne qui le tiendra est nommée à la création de la demande. */
export interface SignatureTemplateRoleParams {
  /** De 1 à 60 caractères, unique dans le modèle sans tenir compte de la casse. */
  label: string;
  /** `signer` par défaut. */
  role?: SignerRole;
  /** Son rang en ordre séquentiel, à partir de 1. */
  position?: number;
  fields?: readonly SignatureFieldParams[];
  /** Les documents que ce rôle ne voit pas : leurs indices dans le modèle, à partir de 0. */
  hidden_documents?: readonly number[];
}

export interface SignatureTemplateCreateParams {
  name: string;
  /** Les PDF : le SDK encode les octets en base 64. */
  documents: readonly { filename: string; content: PdfContent }[];
  roles: readonly SignatureTemplateRoleParams[];
  ordering?: "sequential" | "parallel";
  /** De 1 à 90. */
  expires_in_days?: number;
  message?: string;
  /** Deux jours de relance au plus. */
  reminder_days?: readonly number[];
}

/** Un champ d'un rôle, tel que le modèle le garde. */
export type SignatureTemplateField = Readonly<SignatureFieldParams> & {
  readonly required: boolean;
};

export interface SignatureTemplateRole {
  readonly label: string;
  readonly role: SignerRole;
  readonly position: number;
  /** Les indices des documents que ce rôle ne voit pas. */
  readonly hidden_documents: readonly number[];
  readonly fields: readonly SignatureTemplateField[];
}

export interface SignatureTemplate {
  readonly id: string;
  readonly name: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly ordering: "sequential" | "parallel";
  readonly expires_in_days: number;
  readonly message: string | null;
  readonly reminder_days: readonly number[];
  readonly documents: readonly {
    readonly id: string;
    readonly position: number;
    readonly pages: number;
    readonly sha256: string;
  }[];
  readonly roles: readonly SignatureTemplateRole[];
}

export interface SignatureTemplateSummary {
  readonly id: string;
  readonly name: string;
  /** Le nombre de documents. */
  readonly documents: number;
  /** Le nombre de rôles. */
  readonly roles: number;
  readonly updated_at: string;
}

// ── Cachet électronique ─────────────────────────────────────────────────────

export interface SealProfile {
  readonly id: string;
  readonly label: string;
  readonly level: string;
  /** `organisation` : le vôtre ; `tano` : Tano scelle pour le compte de votre organisation. */
  readonly owner: "organisation" | "tano";
  readonly not_after: string | null;
  readonly revoked: boolean;
}

export interface SealCreateParams {
  profile_id: string;
  /** Le PDF : le SDK encode les octets en base 64. */
  document: PdfContent;
  reference?: string;
}

export interface Seal {
  readonly id: string;
  readonly status: "sealed" | "failed";
  readonly profile_id: string;
  readonly on_behalf: boolean;
  readonly reference: string | null;
  readonly sealed_sha256: string | null;
  readonly failure: string | null;
  readonly created_at: string | null;
  readonly sealed_at: string | null;
  readonly environment: Environment;
}

/** `POST /v1/verify` : les signatures et cachets d'un PDF, et leur intégrité. */
export interface DocumentVerification {
  readonly signed: boolean;
  /** Toutes les signatures sont intègres, justes, reconnues et inchangées depuis. */
  readonly sound: boolean;
  readonly signatures: readonly {
    readonly field: string | null;
    readonly signer: string | null;
    readonly intact: boolean;
    readonly valid: boolean;
    readonly trusted: boolean;
    readonly untouched_since_signing: boolean;
    readonly timestamped_at: string | null;
    readonly sound: boolean;
  }[];
}
