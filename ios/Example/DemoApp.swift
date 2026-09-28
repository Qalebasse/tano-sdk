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
    private let journal = UILabel()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        journal.numberOfLines = 0
        journal.font = .monospacedSystemFont(ofSize: 13, weight: .regular)
        journal.text = "Événements :"
        journal.frame = view.bounds.insetBy(dx: 20, dy: 80)
        view.addSubview(journal)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard presentedViewController == nil, journal.text == "Événements :" else { return }
        let argument = ProcessInfo.processInfo.arguments.dropFirst().first { $0.hasPrefix("http") }
        let lien = URL(string: argument ?? "http://localhost:5188/?ecran=consentement")!
        let verification = TanoVerificationViewController(url: lien) { [weak self] event in
            NSLog("TANO_EVENT %@", String(describing: event))
            self?.journal.text = (self?.journal.text ?? "") + "\n" + String(describing: event)
        }
        present(UINavigationController(rootViewController: verification), animated: true)
    }
}
