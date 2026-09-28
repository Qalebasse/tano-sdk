import Foundation

/// Ce que le parcours dit à l'application. Aucun résultat : la décision se lit côté serveur
/// (webhook `case.decided`, ou `GET /v1/cases/{id}/results`).
public enum TanoEvent: Equatable, Sendable {
    /// Le parcours est affiché.
    case ready
    /// Une étape commence : `consent`, `applicant`, `questionnaire`, `document`, `face`, `check`,
    /// `uploading`, `help`.
    case step(String)
    /// La personne a tout envoyé.
    case completed
    /// Le parcours s'est arrêté sans envoi : `declined`, `expired`, `invalid_link`, `later`, ou
    /// `cancelled` quand la personne ferme l'écran.
    case ended(String)

    /// Lire un message du parcours (JSON). `nil` pour ce qui n'est pas un événement connu.
    public init?(message: String) {
        guard
            let data = message.data(using: .utf8),
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let type = object["type"] as? String
        else { return nil }
        switch type {
        case "tano:ready":
            self = .ready
        case "tano:step":
            guard let step = object["step"] as? String else { return nil }
            self = .step(step)
        case "tano:completed":
            self = .completed
        case "tano:ended":
            guard let reason = object["reason"] as? String else { return nil }
            self = .ended(reason)
        default:
            return nil
        }
    }
}

/// Le lien d'un parcours : HTTPS, ou `http://localhost` pour le développement.
public enum TanoJourneyURL {
    public static func validated(_ url: URL) -> URL? {
        guard let scheme = url.scheme?.lowercased(), let host = url.host?.lowercased() else {
            return nil
        }
        if scheme == "https" { return url }
        if scheme == "http", host == "localhost" || host == "127.0.0.1" { return url }
        return nil
    }

    /// Même origine : schéma, hôte et port identiques.
    public static func sameOrigin(_ a: URL, _ b: URL) -> Bool {
        a.scheme?.lowercased() == b.scheme?.lowercased()
            && a.host?.lowercased() == b.host?.lowercased()
            && (a.port ?? defaultPort(a)) == (b.port ?? defaultPort(b))
    }

    private static func defaultPort(_ url: URL) -> Int {
        url.scheme?.lowercased() == "https" ? 443 : 80
    }
}
