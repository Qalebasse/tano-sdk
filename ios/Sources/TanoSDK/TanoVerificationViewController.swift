#if canImport(UIKit)
import UIKit
import WebKit

/// Le parcours de vérification, plein écran, dans une WKWebView.
///
/// ```swift
/// let verification = TanoVerificationViewController(url: session.url) { event in
///     if case .completed = event { /* lisez le dossier côté serveur */ }
/// }
/// present(UINavigationController(rootViewController: verification), animated: true)
/// ```
///
/// Ajoutez `NSCameraUsageDescription` à l'Info.plist de l'application. La caméra n'est accordée
/// qu'à l'origine du parcours ; un lien vers une autre adresse s'ouvre dans Safari.
@MainActor
public final class TanoVerificationViewController: UIViewController, WKUIDelegate,
    WKNavigationDelegate
{
    public let journeyURL: URL
    private let onEvent: (TanoEvent) -> Void
    private var webView: WKWebView?
    private var finished = false

    /// `url` : le lien de la session, créé par votre serveur (`POST /v1/sessions`).
    public init(url: URL, onEvent: @escaping (TanoEvent) -> Void) {
        precondition(TanoJourneyURL.validated(url) != nil, "Le lien du parcours doit être en HTTPS.")
        self.journeyURL = url
        self.onEvent = onEvent
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) n'est pas pris en charge") }

    override public func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .close, target: self, action: #selector(close))

        let configuration = WKWebViewConfiguration()
        // La caméra dans la page, sans plein écran imposé ni geste préalable.
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        // Aucun stockage persistant : rien du parcours ne survit à l'écran.
        configuration.websiteDataStore = .nonPersistent()
        configuration.userContentController.add(MessageProxy(owner: self), name: "tano")

        let webView = WKWebView(frame: view.bounds, configuration: configuration)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.uiDelegate = self
        webView.navigationDelegate = self
        webView.allowsBackForwardNavigationGestures = false
        view.addSubview(webView)
        self.webView = webView
        webView.load(URLRequest(url: journeyURL))
    }

    @objc private func close() {
        emit(.ended("cancelled"))
        dismiss(animated: true)
    }

    fileprivate func receive(_ body: Any) {
        guard let message = body as? String, let event = TanoEvent(message: message) else { return }
        emit(event)
    }

    private func emit(_ event: TanoEvent) {
        if finished { return }
        switch event {
        case .completed, .ended: finished = true
        default: break
        }
        onEvent(event)
    }

    // MARK: Caméra — accordée à l'origine du parcours seulement.

    public func webView(
        _ webView: WKWebView,
        requestMediaCapturePermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        type: WKMediaCaptureType,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        let sameHost = origin.host.lowercased() == journeyURL.host?.lowercased()
        let sameScheme = origin.protocol.lowercased() == journeyURL.scheme?.lowercased()
        decisionHandler(sameHost && sameScheme && type == .camera ? .grant : .deny)
    }

    // MARK: Navigation — le parcours reste dans son origine.

    public func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let target = navigationAction.request.url else { return decisionHandler(.cancel) }
        if TanoJourneyURL.sameOrigin(target, journeyURL) || target.scheme == "about" {
            return decisionHandler(.allow)
        }
        // Un lien sortant (politique de confidentialité, site du client) : dans Safari.
        if navigationAction.navigationType == .linkActivated {
            UIApplication.shared.open(target)
        }
        decisionHandler(.cancel)
    }
}

/// Le gestionnaire de messages retient son propriétaire faiblement : la WebView ne garde pas
/// l'écran en vie après sa fermeture.
private final class MessageProxy: NSObject, WKScriptMessageHandler {
    weak var owner: TanoVerificationViewController?

    init(owner: TanoVerificationViewController) { self.owner = owner }

    func userContentController(
        _ userContentController: WKUserContentController, didReceive message: WKScriptMessage
    ) {
        let body = message.body
        MainActor.assumeIsolated { owner?.receive(body) }
    }
}
#endif
