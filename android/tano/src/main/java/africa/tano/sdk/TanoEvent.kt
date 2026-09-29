package africa.tano.sdk

import android.net.Uri
import org.json.JSONException
import org.json.JSONObject

/**
 * Ce que le parcours dit à l'application. Aucun résultat : la décision se lit côté serveur
 * (webhook `case.decided`, ou `GET /v1/cases/{id}/results`).
 */
sealed class TanoEvent {
    /** Le parcours est affiché. */
    data object Ready : TanoEvent()

    /** Une étape commence : consent, applicant, questionnaire, document, face, check, uploading, help. */
    data class Step(val step: String) : TanoEvent()

    /** La personne a tout envoyé. */
    data object Completed : TanoEvent()

    /** Arrêt sans envoi : declined, expired, invalid_link, later, ou cancelled (écran fermé). */
    data class Ended(val reason: String) : TanoEvent()

    companion object {
        /** Lire un message du parcours (JSON) ; `null` pour ce qui n'est pas un événement connu. */
        fun parse(message: String): TanoEvent? {
            val json = try {
                JSONObject(message)
            } catch (_: JSONException) {
                return null
            }
            return when (json.optString("type")) {
                "tano:ready" -> Ready
                "tano:step" -> json.optString("step").takeIf { it.isNotEmpty() }?.let(::Step)
                "tano:completed" -> Completed
                "tano:ended" -> json.optString("reason").takeIf { it.isNotEmpty() }?.let(::Ended)
                else -> null
            }
        }
    }
}

/** Le lien d'un parcours : HTTPS, ou http://localhost pour le développement. */
object TanoJourneyUrl {
    fun isAllowed(scheme: String?, host: String?): Boolean {
        val s = scheme?.lowercase() ?: return false
        val h = host?.lowercase() ?: return false
        return s == "https" || (s == "http" && (h == "localhost" || h == "127.0.0.1"))
    }

    fun isAllowed(uri: Uri): Boolean = isAllowed(uri.scheme, uri.host)

    /** Même origine : schéma, hôte et port. */
    fun sameOrigin(a: Uri, b: Uri): Boolean =
        a.scheme.equals(b.scheme, ignoreCase = true) &&
            a.host.equals(b.host, ignoreCase = true) &&
            port(a) == port(b)

    private fun port(u: Uri): Int = if (u.port != -1) u.port else if (u.scheme == "https") 443 else 80
}
