from __future__ import annotations

import base64
import json

from tano_sdk import HttpRequest, HttpResponse, PdfFile, Tano
from tano_sdk.signature import request_signature

KEY = "tano_sandbox_abcd1234_k3y5ecr3tk3y5ecr3tk3y5ecr3tk3y5e"
SECRET = "k3y5ecr3tk3y5ecr3tk3y5ecr3tk3y5e"


class Fake:
    def __init__(self, *responses: HttpResponse) -> None:
        self.responses = list(responses)
        self.calls: list[HttpRequest] = []

    def __call__(self, request: HttpRequest) -> HttpResponse:
        self.calls.append(request)
        return self.responses.pop(0)


def reply(status: int, body: object) -> HttpResponse:
    return HttpResponse(status, {"Content-Type": "application/json"}, json.dumps(body).encode())


def sent(request: HttpRequest) -> dict[str, object]:
    assert request.body is not None
    return json.loads(request.body)  # type: ignore[no-any-return]


def test_creation_encodes_pdf_and_is_signed() -> None:
    fake = Fake(reply(201, {"id": "sr_1", "status": "ongoing"}))
    tano = Tano(KEY, transport=fake)
    pdf = b"%PDF-1.7 bail"
    demande = tano.signature_requests.create(
        name="Bail",
        documents=[{"filename": "bail.pdf", "content": pdf}],
        signers=[
            {
                "given_name": "Aya",
                "family_name": "Koné",
                "email": "aya@exemple.ci",
                "auth_method": "otp_email",
                "fields": [
                    {
                        "document": 0,
                        "kind": "signature",
                        "page": 1,
                        "x": 60,
                        "y": 80,
                        "width": 170,
                        "height": 50,
                    }
                ],
            }
        ],
        reminder_days=[3],
        activate=True,
    )
    assert demande["id"] == "sr_1"
    call = fake.calls[0]
    assert call.url == "https://api.tano.africa/v1/signature-requests"
    body = sent(call)
    assert body["documents"] == [
        {"filename": "bail.pdf", "content": base64.b64encode(pdf).decode()}
    ]
    assert body["reminder_days"] == [3]
    assert body["activate"] is True
    assert call.body is not None
    assert call.headers["X-Tano-Signature"] == request_signature(
        SECRET, call.headers["X-Tano-Timestamp"], "POST", "/v1/signature-requests", call.body
    )


def test_list_filters_and_reads_unsigned() -> None:
    fake = Fake(reply(200, {"data": []}))
    Tano(KEY, transport=fake).signature_requests.list(status="completed", reference="BAIL-1")
    assert fake.calls[0].url == (
        "https://api.tano.africa/v1/signature-requests?status=completed&reference=BAIL-1"
    )
    assert "X-Tano-Signature" not in fake.calls[0].headers


def test_cancel_delete_and_link() -> None:
    fake = Fake(
        reply(200, {"id": "sr_1", "status": "cancelled"}),
        HttpResponse(204, {}, b""),
        reply(200, {"url": "https://verify.tano.africa/signer#tsig_x"}),
    )
    tano = Tano(KEY, transport=fake)
    tano.signature_requests.cancel("sr_1", reason="Clause à corriger")
    assert sent(fake.calls[0]) == {"reason": "Clause à corriger"}
    tano.signature_requests.delete("sr_1")
    assert fake.calls[1].method == "DELETE"
    assert fake.calls[1].headers["X-Tano-Signature"].startswith("v2=")
    assert tano.signature_requests.link("sr_1", "ss_1").endswith("#tsig_x")


def test_download_reads_headers() -> None:
    fake = Fake(
        HttpResponse(
            200,
            {
                "content-type": "application/pdf",
                "x-tano-document-sha256": "ab12",
                "x-tano-document-signed": "true",
                "x-tano-sandbox": "true",
            },
            b"%PDF signe",
        )
    )
    fichier = Tano(KEY, transport=fake).signature_requests.download("sr_1", "sd_1")
    assert fichier == PdfFile(data=b"%PDF signe", sha256="ab12", signed=True, sandbox=True)


def test_sandbox_answers() -> None:
    fake = Fake(reply(200, {"id": "sr_1", "status": "completed"}))
    assert Tano(KEY, transport=fake).sandbox.sign("sr_1", "ss_1")["status"] == "completed"
    assert fake.calls[0].url.endswith("/v1/sandbox/signature-requests/sr_1/signers/ss_1/sign")


def test_seal_and_verify() -> None:
    fake = Fake(
        reply(200, {"data": [{"id": "seal_1", "owner": "tano"}]}),
        reply(201, {"id": "sl_1", "status": "sealed"}),
        reply(200, {"signed": True, "sound": True, "signatures": []}),
    )
    tano = Tano(KEY, transport=fake)
    assert tano.seals.profiles()[0]["owner"] == "tano"
    assert tano.seals.create(profile_id="seal_1", document=b"%PDF")["status"] == "sealed"
    assert sent(fake.calls[1]) == {
        "profile_id": "seal_1",
        "document": base64.b64encode(b"%PDF").decode(),
    }
    assert tano.documents.verify(b"%PDF")["sound"] is True


def test_remind_and_journey_settings() -> None:
    fake = Fake(reply(200, {"id": "sr_1"}), reply(201, {"id": "sr_2"}))
    tano = Tano(KEY, transport=fake)
    tano.signature_requests.remind("sr_1", "ss_1")
    assert fake.calls[0].url.endswith("/v1/signature-requests/sr_1/signers/ss_1/remind")
    tano.signature_requests.create(
        name="Bail",
        documents=[{"filename": "b.pdf", "content": "JVBERi0="}],
        signers=[],
        delivery="none",
        custom_text={"invitation_subject": "Votre bail"},
        redirect_urls={"success": "https://agence.example/merci"},
    )
    body = sent(fake.calls[1])
    assert body["delivery"] == "none"
    assert body["custom_text"] == {"invitation_subject": "Votre bail"}
    assert body["redirect_urls"] == {"success": "https://agence.example/merci"}
