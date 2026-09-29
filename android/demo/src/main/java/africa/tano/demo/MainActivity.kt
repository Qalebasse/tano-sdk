package africa.tano.demo

import android.os.Bundle
import android.util.Log
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import africa.tano.sdk.TanoVerification

/** Démonstration : ouvre le parcours (lien en extra `url`, sinon l'aperçu local) et journalise. */
class MainActivity : AppCompatActivity() {
    private val verification = registerForActivityResult(TanoVerification()) { outcome ->
        Log.i("TANO_EVENT", "outcome $outcome")
        eventLog.append("\nissue $outcome")
    }
    private lateinit var eventLog: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        eventLog = TextView(this).apply { text = "Événements :"; setPadding(48, 160, 48, 48) }
        setContentView(eventLog)
        TanoVerification.onEvent = { event ->
            Log.i("TANO_EVENT", event.toString())
            eventLog.append("\n$event")
        }
        if (savedInstanceState == null) {
            verification.launch(intent.getStringExtra("url") ?: "http://localhost:5188/?ecran=consentement")
        }
    }
}
