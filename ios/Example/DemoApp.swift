// Application de démonstration du SDK iOS : ouvre le parcours et affiche ses événements.
// Lien du parcours : premier argument de lancement, sinon l'aperçu de développement de tano-web.

import TanoSDKDemoSupport
import UIKit

@main
final class DemoAppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = DemoViewController()
        window.makeKeyAndVisible()
        self.window = window
        return true
    }
}

final class DemoViewController: UIViewController {
    private let eventLog = UILabel()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        eventLog.numberOfLines = 0
        eventLog.font = .monospacedSystemFont(ofSize: 13, weight: .regular)
        eventLog.text = "Événements :"
        eventLog.frame = view.bounds.insetBy(dx: 20, dy: 80)
        view.addSubview(eventLog)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard presentedViewController == nil, eventLog.text == "Événements :" else { return }
        let argument = ProcessInfo.processInfo.arguments.dropFirst().first { $0.hasPrefix("http") }
        let journeyURL = URL(string: argument ?? "http://localhost:5188/?ecran=consentement")!
        let verification = TanoVerificationViewController(url: journeyURL) { [weak self] event in
            NSLog("TANO_EVENT %@", String(describing: event))
            self?.eventLog.text = (self?.eventLog.text ?? "") + "\n" + String(describing: event)
        }
        present(UINavigationController(rootViewController: verification), animated: true)
    }
}
