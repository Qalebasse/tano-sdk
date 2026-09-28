/**
 * Les erreurs du SDK. Une erreur de l'API garde tout ce que l'API en dit : son `code`, stable, est
 * ce qu'il faut tester ; le message peut changer.
 */

export interface ApiErrorBody {
  readonly type?: string;
  readonly code?: string;
  readonly message?: string;
  readonly doc_url?: string;
  readonly request_id?: string;
  readonly field?: string;
}

/** Tout ce que le SDK lève dérive de `TanoError`. */
export class TanoError extends Error {
  override readonly name: string = "TanoError";
}

/** Une réponse d'erreur de l'API : statut HTTP, type, code, et l'identifiant de la requête. */
export class TanoApiError extends TanoError {
  override readonly name = "TanoApiError";
  readonly status: number;
  readonly type: string;
  readonly code: string;
  readonly requestId: string | null;
  readonly field: string | null;
  readonly docUrl: string | null;

  constructor(status: number, body: ApiErrorBody, requestId: string | null) {
    super(body.message ?? `Erreur ${status} de l'API Tano.`);
    this.status = status;
    this.type = body.type ?? "api_error";
    this.code = body.code ?? "unknown";
    this.requestId = body.request_id ?? requestId;
    this.field = body.field ?? null;
    this.docUrl = body.doc_url ?? null;
  }
}

/** L'API n'a pas répondu : réseau coupé, délai dépassé. La requête a pu passer ou non. */
export class TanoConnectionError extends TanoError {
  override readonly name = "TanoConnectionError";
}

/** Une livraison de webhook dont la signature ne tient pas. Répondez 401 et ne la traitez pas. */
export class WebhookSignatureError extends TanoError {
  override readonly name = "WebhookSignatureError";
}
