"""Le client de l'API Tano, sans dépendance : la bibliothèque standard suffit."""

from __future__ import annotations

import hashlib
import json
import random
import threading
import time
import urllib.error
import urllib.request
import uuid
from collections import OrderedDict
from collections.abc import Iterable, Iterator, Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Callable, Union
from urllib.parse import quote, urlencode

from tano_sdk.errors import TanoApiError, TanoConnectionError, TanoError
from tano_sdk.signature import parse_key, request_signature

VERSION = "0.1.0"
DEFAULT_BASE_URL = "https://api.tano.africa"
_RETRYABLE = frozenset({429, 500, 502, 503, 504})


@dataclass(frozen=True)
class HttpRequest:
    method: str
    url: str
    headers: Mapping[str, str]
    body: bytes | None
    timeout: float


@dataclass(frozen=True)
class HttpResponse:
    status: int
    headers: Mapping[str, str]
    body: bytes


#: Ce qui envoie une requête. Remplaçable, pour les tests ou un client HTTP maison.
Transport = Callable[[HttpRequest], HttpResponse]


def urllib_transport(request: HttpRequest) -> HttpResponse:
    prepared = urllib.request.Request(  # noqa: S310 — l'adresse vient de la configuration
        request.url, data=request.body, method=request.method, headers=dict(request.headers)
    )
    try:
        with urllib.request.urlopen(prepared, timeout=request.timeout) as response:  # noqa: S310
            return HttpResponse(response.status, dict(response.headers.items()), response.read())
    except urllib.error.HTTPError as error:
        return HttpResponse(error.code, dict(error.headers.items()), error.read())


Query = Mapping[str, Union[str, int, Iterable[str], None]]


class Tano:
    """Le client de l'API.

    Il signe les créations (HMAC v2), pose une clé d'idempotence sur chacune et la garde d'un
    réessai à l'autre : une requête rejouée après une coupure rend le même dossier, pas un second.
    """

    def __init__(
        self,
        api_key: str,
        *,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = 30.0,
        max_retries: int = 2,
        transport: Transport = urllib_transport,
    ) -> None:
        parsed = parse_key(api_key)
        if parsed is None:
            raise TanoError("Clé d'API mal formée : attendue tano_<environnement>_<id>_<secret>.")
        self.environment = parsed.environment
        self._key = api_key.strip()
        self._secret = parsed.secret
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._max_retries = max_retries
        self._transport = transport
        self._last_signed: OrderedDict[str, int] = OrderedDict()
        self._lock = threading.Lock()
        self.cases = Cases(self)
        self.sessions = Sessions(self)
        self.sandbox = Sandbox(self)

    def _timestamp(self, method: str, target: str, payload: bytes) -> int:
        """L'horodatage à signer.

        La signature ne porte que sur l'horodatage, la méthode, la cible et le corps : deux
        requêtes identiques dans la même seconde auraient la même, et l'API refuse une signature
        déjà vue. Un réessai rapide prend donc la seconde suivante — l'API tolère cinq minutes.
        """
        key = hashlib.sha256(f"{method} {target} ".encode() + payload).hexdigest()
        now = int(time.time())
        with self._lock:
            last = self._last_signed.pop(key, None)
            timestamp = last + 1 if last is not None and last >= now else now
            self._last_signed[key] = timestamp
            if len(self._last_signed) > 256:
                self._last_signed.popitem(last=False)
        return timestamp

    def request(
        self,
        method: str,
        path: str,
        body: Mapping[str, Any] | None = None,
        *,
        query: Query | None = None,
        idempotency_key: str | None = None,
    ) -> Any:
        """Une requête brute, pour une route que le SDK n'expose pas encore."""
        response = self._send(method, path, body, query=query, idempotency_key=idempotency_key)
        return _json(response.body)

    def request_bytes(self, path: str) -> HttpResponse:
        """Une lecture binaire (une image) : la réponse telle quelle, `Content-Type` compris."""
        return self._send("GET", path, None)

    def _send(
        self,
        method: str,
        path: str,
        body: Mapping[str, Any] | None,
        *,
        query: Query | None = None,
        idempotency_key: str | None = None,
    ) -> HttpResponse:
        target = path + _query_string(query)
        payload = b"" if body is None else json.dumps(body, separators=(",", ":")).encode()
        key = None if method == "GET" else (idempotency_key or str(uuid.uuid4()))

        attempt = 0
        while True:
            headers = {
                "Authorization": f"Bearer {self._key}",
                "Accept": "application/json",
                "User-Agent": f"tano-python/{VERSION}",
            }
            if key is not None:
                timestamp = str(self._timestamp(method, target, payload))
                headers.update(
                    {
                        "Content-Type": "application/json",
                        "Idempotency-Key": key,
                        "X-Tano-Timestamp": timestamp,
                        "X-Tano-Signature": request_signature(
                            self._secret, timestamp, method, target, payload
                        ),
                    }
                )
            request = HttpRequest(
                method,
                self._base_url + target,
                headers,
                None if method == "GET" else payload,
                self._timeout,
            )
            try:
                response = self._transport(request)
            except OSError as error:
                if attempt < self._max_retries:
                    time.sleep(_backoff(attempt))
                    attempt += 1
                    continue
                raise TanoConnectionError(
                    f"L'API Tano n'a pas répondu ({error}). Avec la même clé d'idempotence, "
                    "rejouer la requête est sans risque."
                ) from error

            if response.status in _RETRYABLE and attempt < self._max_retries:
                time.sleep(_retry_after(response) or _backoff(attempt))
                attempt += 1
                continue
            if response.status >= 400:
                data = _json(response.body)
                error_body = data.get("error") if isinstance(data, dict) else None
                raise TanoApiError(
                    response.status,
                    error_body if isinstance(error_body, dict) else {},
                    _header(response.headers, "X-Request-Id"),
                )
            return response


class Cases:
    def __init__(self, client: Tano) -> None:
        self._client = client

    def create(
        self,
        *,
        flow_name: str,
        country: str,
        external_ref: str | None = None,
        declared: Mapping[str, str] | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        """Ouvrir un dossier."""
        body: dict[str, Any] = {"flow_name": flow_name, "country": country}
        if external_ref is not None:
            body["external_ref"] = external_ref
        if declared:
            body["declared"] = dict(declared)
        return self._client.request(  # type: ignore[no-any-return]
            "POST", "/v1/cases", body, idempotency_key=idempotency_key
        )

    def retrieve(self, case_id: str) -> dict[str, Any]:
        return self._client.request(  # type: ignore[no-any-return]
            "GET", f"/v1/cases/{quote(case_id, safe='')}"
        )

    def results(self, case_id: str) -> dict[str, Any]:
        """Tout ce qui fonde la décision, sans donnée personnelle : `state` en un mot
        (`approved`, `rejected`, `resubmission_requested`…), la décision, la reprise demandée,
        le compte rendu de chaque contrôle, les pièces reçues."""
        return self._client.request(  # type: ignore[no-any-return]
            "GET", f"/v1/cases/{quote(case_id, safe='')}/results"
        )

    def data(self, case_id: str) -> dict[str, Any]:
        """Les données personnelles du dossier. Clé avec la permission `personal_data` ; la
        lecture est inscrite au journal des consultations du dossier."""
        return self._client.request(  # type: ignore[no-any-return]
            "GET", f"/v1/cases/{quote(case_id, safe='')}/data"
        )

    def image(self, case_id: str, piece_id: str) -> tuple[str, bytes]:
        """Une image du dossier (`pieces[].id` des résultats) : son type et ses octets.
        Permission `personal_data`."""
        response = self._client.request_bytes(
            f"/v1/cases/{quote(case_id, safe='')}/images/{quote(piece_id, safe='')}"
        )
        kind = _header(response.headers, "Content-Type") or "application/octet-stream"
        return kind, response.body

    def decide(
        self,
        case_id: str,
        *,
        outcome: str,
        reason_code: str,
        steps: Iterable[str] | None = None,
        comment: str | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        """Trancher un dossier **en revue** : `approve`, `reject` ou `resubmit` (avec `steps` :
        `document`, `face`). Permission `decisions`. Le dossier conclut ensuite : webhook
        `case.decided` ou `case.resubmission_requested`."""
        body: dict[str, Any] = {"outcome": outcome, "reason_code": reason_code}
        if steps is not None:
            body["steps"] = list(steps)
        if comment is not None:
            body["comment"] = comment
        return self._client.request(  # type: ignore[no-any-return]
            "POST",
            f"/v1/cases/{quote(case_id, safe='')}/decision",
            body,
            idempotency_key=idempotency_key,
        )

    def erase(self, case_id: str) -> dict[str, Any]:
        """Effacer les données personnelles d'un dossier **clos**. Permission `personal_data`.
        La trace du dossier reste ; webhook `case.personal_data_erased`."""
        return self._client.request(  # type: ignore[no-any-return]
            "POST", f"/v1/cases/{quote(case_id, safe='')}/erasure", {}
        )

    def list(
        self,
        *,
        q: str | None = None,
        external_ref: str | None = None,
        status: str | Iterable[str] | None = None,
        country: str | Iterable[str] | None = None,
        created_after: str | datetime | None = None,
        created_before: str | datetime | None = None,
        limit: int | None = None,
        cursor: str | None = None,
    ) -> dict[str, Any]:
        """Une page de dossiers : `data`, `has_more`, `next_cursor`."""
        return self._client.request(  # type: ignore[no-any-return]
            "GET",
            "/v1/cases",
            query={
                "q": q,
                "external_ref": external_ref,
                "status": _as_list(status),
                "country": _as_list(country),
                "created_after": _as_date(created_after),
                "created_before": _as_date(created_before),
                "limit": limit,
                "cursor": cursor,
            },
        )

    def list_all(self, **filters: Any) -> Iterator[dict[str, Any]]:
        """Tous les dossiers qui répondent aux filtres, page après page."""
        while True:
            page = self.list(**filters)
            yield from page["data"]
            if not page["has_more"] or page["next_cursor"] is None:
                return
            filters["cursor"] = page["next_cursor"]


class Sessions:
    def __init__(self, client: Tano) -> None:
        self._client = client

    def create(
        self,
        *,
        case_id: str,
        locale: str | None = None,
        lifetime_minutes: int | None = None,
        return_url: str | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        """Une session de parcours. `url` est le lien à ouvrir ; il n'est rendu qu'une fois.

        `return_url` : où revient la personne (HTTPS, sans paramètre ni fragment), à la place de
        l'adresse du parcours. Le SDK web s'en sert pour la fenêtre.
        """
        body: dict[str, Any] = {"case_id": case_id}
        for name, value in (
            ("locale", locale),
            ("lifetime_minutes", lifetime_minutes),
            ("return_url", return_url),
        ):
            if value is not None:
                body[name] = value
        return self._client.request(  # type: ignore[no-any-return]
            "POST", "/v1/sessions", body, idempotency_key=idempotency_key
        )


class Sandbox:
    def __init__(self, client: Tano) -> None:
        self._client = client

    def submit(self, case_id: str) -> dict[str, Any]:
        """Bac à sable : faire comme si la personne avait terminé son parcours. Le nom de famille
        déclaré choisit le résultat (TESTPASS, TESTREVIEW, TESTFAIL, TESTSANCTION…)."""
        return self._client.request(  # type: ignore[no-any-return]
            "POST", f"/v1/sandbox/cases/{quote(case_id, safe='')}/submit", {}
        )


def _query_string(query: Query | None) -> str:
    if not query:
        return ""
    pairs: list[tuple[str, str]] = []
    for name, value in query.items():
        if value is None:
            continue
        if isinstance(value, (str, int)):
            pairs.append((name, str(value)))
        else:
            pairs.extend((name, str(item)) for item in value)
    return f"?{urlencode(pairs)}" if pairs else ""


def _as_list(value: str | Iterable[str] | None) -> list[str] | None:
    if value is None:
        return None
    return [value] if isinstance(value, str) else list(value)


def _as_date(value: str | datetime | None) -> str | None:
    return value.isoformat() if isinstance(value, datetime) else value


def _json(body: bytes) -> Any:
    if not body:
        return {}
    try:
        return json.loads(body)
    except ValueError:
        return None


def _header(headers: Mapping[str, str], name: str) -> str | None:
    wanted = name.lower()
    return next((v for k, v in headers.items() if k.lower() == wanted), None)


def _backoff(attempt: int) -> float:
    return float(min(0.5 * 2**attempt, 4.0) * (0.75 + random.random() / 2))  # noqa: S311


def _retry_after(response: HttpResponse) -> float | None:
    try:
        value = float(_header(response.headers, "Retry-After") or "")
    except ValueError:
        return None
    return min(value, 30.0) if value > 0 else None
