/**
 * La signature et le cachet électroniques : demandes de signature, cachets, vérification d'un PDF.
 *
 * Les PDF s'envoient en octets (`Buffer`, `Uint8Array`) : le SDK les encode en base 64. Une
 * chaîne est prise pour du base 64 déjà prêt.
 */

import type { Tano } from "./client.js";
import type {
  DocumentVerification,
  PdfContent,
  PdfFile,
  RequestOptions,
  SandboxAnswer,
  Seal,
  SealCreateParams,
  SealProfile,
  SignatureRequest,
  SignatureRequestCreateParams,
  SignatureRequestFromTemplateParams,
  SignatureRequestListParams,
  SignatureRequestSummary,
  SignatureRequestUpdateParams,
  SignatureTemplate,
  SignatureTemplateCreateParams,
  SignatureTemplateSummary,
  SignerUpdateParams,
  SigningLink,
} from "./types.js";

const id = encodeURIComponent;

export function toBase64(content: PdfContent): string {
  return typeof content === "string" ? content : Buffer.from(content).toString("base64");
}

export class SignatureRequests {
  constructor(private readonly client: Tano) {}

  /** Créer une demande, et l'envoyer d'un geste avec `activate: true`. Avec `template_id`, les
   * documents, les rôles et leurs champs viennent du modèle. */
  create(
    params: SignatureRequestCreateParams | SignatureRequestFromTemplateParams,
    options?: RequestOptions,
  ): Promise<SignatureRequest> {
    const body =
      params.documents === undefined
        ? params
        : {
            ...params,
            documents: params.documents.map((d) => ({
              filename: d.filename,
              content: toBase64(d.content),
            })),
          };
    return this.client.request("POST", "/v1/signature-requests", body, options);
  }

  retrieve(requestId: string, options?: RequestOptions): Promise<SignatureRequest> {
    return this.client.request(
      "GET",
      `/v1/signature-requests/${id(requestId)}`,
      undefined,
      options,
    );
  }

  /** Les demandes de l'environnement de la clé, de la plus récente à la plus ancienne. */
  list(
    params: SignatureRequestListParams = {},
    options?: RequestOptions,
  ): Promise<{ readonly data: readonly SignatureRequestSummary[] }> {
    return this.client.request("GET", "/v1/signature-requests", undefined, {
      ...options,
      query: { status: params.status, reference: params.reference, limit: params.limit },
    });
  }

  /** Changer les métadonnées, ou reporter l'échéance d'une demande en cours. */
  update(
    requestId: string,
    params: SignatureRequestUpdateParams,
    options?: RequestOptions,
  ): Promise<SignatureRequest> {
    const body = {
      ...(params.metadata === undefined ? {} : { metadata: params.metadata }),
      ...(params.expires_at === undefined
        ? {}
        : {
            expires_at:
              params.expires_at instanceof Date
                ? params.expires_at.toISOString()
                : params.expires_at,
          }),
    };
    return this.client.request("PATCH", `/v1/signature-requests/${id(requestId)}`, body, options);
  }

  /** Faire repartir une demande expirée, avec une nouvelle échéance (30 jours par défaut). */
  reactivate(
    requestId: string,
    expiresInDays = 30,
    options?: RequestOptions,
  ): Promise<SignatureRequest> {
    return this.client.request(
      "POST",
      `/v1/signature-requests/${id(requestId)}/reactivate`,
      { expires_in_days: expiresInDays },
      options,
    );
  }

  /** Corriger le nom ou les coordonnées d'un signataire qui n'a pas répondu. */
  updateSigner(
    requestId: string,
    signerId: string,
    params: SignerUpdateParams,
    options?: RequestOptions,
  ): Promise<SignatureRequest> {
    return this.client.request(
      "PATCH",
      `/v1/signature-requests/${id(requestId)}/signers/${id(signerId)}`,
      params,
      options,
    );
  }

  /** Envoyer un brouillon : documents figés, premiers signataires invités. */
  activate(requestId: string, options?: RequestOptions): Promise<SignatureRequest> {
    return this.client.request(
      "POST",
      `/v1/signature-requests/${id(requestId)}/activate`,
      {},
      options,
    );
  }

  /** Annuler une demande en cours. Les liens cessent de valoir ; `signature_request.cancelled`. */
  cancel(requestId: string, reason: string, options?: RequestOptions): Promise<SignatureRequest> {
    return this.client.request(
      "POST",
      `/v1/signature-requests/${id(requestId)}/cancel`,
      { reason },
      options,
    );
  }

  /** Supprimer un brouillon. Une demande envoyée s'annule, elle ne se supprime pas. */
  async delete(requestId: string, options?: RequestOptions): Promise<void> {
    await this.client.request(
      "DELETE",
      `/v1/signature-requests/${id(requestId)}`,
      undefined,
      options,
    );
  }

  /** Le lien de signature d'un signataire invité, pour l'ouvrir dans votre application. Il
   * remplace le précédent. */
  link(requestId: string, signerId: string, options?: RequestOptions): Promise<SigningLink> {
    return this.client.request(
      "POST",
      `/v1/signature-requests/${id(requestId)}/signers/${id(signerId)}/link`,
      {},
      options,
    );
  }

  /** Relancer un signataire invité qui n'a pas répondu : Tano lui renvoie l'invitation, avec un
   * nouveau lien. Une fois par heure au plus ; refusé pour `delivery: "none"`. */
  remind(requestId: string, signerId: string, options?: RequestOptions): Promise<SignatureRequest> {
    return this.client.request(
      "POST",
      `/v1/signature-requests/${id(requestId)}/signers/${id(signerId)}/remind`,
      {},
      options,
    );
  }

  /** Le document signé une fois la demande complétée, le document présenté avant. */
  download(requestId: string, documentId: string, options?: RequestOptions): Promise<PdfFile> {
    return this.client.requestPdf(
      `/v1/signature-requests/${id(requestId)}/documents/${id(documentId)}/download`,
      options,
    );
  }

  /** Le fichier de preuve, une fois la demande complétée. */
  auditTrail(requestId: string, options?: RequestOptions): Promise<PdfFile> {
    return this.client.requestPdf(`/v1/signature-requests/${id(requestId)}/audit-trail`, options);
  }
}

export class SignatureTemplates {
  constructor(private readonly client: Tano) {}

  /** Enregistrer un modèle : ses documents, et des rôles à la place des signataires. */
  create(
    params: SignatureTemplateCreateParams,
    options?: RequestOptions,
  ): Promise<SignatureTemplate> {
    const body = {
      ...params,
      documents: params.documents.map((d) => ({
        filename: d.filename,
        content: toBase64(d.content),
      })),
    };
    return this.client.request("POST", "/v1/signature-templates", body, options);
  }

  /** Les modèles de l'organisation, avec le nombre de leurs documents et de leurs rôles. */
  list(options?: RequestOptions): Promise<{ readonly data: readonly SignatureTemplateSummary[] }> {
    return this.client.request("GET", "/v1/signature-templates", undefined, options);
  }

  retrieve(templateId: string, options?: RequestOptions): Promise<SignatureTemplate> {
    return this.client.request(
      "GET",
      `/v1/signature-templates/${id(templateId)}`,
      undefined,
      options,
    );
  }

  /** Supprimer un modèle. Les demandes déjà tirées gardent leurs documents. */
  async delete(templateId: string, options?: RequestOptions): Promise<void> {
    await this.client.request(
      "DELETE",
      `/v1/signature-templates/${id(templateId)}`,
      undefined,
      options,
    );
  }

  /** Un PDF du modèle (`documents[].id`). */
  document(templateId: string, documentId: string, options?: RequestOptions): Promise<PdfFile> {
    return this.client.requestPdf(
      `/v1/signature-templates/${id(templateId)}/documents/${id(documentId)}`,
      options,
    );
  }

  /** Créer une demande depuis ce modèle : `signatureRequests.create` avec `template_id`. */
  createRequest(
    templateId: string,
    params: Omit<SignatureRequestFromTemplateParams, "template_id">,
    options?: RequestOptions,
  ): Promise<SignatureRequest> {
    return this.client.signatureRequests.create({ ...params, template_id: templateId }, options);
  }
}

export class Seals {
  constructor(private readonly client: Tano) {}

  /** Les profils utilisables : ceux de votre organisation, puis celui de Tano. */
  async profiles(options?: RequestOptions): Promise<readonly SealProfile[]> {
    const page = await this.client.request<{ data: SealProfile[] }>(
      "GET",
      "/v1/seal-profiles",
      undefined,
      options,
    );
    return page.data;
  }

  /** Sceller un PDF. Synchrone : la réponse dit si le document est scellé. */
  create(params: SealCreateParams, options?: RequestOptions): Promise<Seal> {
    return this.client.request(
      "POST",
      "/v1/seals",
      { ...params, document: toBase64(params.document) },
      options,
    );
  }

  retrieve(sealId: string, options?: RequestOptions): Promise<Seal> {
    return this.client.request("GET", `/v1/seals/${id(sealId)}`, undefined, options);
  }

  download(sealId: string, options?: RequestOptions): Promise<PdfFile> {
    return this.client.requestPdf(`/v1/seals/${id(sealId)}/download`, options);
  }
}

export class Documents {
  constructor(private readonly client: Tano) {}

  /** Les signatures et cachets d'un PDF, et leur intégrité. Toute clé ; rien n'est facturé ni
   * conservé. */
  verify(document: PdfContent, options?: RequestOptions): Promise<DocumentVerification> {
    return this.client.request("POST", "/v1/verify", { document: toBase64(document) }, options);
  }
}

export function simulateAnswer(
  client: Tano,
  requestId: string,
  signerId: string,
  answer: "sign" | "decline",
  options?: RequestOptions,
): Promise<SandboxAnswer> {
  return client.request(
    "POST",
    `/v1/sandbox/signature-requests/${id(requestId)}/signers/${id(signerId)}/${answer}`,
    {},
    options,
  );
}
