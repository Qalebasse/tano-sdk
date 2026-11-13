import { describe, expect, it, vi } from "vitest";

import { Tano } from "../src/index.js";
import { requestSignature } from "../src/signature.js";

const KEY = "tano_sandbox_abcd1234_k3y5ecr3tk3y5ecr3tk3y5ecr3tk3y5e";
const SECRET = "k3y5ecr3tk3y5ecr3tk3y5ecr3tk3y5e";

interface Call {
  url: string;
  init: RequestInit;
}

function client(...responses: Response[]) {
  const calls: Call[] = [];
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = responses.shift();
    if (next === undefined) throw new Error("aucune réponse prévue");
    return next;
  });
  return {
    tano: new Tano({ apiKey: KEY, fetch: fetch as unknown as typeof globalThis.fetch }),
    calls,
  };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const headersOf = (call: Call | undefined) => (call?.init.headers ?? {}) as Record<string, string>;
const bodyOf = (call: Call | undefined) => JSON.parse(call?.init.body as string);

describe("les demandes de signature", () => {
  it("encodent les PDF en base 64 et signent la création", async () => {
    const { tano, calls } = client(json(201, { id: "sr_1", status: "ongoing" }));
    const pdf = Buffer.from("%PDF-1.7 bail");
    const demande = await tano.signatureRequests.create({
      name: "Bail",
      documents: [{ filename: "bail.pdf", content: pdf }],
      signers: [
        {
          given_name: "Aya",
          family_name: "Koné",
          email: "aya@exemple.ci",
          auth_method: "otp_email",
          fields: [
            { document: 0, kind: "signature", page: 1, x: 60, y: 80, width: 170, height: 50 },
          ],
        },
      ],
      activate: true,
    });

    expect(demande.id).toBe("sr_1");
    const call = calls[0];
    expect(call?.url).toBe("https://api.tano.africa/v1/signature-requests");
    expect(bodyOf(call).documents[0].content).toBe(pdf.toString("base64"));
    const h = headersOf(call);
    expect(h["X-Tano-Signature"]).toBe(
      requestSignature(
        SECRET,
        h["X-Tano-Timestamp"] as string,
        "POST",
        "/v1/signature-requests",
        call?.init.body as string,
      ),
    );
  });

  it("gardent une chaîne pour du base 64 déjà prêt", async () => {
    const { tano, calls } = client(json(201, { id: "sr_1" }));
    await tano.signatureRequests.create({
      name: "Bail",
      documents: [{ filename: "b.pdf", content: "JVBERi0=" }],
      signers: [],
    });
    expect(bodyOf(calls[0]).documents[0].content).toBe("JVBERi0=");
  });

  it("se listent avec leurs filtres", async () => {
    const { tano, calls } = client(json(200, { data: [] }));
    await tano.signatureRequests.list({ status: "completed", reference: "BAIL-1", limit: 10 });
    expect(calls[0]?.url).toBe(
      "https://api.tano.africa/v1/signature-requests?status=completed&reference=BAIL-1&limit=10",
    );
    expect(headersOf(calls[0])["X-Tano-Signature"]).toBeUndefined();
  });

  it("s'annulent avec un motif, et un brouillon se supprime en DELETE signé", async () => {
    const { tano, calls } = client(
      json(200, { id: "sr_1", status: "cancelled" }),
      new Response(null, { status: 204 }),
    );
    await tano.signatureRequests.cancel("sr_1", "Clause à corriger");
    expect(bodyOf(calls[0])).toEqual({ reason: "Clause à corriger" });
    await tano.signatureRequests.delete("sr_1");
    expect(calls[1]?.init.method).toBe("DELETE");
    expect(headersOf(calls[1])["X-Tano-Signature"]).toMatch(/^v2=/);
  });

  it("donnent le lien d'un signataire", async () => {
    const { tano, calls } = client(json(200, { url: "https://verify.tano.africa/signer#tsig_x" }));
    const { url } = await tano.signatureRequests.link("sr_1", "ss_1");
    expect(url).toContain("#tsig_");
    expect(calls[0]?.url).toBe(
      "https://api.tano.africa/v1/signature-requests/sr_1/signers/ss_1/link",
    );
  });

  it("téléchargent un PDF avec ce que disent ses en-têtes", async () => {
    const { tano } = client(
      new Response(Buffer.from("%PDF signé"), {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "x-tano-document-sha256": "ab12",
          "x-tano-document-signed": "true",
          "x-tano-sandbox": "true",
        },
      }),
    );
    const fichier = await tano.signatureRequests.download("sr_1", "sd_1");
    expect(fichier.data.toString()).toBe("%PDF signé");
    expect(fichier).toMatchObject({ sha256: "ab12", signed: true, sandbox: true });
  });

  it("relancent un signataire, et portent les réglages du parcours", async () => {
    const { tano, calls } = client(json(200, { id: "sr_1" }), json(201, { id: "sr_2" }));
    await tano.signatureRequests.remind("sr_1", "ss_1");
    expect(calls[0]?.url).toBe(
      "https://api.tano.africa/v1/signature-requests/sr_1/signers/ss_1/remind",
    );
    await tano.signatureRequests.create({
      name: "Bail",
      documents: [{ filename: "b.pdf", content: "JVBERi0=" }],
      signers: [],
      delivery: "none",
      redirect_urls: { success: "https://agence.example/merci" },
    });
    expect(bodyOf(calls[1])).toMatchObject({
      delivery: "none",
      redirect_urls: { success: "https://agence.example/merci" },
    });
  });

  it("se simulent en bac à sable", async () => {
    const { tano, calls } = client(json(200, { id: "sr_1", status: "completed" }));
    const reponse = await tano.sandbox.sign("sr_1", "ss_1");
    expect(reponse.status).toBe("completed");
    expect(calls[0]?.url).toBe(
      "https://api.tano.africa/v1/sandbox/signature-requests/sr_1/signers/ss_1/sign",
    );
  });
});

describe("le cachet", () => {
  it("liste les profils et scelle un PDF en base 64", async () => {
    const { tano, calls } = client(
      json(200, { data: [{ id: "seal_1", owner: "tano" }] }),
      json(201, { id: "sl_1", status: "sealed" }),
    );
    const [profil] = await tano.seals.profiles();
    expect(profil?.owner).toBe("tano");
    const cachet = await tano.seals.create({
      profile_id: "seal_1",
      document: Buffer.from("%PDF"),
      reference: "FAC-1",
    });
    expect(cachet.status).toBe("sealed");
    expect(bodyOf(calls[1])).toEqual({
      profile_id: "seal_1",
      document: Buffer.from("%PDF").toString("base64"),
      reference: "FAC-1",
    });
  });

  it("vérifie un document", async () => {
    const { tano, calls } = client(json(200, { signed: true, sound: true, signatures: [] }));
    const verification = await tano.documents.verify(Buffer.from("%PDF"));
    expect(verification.sound).toBe(true);
    expect(calls[0]?.url).toBe("https://api.tano.africa/v1/verify");
  });
});
