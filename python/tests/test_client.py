from __future__ import annotations

import json
from collections.abc import Iterator

import pytest

from tano_sdk import (
    HttpRequest,
    HttpResponse,
    Tano,
    TanoApiError,
    TanoConnectionError,
    TanoError,
)
from tano_sdk.signature import request_signature

KEY = "tano_sandbox_abcd1234_k3y5ecr3tk3y5ecr3tk3y5ecr3tk3y5e"
SECRET = "k3y5ecr3tk3y5ecr3tk3y5ecr3tk3y5e"


class Fake:
    def __init__(self, *responses: HttpResponse | Exception) -> None:
        self.responses = list(responses)
        self.calls: list[HttpRequest] = []

    def __call__(self, request: HttpRequest) -> HttpResponse:
        self.calls.append(request)
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


def reply(status: int, body: object, **headers: str) -> HttpResponse:
    return HttpResponse(status, headers, json.dumps(body).encode())


@pytest.fixture(autouse=True)
def sans_attente(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setattr("tano_sdk.client.time.sleep", lambda _s: None)
    yield


def test_la_signature_est_celle_de_l_api() -> None:
    """Vecteur calculé par tano-core (`expected_signature_v2`)."""
    assert (
        request_signature(
            SECRET, "1790000000", "POST", "/v1/cases", b'{"flow_name":"kyc","country":"CI"}'
        )
        == "v2=aae924dc182b1d1265b37ad8dfd1aef6cf9de0bb49039638ee824e389a9863af"
    )


def test_une_cle_mal_formee_est_refusee() -> None:
    with pytest.raises(TanoError):
        Tano("sk_test_123")
    assert Tano(KEY).environment == "sandbox"


def test_une_creation_est_signee_sur_les_octets_envoyes() -> None:
    fake = Fake(reply(201, {"id": "case_1"}))
    tano = Tano(KEY, transport=fake, base_url="https://api.exemple/")
    assert tano.cases.create(flow_name="kyc", country="CI", external_ref="client-42")["id"] == (
        "case_1"
    )
    call = fake.calls[0]
    assert call.url == "https://api.exemple/v1/cases"
    assert json.loads(call.body or b"") == {
        "flow_name": "kyc",
        "country": "CI",
        "external_ref": "client-42",
    }
    assert call.headers["X-Tano-Signature"] == request_signature(
        SECRET, call.headers["X-Tano-Timestamp"], "POST", "/v1/cases", call.body or b""
    )
    assert len(call.headers["Idempotency-Key"]) == 36


def test_une_lecture_n_est_pas_signee_et_porte_ses_filtres() -> None:
    fake = Fake(reply(200, {"data": [], "has_more": False, "next_cursor": None}))
    Tano(KEY, transport=fake).cases.list(status=["review", "decided"], country="CI", limit=5)
    assert fake.calls[0].url == (
        "https://api.tano.africa/v1/cases?status=review&status=decided&country=CI&limit=5"
    )
    assert "X-Tano-Signature" not in fake.calls[0].headers
    assert fake.calls[0].body is None


def test_un_503_est_reessaye_avec_la_meme_cle_d_idempotence() -> None:
    fake = Fake(reply(503, {}), reply(201, {"id": "sess_1", "url": "https://parcours/#t"}))
    session = Tano(KEY, transport=fake).sessions.create(
        case_id="case_1", return_url="https://client.example/retour"
    )
    assert session["id"] == "sess_1"
    premier, second = fake.calls
    assert premier.headers["Idempotency-Key"] == second.headers["Idempotency-Key"]
    assert json.loads(second.body or b"")["return_url"] == "https://client.example/retour"


def test_une_erreur_de_l_api_garde_son_code() -> None:
    fake = Fake(
        reply(
            400,
            {
                "error": {
                    "type": "validation_error",
                    "code": "invalid_return_url",
                    "field": "return_url",
                }
            },
            **{"X-Request-Id": "req_9"},
        )
    )
    with pytest.raises(TanoApiError) as caught:
        Tano(KEY, transport=fake).sessions.create(case_id="c", return_url="http://x")
    assert (caught.value.status, caught.value.code, caught.value.field) == (
        400,
        "invalid_return_url",
        "return_url",
    )
    assert caught.value.request_id == "req_9"
    assert len(fake.calls) == 1


def test_sans_reponse_apres_les_reessais() -> None:
    fake = Fake(OSError("coupé"), OSError("coupé"))
    with pytest.raises(TanoConnectionError):
        Tano(KEY, transport=fake, max_retries=1).cases.retrieve("case_1")


def test_toutes_les_pages() -> None:
    fake = Fake(
        reply(200, {"data": [{"id": "a"}], "has_more": True, "next_cursor": "a"}),
        reply(200, {"data": [{"id": "b"}], "has_more": False, "next_cursor": None}),
    )
    ids = [c["id"] for c in Tano(KEY, transport=fake).cases.list_all(limit=1)]
    assert ids == ["a", "b"]
    assert "cursor=a" in fake.calls[1].url


def test_la_meme_requete_n_est_jamais_signee_deux_fois_pareil() -> None:
    fake = Fake(*(reply(201, {"id": f"s{i}"}) for i in range(3)))
    tano = Tano(KEY, transport=fake)
    for _ in range(3):
        tano.sessions.create(case_id="case_1")
    assert len({c.headers["X-Tano-Timestamp"] for c in fake.calls}) == 3
    assert len({c.headers["X-Tano-Signature"] for c in fake.calls}) == 3


def test_les_resultats_les_donnees_et_une_image() -> None:
    fake = Fake(
        reply(200, {"state": "approved"}),
        reply(200, {"declared": {"surname": "KOUASSI"}}),
        HttpResponse(200, {"Content-Type": "image/png"}, b"\x89PNG"),
        reply(200, {"data": [], "has_more": False, "next_cursor": None}),
    )
    tano = Tano(KEY, transport=fake)
    assert tano.cases.results("case_1")["state"] == "approved"
    assert tano.cases.data("case_1")["declared"]["surname"] == "KOUASSI"
    assert tano.cases.image("case_1", "cap_9") == ("image/png", b"\x89PNG")
    tano.cases.list(external_ref="CLIENT-42")
    assert [c.url for c in fake.calls] == [
        "https://api.tano.africa/v1/cases/case_1/results",
        "https://api.tano.africa/v1/cases/case_1/data",
        "https://api.tano.africa/v1/cases/case_1/images/cap_9",
        "https://api.tano.africa/v1/cases?external_ref=CLIENT-42",
    ]


def test_la_permission_manquante_se_dit() -> None:
    fake = Fake(reply(403, {"error": {"code": "key_permission_missing"}}))
    with pytest.raises(TanoApiError) as caught:
        Tano(KEY, transport=fake).cases.data("case_1")
    assert (caught.value.status, caught.value.code) == (403, "key_permission_missing")


def test_decider_et_effacer() -> None:
    fake = Fake(
        reply(201, {"id": "rdc_1", "outcome": "approve"}),
        reply(200, {"case_id": "case_1", "erased": {"images": 1}}),
    )
    tano = Tano(KEY, transport=fake)
    tano.cases.decide("case_1", outcome="approve", reason_code="identity_confirmed")
    assert tano.cases.erase("case_1")["erased"]["images"] == 1
    assert [c.url for c in fake.calls] == [
        "https://api.tano.africa/v1/cases/case_1/decision",
        "https://api.tano.africa/v1/cases/case_1/erasure",
    ]
    assert json.loads(fake.calls[0].body or b"") == {
        "outcome": "approve",
        "reason_code": "identity_confirmed",
    }
    assert all(c.headers["X-Tano-Signature"].startswith("v2=") for c in fake.calls)
