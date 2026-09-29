import { describe, expect, it, vi } from "vitest";

import { Tano, TanoApiError, TanoConnectionError, TanoError } from "../src/index.js";
import { requestSignature } from "../src/signature.js";

const KEY = "tano_sandbox_abcd1234_k3y5ecr3tk3y5ecr3tk3y5ecr3tk3y5e";

interface Call {
  url: string;
  init: RequestInit;
}

function fakeFetch(...responses: (Response | Error)[]) {
  const calls: Call[] = [];
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = responses.shift();
    if (next === undefined) throw new Error("aucune réponse prévue");
    if (next instanceof Error) throw next;
    return next;
  });
  return { fetch: fn as unknown as typeof fetch, calls };
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

const headersOf = (call: Call | undefined) => (call?.init.headers ?? {}) as Record<string, string>;

describe("la signature", () => {
  it("est celle que calcule l'API (vecteur de tano-core)", () => {
    expect(
      requestSignature(
        "k3y5ecr3tk3y5ecr3tk3y5ecr3tk3y5e",
        "1790000000",
        "POST",
        "/v1/cases",
        '{"flow_name":"kyc","country":"CI"}',
      ),
    ).toBe("v2=aae924dc182b1d1265b37ad8dfd1aef6cf9de0bb49039638ee824e389a9863af");
  });
});

describe("le client", () => {
  it("refuse une clé mal formée et lit l'environnement", () => {
    expect(() => new Tano({ apiKey: "sk_test_123" })).toThrow(TanoError);
    expect(new Tano({ apiKey: KEY }).environment).toBe("sandbox");
  });

  it("signe une création sur les octets envoyés, avec clé d'idempotence", async () => {
    const { fetch, calls } = fakeFetch(json(201, { id: "case_1", status: "created" }));
    const tano = new Tano({ apiKey: KEY, fetch, baseUrl: "https://api.exemple/" });
    const created = await tano.cases.create({ flow_name: "kyc", country: "CI" });

    expect(created.id).toBe("case_1");
    const call = calls[0];
    expect(call?.url).toBe("https://api.exemple/v1/cases");
    const h = headersOf(call);
    expect(h.Authorization).toBe(`Bearer ${KEY}`);
    expect(h["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(h["X-Tano-Signature"]).toBe(
      requestSignature(
        "k3y5ecr3tk3y5ecr3tk3y5ecr3tk3y5e",
        h["X-Tano-Timestamp"] as string,
        "POST",
        "/v1/cases",
        call?.init.body as string,
      ),
    );
  });

  it("ne signe pas une lecture, et met les filtres dans la cible", async () => {
    const { fetch, calls } = fakeFetch(json(200, { data: [], has_more: false, next_cursor: null }));
    const tano = new Tano({ apiKey: KEY, fetch });
    await tano.cases.list({ status: ["review", "decided"], country: "CI", limit: 10 });
    expect(calls[0]?.url).toBe(
      "https://api.tano.africa/v1/cases?status=review&status=decided&country=CI&limit=10",
    );
    expect(headersOf(calls[0])["X-Tano-Signature"]).toBeUndefined();
  });

  it("réessaie un 503 avec la même clé d'idempotence et une signature neuve", async () => {
    const { fetch, calls } = fakeFetch(
      json(503, { error: { code: "unavailable" } }, { "retry-after": "0.01" }),
      json(201, { id: "sess_1", url: "https://parcours/#t" }),
    );
    const tano = new Tano({ apiKey: KEY, fetch });
    const session = await tano.sessions.create({
      case_id: "case_1",
      return_url: "https://x.example/retour",
    });
    expect(session.id).toBe("sess_1");
    expect(calls).toHaveLength(2);
    expect(headersOf(calls[0])["Idempotency-Key"]).toBe(headersOf(calls[1])["Idempotency-Key"]);
    expect(JSON.parse(calls[1]?.init.body as string)).toEqual({
      case_id: "case_1",
      return_url: "https://x.example/retour",
    });
  });

  it("rend l'erreur de l'API avec son code, sans réessayer un 400", async () => {
    const { fetch, calls } = fakeFetch(
      json(400, {
        error: {
          type: "validation_error",
          code: "invalid_return_url",
          message: "Non HTTPS.",
          field: "return_url",
          request_id: "req_1",
        },
      }),
    );
    const tano = new Tano({ apiKey: KEY, fetch });
    const error = await tano.sessions
      .create({ case_id: "c", return_url: "http://x" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TanoApiError);
    expect(error).toMatchObject({
      status: 400,
      code: "invalid_return_url",
      field: "return_url",
      requestId: "req_1",
    });
    expect(calls).toHaveLength(1);
  });

  it("dit qu'il n'a pas eu de réponse après ses réessais", async () => {
    const { fetch } = fakeFetch(new TypeError("fetch failed"), new TypeError("fetch failed"));
    const tano = new Tano({ apiKey: KEY, fetch, maxRetries: 1 });
    await expect(tano.cases.retrieve("case_1")).rejects.toBeInstanceOf(TanoConnectionError);
  });

  it("parcourt toutes les pages", async () => {
    const { fetch, calls } = fakeFetch(
      json(200, { data: [{ id: "a" }, { id: "b" }], has_more: true, next_cursor: "b" }),
      json(200, { data: [{ id: "c" }], has_more: false, next_cursor: null }),
    );
    const tano = new Tano({ apiKey: KEY, fetch });
    const ids: string[] = [];
    for await (const c of tano.cases.listAll({ limit: 2 })) ids.push(c.id);
    expect(ids).toEqual(["a", "b", "c"]);
    expect(calls[1]?.url).toContain("cursor=b");
  });
});

describe("l'anti-rejeu", () => {
  it("ne signe jamais deux fois la même requête avec le même horodatage", async () => {
    const { fetch, calls } = fakeFetch(
      json(201, { id: "s1" }),
      json(201, { id: "s2" }),
      json(201, { id: "s3" }),
    );
    const tano = new Tano({ apiKey: KEY, fetch });
    for (let i = 0; i < 3; i += 1) await tano.sessions.create({ case_id: "case_1" });
    const stamps = calls.map((c) => headersOf(c)["X-Tano-Timestamp"]);
    expect(new Set(stamps).size).toBe(3);
    expect(new Set(calls.map((c) => headersOf(c)["X-Tano-Signature"])).size).toBe(3);
  });
});

describe("les résultats d'un dossier", () => {
  it("lit les résultats, les données et cherche par référence exacte", async () => {
    const { fetch, calls } = fakeFetch(
      json(200, { state: "resubmission_requested", resubmission: { steps: ["face"] } }),
      json(200, { declared: { surname: "KOUASSI" } }),
      json(200, { data: [], has_more: false, next_cursor: null }),
    );
    const tano = new Tano({ apiKey: KEY, fetch });
    expect((await tano.cases.results("case_1")).state).toBe("resubmission_requested");
    expect((await tano.cases.data("case_1")).declared.surname).toBe("KOUASSI");
    await tano.cases.list({ external_ref: "CLIENT-42" });
    expect(calls.map((c) => c.url)).toEqual([
      "https://api.tano.africa/v1/cases/case_1/results",
      "https://api.tano.africa/v1/cases/case_1/data",
      "https://api.tano.africa/v1/cases?external_ref=CLIENT-42",
    ]);
  });

  it("rend une image en octets, avec son type", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const { fetch, calls } = fakeFetch(
      new Response(png, { status: 200, headers: { "content-type": "image/png" } }),
    );
    const image = await new Tano({ apiKey: KEY, fetch }).cases.image("case_1", "cap_9");
    expect(image.contentType).toBe("image/png");
    expect([...image.data]).toEqual([...png]);
    expect(calls[0]?.url).toBe("https://api.tano.africa/v1/cases/case_1/images/cap_9");
  });

  it("dit clairement qu'il manque la permission", async () => {
    const { fetch } = fakeFetch(
      json(403, { error: { type: "permission_denied", code: "key_permission_missing" } }),
    );
    await expect(new Tano({ apiKey: KEY, fetch }).cases.data("case_1")).rejects.toMatchObject({
      status: 403,
      code: "key_permission_missing",
    });
  });
});

describe("agir sur un dossier", () => {
  it("décide et efface, signés, sur les bonnes routes", async () => {
    const { fetch, calls } = fakeFetch(
      json(201, {
        id: "rdc_1",
        case_id: "case_1",
        outcome: "resubmit",
        case_outcome_notified: "resubmit",
      }),
      json(200, {
        case_id: "case_1",
        erased: { images: 2, declared: 1, identity: 1, documents: 1, review: 0 },
      }),
    );
    const tano = new Tano({ apiKey: KEY, fetch });
    await tano.cases.decide("case_1", {
      outcome: "resubmit",
      reason_code: "selfie_unusable",
      steps: ["face"],
    });
    expect((await tano.cases.erase("case_1")).erased.images).toBe(2);
    expect(calls.map((c) => c.url)).toEqual([
      "https://api.tano.africa/v1/cases/case_1/decision",
      "https://api.tano.africa/v1/cases/case_1/erasure",
    ]);
    expect(JSON.parse(calls[0]?.init.body as string)).toEqual({
      outcome: "resubmit",
      reason_code: "selfie_unusable",
      steps: ["face"],
    });
    for (const call of calls) expect(headersOf(call)["X-Tano-Signature"]).toMatch(/^v2=/);
  });
});
