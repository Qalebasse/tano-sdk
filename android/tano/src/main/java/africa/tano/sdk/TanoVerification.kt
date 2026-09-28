package africa.tano.sdk

import android.content.Context
import android.content.Intent
import androidx.activity.result.contract.ActivityResultContract

/**
 * Lancer le parcours et recevoir son issue.
 *
 * ```kotlin
 * private val verification = registerForActivityResult(TanoVerification()) { issue ->
 *     when (issue) {
 *         is TanoEvent.Completed -> afficherMerci()          // puis lisez le dossier côté serveur
 *         is TanoEvent.Ended -> proposerDeReprendre(issue.reason)
 *         else -> Unit
 *     }
 * }
 * verification.launch(sessionUrl)
 * ```
 *
 * Pour suivre les étapes en direct : `TanoVerification.onEvent = { event -> … }`.
 */
class TanoVerification : ActivityResultContract<String, TanoEvent>() {
    override fun createIntent(context: Context, input: String): Intent =
        Intent(context, TanoVerificationActivity::class.java).putExtra(EXTRA_URL, input)

    override fun parseResult(resultCode: Int, intent: Intent?): TanoEvent =
        when (intent?.getStringExtra(EXTRA_OUTCOME)) {
            "completed" -> TanoEvent.Completed
            null -> TanoEvent.Ended("cancelled")
            else -> TanoEvent.Ended(intent.getStringExtra(EXTRA_OUTCOME) ?: "cancelled")
        }

    companion object {
        internal const val EXTRA_URL = "africa.tano.sdk.URL"
        internal const val EXTRA_OUTCOME = "africa.tano.sdk.OUTCOME"

        /** Chaque événement du parcours en cours, sur le fil principal. */
        @JvmStatic
        var onEvent: ((TanoEvent) -> Unit)? = null
    }
}
