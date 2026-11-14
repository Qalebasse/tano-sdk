"""La signature et le cachet électroniques : demandes de signature, cachets, vérification d'un PDF.

Les PDF s'envoient en octets : le SDK les encode en base 64. Une chaîne est prise pour du base 64
déjà prêt.
"""

from __future__ import annotations

import base64
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING, Any, TypedDict, Union
from urllib.parse import quote

if TYPE_CHECKING:
    from tano_sdk.client import HttpResponse, Tano

#: Un PDF : ses octets, ou déjà en base 64.
PdfContent = Union[bytes, bytearray, memoryview, str]


class _Identity(TypedDict):
    given_name: str
    family_name: str
    #: `otp_email` ou `otp_sms`.
    auth_method: str


class GroupMember(_Identity, total=False):
    """Un membre d'un groupe : invité avec son propre lien et son propre code."""

    #: Pour `otp_email`.
    email: str | None
    #: Pour `otp_sms`, au format international (`+2250701021234`).
    phone: str | None


class _Slot(TypedDict, total=False):
    """Ce qu'une place porte, qu'une personne ou un groupe la tienne."""

    role: str
    position: int
    locale: str
    time_zone: str
    fields: list[dict[str, Any]]
    hidden_documents: list[int]
    delivery: str
    custom_text: dict[str, str]
    redirect_urls: dict[str, str]


class PersonSigner(_Identity, _Slot, total=False):
    """Une place tenue par une personne."""

    email: str | None
    phone: str | None


class _Group(TypedDict):
    #: De 1 à 60 caractères.
    group_name: str
    #: De 2 à 10 membres.
    members: list[GroupMember]


class GroupSigner(_Group, _Slot, total=False):
    """Une place tenue par un groupe : ni nom, ni contact, ni moyen d'authentification sur la
    place, ils sont sur chaque membre. Le premier membre qui signe tient la place, les autres
    passent à `released` ; un membre qui refuse refuse la demande."""


def to_base64(content: PdfContent) -> str:
    if isinstance(content, str):
        return content
    return base64.b64encode(bytes(content)).decode()


def _id(value: str) -> str:
    return quote(value, safe="")


def _documents(documents: Iterable[Mapping[str, Any]]) -> list[dict[str, str]]:
    return [{"filename": d["filename"], "content": to_base64(d["content"])} for d in documents]


@dataclass(frozen=True)
class PdfFile:
    """Un PDF téléchargé : ses octets et ce que disent ses en-têtes."""

    data: bytes
    #: `X-Tano-Document-Sha256` : l'empreinte du fichier.
    sha256: str | None
    #: `X-Tano-Document-Signed` : la version signée ou non ; `None` hors document signé.
    signed: bool | None
    #: `X-Tano-Sandbox` : un spécimen de bac à sable, sans valeur.
    sandbox: bool

    @classmethod
    def from_response(cls, response: HttpResponse) -> PdfFile:
        def header(name: str) -> str | None:
            wanted = name.lower()
            return next((v for k, v in response.headers.items() if k.lower() == wanted), None)

        signed = header("X-Tano-Document-Signed")
        return cls(
            data=response.body,
            sha256=header("X-Tano-Document-Sha256"),
            signed=None if signed is None else signed == "true",
            sandbox=header("X-Tano-Sandbox") == "true",
        )


class SignatureRequests:
    def __init__(self, client: Tano) -> None:
        self._client = client

    def create(
        self,
        *,
        signers: Sequence[Mapping[str, Any]],
        name: str | None = None,
        documents: Iterable[Mapping[str, Any]] | None = None,
        template_id: str | None = None,
        reference: str | None = None,
        ordering: str | None = None,
        level: str | None = None,
        message: str | None = None,
        locale: str | None = None,
        expires_in_days: int | None = None,
        reminder_days: Iterable[int] | None = None,
        activate: bool = False,
        delivery: str | None = None,
        custom_text: Mapping[str, str] | None = None,
        redirect_urls: Mapping[str, str] | None = None,
        metadata: Mapping[str, str | int] | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        """Créer une demande, et l'envoyer d'un geste avec `activate=True`.

        `documents` : `{"filename": …, "content": <octets ou base 64>}`. `signers` : comme dans
        l'API, chacun avec ses `fields` en points PDF depuis le coin bas gauche de la page — ou
        des ancres `{{s1|signature}}` dans le PDF — et ses `hidden_documents`, les indices des
        documents qu'il ne voit pas.

        Une place peut être tenue par un groupe (`GroupSigner`) : `group_name` et `members` (de 2
        à 10, chacun avec `given_name`, `family_name`, `email` ou `phone`, et `auth_method`) à la
        place de la personne, le reste de la place inchangé. Le premier membre qui signe tient la
        place ; les autres passent à `released`. Un membre qui refuse refuse la demande.

        `template_id` : la demande est tirée d'un modèle, qui en donne les documents, les rôles et
        leurs champs. `name` devient facultatif (le nom du modèle) et `documents` ne s'envoie
        pas ; `signers` compte une personne ou un groupe par rôle, dans l'ordre des rôles, sans
        `fields` ni `hidden_documents`.

        `delivery` : `email` (Tano invite et relance) ou `none` (vous remettez le lien vous-même).
        `custom_text` : `invitation_subject`, `invitation_body`, `reminder_subject`,
        `reminder_body`. `redirect_urls` : `success`, `decline`, `error`, en HTTPS. Chaque
        signataire peut les préciser à son tour.
        """
        body: dict[str, Any] = {}
        if template_id is not None:
            body["template_id"] = template_id
        if name is not None:
            body["name"] = name
        if documents is not None:
            body["documents"] = _documents(documents)
        body["signers"] = [dict(s) for s in signers]
        body["activate"] = activate
        for key, value in (
            ("reference", reference),
            ("ordering", ordering),
            ("level", level),
            ("message", message),
            ("locale", locale),
            ("expires_in_days", expires_in_days),
        ):
            if value is not None:
                body[key] = value
        if reminder_days is not None:
            body["reminder_days"] = list(reminder_days)
        if delivery is not None:
            body["delivery"] = delivery
        if custom_text:
            body["custom_text"] = dict(custom_text)
        if redirect_urls:
            body["redirect_urls"] = dict(redirect_urls)
        if metadata:
            body["metadata"] = dict(metadata)
        return self._client.request(  # type: ignore[no-any-return]
            "POST", "/v1/signature-requests", body, idempotency_key=idempotency_key
        )

    def retrieve(self, request_id: str) -> dict[str, Any]:
        return self._client.request(  # type: ignore[no-any-return]
            "GET", f"/v1/signature-requests/{_id(request_id)}"
        )

    def list(
        self,
        *,
        status: str | None = None,
        reference: str | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        """Les demandes de l'environnement de la clé : `data`, de la plus récente à la plus
        ancienne."""
        return self._client.request(  # type: ignore[no-any-return]
            "GET",
            "/v1/signature-requests",
            query={"status": status, "reference": reference, "limit": limit},
        )

    def update(
        self,
        request_id: str,
        *,
        metadata: Mapping[str, str | int | None] | None = None,
        expires_at: str | datetime | None = None,
    ) -> dict[str, Any]:
        """Changer les métadonnées (fusionnées ; `None` retire une clé), ou reporter l'échéance
        d'une demande en cours."""
        body: dict[str, Any] = {}
        if metadata is not None:
            body["metadata"] = dict(metadata)
        if expires_at is not None:
            body["expires_at"] = (
                expires_at.isoformat() if isinstance(expires_at, datetime) else expires_at
            )
        return self._client.request(  # type: ignore[no-any-return]
            "PATCH", f"/v1/signature-requests/{_id(request_id)}", body
        )

    def reactivate(self, request_id: str, *, expires_in_days: int = 30) -> dict[str, Any]:
        """Faire repartir une demande expirée, avec une nouvelle échéance. Ce qui est signé le
        reste ; ceux qui attendaient reçoivent un lien neuf."""
        return self._client.request(  # type: ignore[no-any-return]
            "POST",
            f"/v1/signature-requests/{_id(request_id)}/reactivate",
            {"expires_in_days": expires_in_days},
        )

    def update_signer(
        self,
        request_id: str,
        signer_id: str,
        *,
        given_name: str | None = None,
        family_name: str | None = None,
        email: str | None = None,
        phone: str | None = None,
        auth_method: str | None = None,
    ) -> dict[str, Any]:
        """Corriger un signataire qui n'a pas répondu ; invité, il reçoit un nouveau lien à ses
        nouvelles coordonnées."""
        body = {
            k: v
            for k, v in (
                ("given_name", given_name),
                ("family_name", family_name),
                ("email", email),
                ("phone", phone),
                ("auth_method", auth_method),
            )
            if v is not None
        }
        return self._client.request(  # type: ignore[no-any-return]
            "PATCH",
            f"/v1/signature-requests/{_id(request_id)}/signers/{_id(signer_id)}",
            body,
        )

    def activate(self, request_id: str) -> dict[str, Any]:
        """Envoyer un brouillon : documents figés, premiers signataires invités."""
        return self._client.request(  # type: ignore[no-any-return]
            "POST", f"/v1/signature-requests/{_id(request_id)}/activate", {}
        )

    def cancel(self, request_id: str, *, reason: str) -> dict[str, Any]:
        """Annuler une demande en cours. Les liens cessent de valoir ;
        `signature_request.cancelled`."""
        return self._client.request(  # type: ignore[no-any-return]
            "POST", f"/v1/signature-requests/{_id(request_id)}/cancel", {"reason": reason}
        )

    def delete(self, request_id: str) -> None:
        """Supprimer un brouillon. Une demande envoyée s'annule, elle ne se supprime pas."""
        self._client.request("DELETE", f"/v1/signature-requests/{_id(request_id)}")

    def link(self, request_id: str, signer_id: str) -> str:
        """Le lien de signature d'un signataire invité, pour l'ouvrir dans votre application. Il
        remplace le précédent ; ne le stockez pas."""
        reply = self._client.request(
            "POST", f"/v1/signature-requests/{_id(request_id)}/signers/{_id(signer_id)}/link", {}
        )
        return str(reply["url"])

    def remind(self, request_id: str, signer_id: str) -> dict[str, Any]:
        """Relancer un signataire invité qui n'a pas répondu : Tano lui renvoie l'invitation, avec
        un nouveau lien. Une fois par heure au plus ; refusé pour `delivery: none`."""
        return self._client.request(  # type: ignore[no-any-return]
            "POST",
            f"/v1/signature-requests/{_id(request_id)}/signers/{_id(signer_id)}/remind",
            {},
        )

    def download(self, request_id: str, document_id: str) -> PdfFile:
        """Le document signé une fois la demande complétée, le document présenté avant."""
        return PdfFile.from_response(
            self._client.request_bytes(
                f"/v1/signature-requests/{_id(request_id)}/documents/{_id(document_id)}/download"
            )
        )

    def audit_trail(self, request_id: str) -> PdfFile:
        """Le fichier de preuve, une fois la demande complétée."""
        return PdfFile.from_response(
            self._client.request_bytes(f"/v1/signature-requests/{_id(request_id)}/audit-trail")
        )


class SignatureTemplates:
    def __init__(self, client: Tano) -> None:
        self._client = client

    def create(
        self,
        *,
        name: str,
        documents: Iterable[Mapping[str, Any]],
        roles: Sequence[Mapping[str, Any]],
        ordering: str | None = None,
        expires_in_days: int | None = None,
        message: str | None = None,
        reminder_days: Iterable[int] | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        """Enregistrer un modèle : ses documents, et des rôles à la place des signataires.

        `documents` : `{"filename": …, "content": <octets ou base 64>}`. `roles` : `label` (de 1
        à 60 caractères, unique sans tenir compte de la casse), `role` (`signer`, `approver` ou
        `viewer`), `position`, `fields` comme dans une demande, `hidden_documents`.
        """
        body: dict[str, Any] = {
            "name": name,
            "documents": _documents(documents),
            "roles": [dict(r) for r in roles],
        }
        for key, value in (
            ("ordering", ordering),
            ("expires_in_days", expires_in_days),
            ("message", message),
        ):
            if value is not None:
                body[key] = value
        if reminder_days is not None:
            body["reminder_days"] = list(reminder_days)
        return self._client.request(  # type: ignore[no-any-return]
            "POST", "/v1/signature-templates", body, idempotency_key=idempotency_key
        )

    def list(self) -> dict[str, Any]:
        """Les modèles de l'organisation : `data`, avec le nombre de leurs documents et de leurs
        rôles."""
        return self._client.request(  # type: ignore[no-any-return]
            "GET", "/v1/signature-templates"
        )

    def retrieve(self, template_id: str) -> dict[str, Any]:
        return self._client.request(  # type: ignore[no-any-return]
            "GET", f"/v1/signature-templates/{_id(template_id)}"
        )

    def delete(self, template_id: str) -> None:
        """Supprimer un modèle. Les demandes déjà tirées gardent leurs documents."""
        self._client.request("DELETE", f"/v1/signature-templates/{_id(template_id)}")

    def document(self, template_id: str, document_id: str) -> PdfFile:
        """Un PDF du modèle (`documents[].id`)."""
        return PdfFile.from_response(
            self._client.request_bytes(
                f"/v1/signature-templates/{_id(template_id)}/documents/{_id(document_id)}"
            )
        )

    def create_request(
        self, template_id: str, *, signers: Sequence[Mapping[str, Any]], **params: Any
    ) -> dict[str, Any]:
        """Créer une demande depuis ce modèle : `signature_requests.create` avec
        `template_id`."""
        return self._client.signature_requests.create(
            template_id=template_id, signers=signers, **params
        )


class Seals:
    def __init__(self, client: Tano) -> None:
        self._client = client

    def profiles(self) -> list[dict[str, Any]]:
        """Les profils utilisables : ceux de votre organisation, puis celui de Tano."""
        return list(self._client.request("GET", "/v1/seal-profiles")["data"])

    def create(
        self,
        *,
        profile_id: str,
        document: PdfContent,
        reference: str | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        """Sceller un PDF. Synchrone : la réponse dit si le document est scellé."""
        body: dict[str, Any] = {"profile_id": profile_id, "document": to_base64(document)}
        if reference is not None:
            body["reference"] = reference
        return self._client.request(  # type: ignore[no-any-return]
            "POST", "/v1/seals", body, idempotency_key=idempotency_key
        )

    def retrieve(self, seal_id: str) -> dict[str, Any]:
        return self._client.request(  # type: ignore[no-any-return]
            "GET", f"/v1/seals/{_id(seal_id)}"
        )

    def download(self, seal_id: str) -> PdfFile:
        return PdfFile.from_response(
            self._client.request_bytes(f"/v1/seals/{_id(seal_id)}/download")
        )


class Documents:
    def __init__(self, client: Tano) -> None:
        self._client = client

    def verify(self, document: PdfContent) -> dict[str, Any]:
        """Les signatures et cachets d'un PDF, et leur intégrité : `signed`, `sound`,
        `signatures`. Toute clé ; rien n'est facturé ni conservé."""
        return self._client.request(  # type: ignore[no-any-return]
            "POST", "/v1/verify", {"document": to_base64(document)}
        )


def simulate_answer(client: Tano, request_id: str, signer_id: str, answer: str) -> dict[str, Any]:
    return client.request(  # type: ignore[no-any-return]
        "POST",
        f"/v1/sandbox/signature-requests/{_id(request_id)}/signers/{_id(signer_id)}/{answer}",
        {},
    )
