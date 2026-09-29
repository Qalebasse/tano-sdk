package africa.tano.demo

import android.os.Bundle
import android.util.Log
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import africa.tano.sdk.TanoVerification

/** Démonstration : ouvre le parcours (lien en extra `url`, sinon l'aperçu local) et journalise. */
class MainActivity : AppCompatActivity() {
    private val verification = registerForActivityResult(TanoVerification()) { issue ->
        Log.i("TANO_EVENT", "issue $issue")
        journal.append("\nissue $issue")
    }
    private lateinit var journal: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        journal = TextView(this).apply { text = "Événements :"; setPadding(48, 160, 48, 48) }
        setContentView(journal)
        TanoVerification.onEvent = { event ->
            Log.i("TANO_EVENT", event.toString())
            journal.append("\n$event")
        }
        if (savedInstanceState == null) {
            verification.launch(intent.getStringExtra("url") ?: "http://localhost:5188/?ecran=consentement")
        }
    }
}
