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

  it("se modifient, se réactivent, et corrigent un signataire", async () => {
    const { tano, calls } = client(
      json(200, { id: "sr_1" }),
      json(200, { id: "sr_1" }),
      json(200, { id: "sr_1" }),
    );
    await tano.signatureRequests.update("sr_1", {
      metadata: { dossier: "D-42", ancien: null },
      expires_at: new Date("2027-01-10T00:00:00Z"),
    });
    expect(calls[0]?.init.method).toBe("PATCH");
    expect(bodyOf(calls[0])).toEqual({
      metadata: { dossier: "D-42", ancien: null },
      expires_at: "2027-01-10T00:00:00.000Z",
    });
    await tano.signatureRequests.reactivate("sr_1", 14);
    expect(bodyOf(calls[1])).toEqual({ expires_in_days: 14 });
    await tano.signatureRequests.updateSigner("sr_1", "ss_1", { email: "aya@nouvelle.example" });
    expect(calls[2]?.url).toBe("https://api.tano.africa/v1/signature-requests/sr_1/signers/ss_1");
    expect(headersOf(calls[2])["X-Tano-Signature"]).toMatch(/^v2=/);
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

describe("les modèles de signature", () => {
  it("cachent des documents à un signataire", async () => {
    const { tano, calls } = client(
      json(201, {
        id: "sr_1",
        signers: [{ id: "ss_1", hidden_documents: ["sd_2"] }],
      }),
    );
    const demande = await tano.signatureRequests.create({
      name: "Bail",
      documents: [
        { filename: "bail.pdf", content: "JVBERi0=" },
        { filename: "annexe.pdf", content: "JVBERi0=" },
      ],
      signers: [
        {
          given_name: "Aya",
          family_name: "Koné",
          email: "aya@exemple.ci",
          auth_method: "otp_email",
          hidden_documents: [1],
        },
      ],
    });
    expect(bodyOf(calls[0]).signers[0].hidden_documents).toEqual([1]);
    expect(demande.signers[0]?.hidden_documents).toEqual(["sd_2"]);
  });

  it("s'enregistrent en POST signé, PDF en base 64, avec une clé d'idempotence", async () => {
    const { tano, calls } = client(json(201, { id: "stpl_1", roles: [] }));
    const pdf = Buffer.from("%PDF-1.7 bail");
    const modele = await tano.signatureTemplates.create(
      {
        name: "Bail type",
        documents: [{ filename: "bail.pdf", content: pdf }],
        roles: [
          {
            label: "Locataire",
            role: "signer",
            fields: [
              { document: 0, kind: "signature", page: 1, x: 60, y: 80, width: 170, height: 50 },
            ],
            hidden_documents: [],
          },
        ],
        reminder_days: [3],
      },
      { idempotencyKey: "modele-bail-1" },
    );

    expect(modele.id).toBe("stpl_1");
    const call = calls[0];
    expect(call?.url).toBe("https://api.tano.africa/v1/signature-templates");
    expect(call?.init.method).toBe("POST");
    const body = bodyOf(call);
    expect(body.documents).toEqual([{ filename: "bail.pdf", content: pdf.toString("base64") }]);
    expect(body.roles[0].label).toBe("Locataire");
    const h = headersOf(call);
    expect(h["Idempotency-Key"]).toBe("modele-bail-1");
    expect(h["X-Tano-Signature"]).toBe(
      requestSignature(
        SECRET,
        h["X-Tano-Timestamp"] as string,
        "POST",
        "/v1/signature-templates",
        call?.init.body as string,
      ),
    );
  });

  it("se listent, se lisent et se suppriment", async () => {
    const { tano, calls } = client(
      json(200, { data: [{ id: "stpl_1", name: "Bail type", documents: 2, roles: 1 }] }),
      json(200, { id: "stpl_1", name: "Bail type" }),
      new Response(null, { status: 204 }),
    );
    const { data } = await tano.signatureTemplates.list();
    expect(data[0]?.documents).toBe(2);
    expect(calls[0]?.url).toBe("https://api.tano.africa/v1/signature-templates");
    expect(headersOf(calls[0])["X-Tano-Signature"]).toBeUndefined();
    const modele = await tano.signatureTemplates.retrieve("stpl_1");
    expect(modele.name).toBe("Bail type");
    expect(calls[1]?.url).toBe("https://api.tano.africa/v1/signature-templates/stpl_1");
    await tano.signatureTemplates.delete("stpl_1");
    expect(calls[2]?.init.method).toBe("DELETE");
    expect(calls[2]?.url).toBe("https://api.tano.africa/v1/signature-templates/stpl_1");
    expect(headersOf(calls[2])["X-Tano-Signature"]).toMatch(/^v2=/);
  });

  it("donnent un de leurs PDF", async () => {
    const { tano, calls } = client(
      new Response(Buffer.from("%PDF modèle"), {
        status: 200,
        headers: { "content-type": "application/pdf", "x-tano-document-sha256": "cd34" },
      }),
    );
    const fichier = await tano.signatureTemplates.download("stpl_1", "stdoc_1");
    expect(calls[0]?.url).toBe(
      "https://api.tano.africa/v1/signature-templates/stpl_1/documents/stdoc_1",
    );
    expect(fichier.data.toString()).toBe("%PDF modèle");
    expect(fichier).toMatchObject({ sha256: "cd34", signed: null, sandbox: false });
  });

  it("donnent une demande, sans documents ni nom", async () => {
    const { tano, calls } = client(
      json(201, { id: "sr_1", template_id: "stpl_1" }),
      json(201, { id: "sr_2", template_id: "stpl_1" }),
    );
    const personne = {
      given_name: "Aya",
      family_name: "Koné",
      email: "aya@exemple.ci",
      auth_method: "otp_email",
    } as const;
    const demande = await tano.signatureRequests.create({
      template_id: "stpl_1",
      signers: [personne],
      reference: "BAIL-1",
      activate: true,
    });
    expect(demande.template_id).toBe("stpl_1");
    expect(calls[0]?.url).toBe("https://api.tano.africa/v1/signature-requests");
    expect(bodyOf(calls[0])).toEqual({
      template_id: "stpl_1",
      signers: [personne],
      reference: "BAIL-1",
      activate: true,
    });
    await tano.signatureTemplates.createRequest("stpl_1", { signers: [personne] });
    expect(calls[1]?.url).toBe("https://api.tano.africa/v1/signature-requests");
    expect(bodyOf(calls[1])).toEqual({ signers: [personne], template_id: "stpl_1" });
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
