package africa.tano.sdk

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebStorage
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity

/**
 * Le parcours de vérification, plein écran, dans une WebView.
 *
 * La caméra n'est accordée qu'à l'origine du parcours, après l'accord de la personne ; un lien vers
 * une autre adresse s'ouvre dans le navigateur. Rien n'est gardé : cache et stockage sont vidés à
 * la fermeture.
 */
class TanoVerificationActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var journey: Uri
    private var outcome: String? = null
    private var pendingPermission: PermissionRequest? = null
    private var pendingFiles: ValueCallback<Array<Uri>>? = null

    private val cameraPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            val request = pendingPermission ?: return@registerForActivityResult
            pendingPermission = null
            if (granted) request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) else request.deny()
        }

    private val filePicker =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val callback = pendingFiles ?: return@registerForActivityResult
            pendingFiles = null
            callback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data))
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val url = intent.getStringExtra(TanoVerification.EXTRA_URL)?.let(Uri::parse)
        if (url == null || !TanoJourneyUrl.isAllowed(url)) {
            finishWith("invalid_link")
            return
        }
        journey = url
        webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = false
        }
        webView.addJavascriptInterface(Bridge(), "TanoNative")
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (TanoJourneyUrl.sameOrigin(request.url, journey)) return false
                if (request.isForMainFrame && request.hasGesture()) {
                    startActivity(Intent(Intent.ACTION_VIEW, request.url))
                }
                return true
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                val camera = request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
                if (!camera || !TanoJourneyUrl.sameOrigin(request.origin, journey)) {
                    request.deny()
                    return
                }
                val granted = checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                if (granted) {
                    request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
                } else {
                    pendingPermission = request
                    cameraPermission.launch(Manifest.permission.CAMERA)
                }
            }

            // Le mode « envoyer une photo » du parcours : le sélecteur du téléphone.
            override fun onShowFileChooser(
                view: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams,
            ): Boolean {
                pendingFiles?.onReceiveValue(null)
                pendingFiles = callback
                filePicker.launch(params.createIntent())
                return true
            }
        }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = finishWith("cancelled")
        })
        webView.loadUrl(journey.toString())
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.clearCache(true)
            WebStorage.getInstance().deleteAllData()
            webView.destroy()
        }
        if (outcome == null) TanoVerification.onEvent?.invoke(TanoEvent.Ended("cancelled"))
        super.onDestroy()
    }

    private fun receive(message: String) {
        val event = TanoEvent.parse(message) ?: return
        if (outcome != null) return
        TanoVerification.onEvent?.invoke(event)
        when (event) {
            is TanoEvent.Completed -> outcome = "completed"
            is TanoEvent.Ended -> outcome = event.reason
            else -> Unit
        }
    }

    private fun finishWith(reason: String) {
        if (outcome == null) {
            outcome = reason
            TanoVerification.onEvent?.invoke(TanoEvent.Ended(reason))
        }
        finish()
    }

    override fun finish() {
        setResult(Activity.RESULT_OK, Intent().putExtra(TanoVerification.EXTRA_OUTCOME, outcome ?: "cancelled"))
        super.finish()
    }

    /** Le pont du parcours : appelé hors du fil principal, il y repasse. */
    inner class Bridge {
        @JavascriptInterface
        fun postMessage(message: String) {
            runOnUiThread { receive(message) }
        }
    }
}
