import 'dart:convert';

/// Ce que le parcours dit à l'application. Aucun résultat : la décision se lit côté serveur
/// (webhook `case.decided`, ou `GET /v1/cases/{id}/results`).
sealed class TanoEvent {
  const TanoEvent();

  /// Lire un message du parcours (JSON) ; `null` pour ce qui n'est pas un événement connu.
  static TanoEvent? parse(String message) {
    final Object? decoded;
    try {
      decoded = jsonDecode(message);
    } on FormatException {
      return null;
    }
    if (decoded is! Map<String, dynamic>) return null;
    switch (decoded['type']) {
      case 'tano:ready':
        return const TanoReady();
      case 'tano:step':
        final step = decoded['step'];
        return step is String ? TanoStep(step) : null;
      case 'tano:completed':
        return const TanoCompleted();
      case 'tano:ended':
        final reason = decoded['reason'];
        return reason is String ? TanoEnded(reason) : null;
    }
    return null;
  }
}

/// Le parcours est affiché.
final class TanoReady extends TanoEvent {
  const TanoReady();
  @override
  bool operator ==(Object other) => other is TanoReady;
  @override
  int get hashCode => 1;
  @override
  String toString() => 'TanoReady';
}

/// Une étape commence : consent, applicant, questionnaire, document, face, check, uploading, help.
final class TanoStep extends TanoEvent {
  const TanoStep(this.step);
  final String step;
  @override
  bool operator ==(Object other) => other is TanoStep && other.step == step;
  @override
  int get hashCode => step.hashCode;
  @override
  String toString() => 'TanoStep($step)';
}

/// La personne a tout envoyé.
final class TanoCompleted extends TanoEvent {
  const TanoCompleted();
  @override
  bool operator ==(Object other) => other is TanoCompleted;
  @override
  int get hashCode => 2;
  @override
  String toString() => 'TanoCompleted';
}

/// Arrêt sans envoi : declined, expired, invalid_link, later, ou cancelled (écran fermé).
final class TanoEnded extends TanoEvent {
  const TanoEnded(this.reason);
  final String reason;
  @override
  bool operator ==(Object other) => other is TanoEnded && other.reason == reason;
  @override
  int get hashCode => reason.hashCode;
  @override
  String toString() => 'TanoEnded($reason)';
}

/// Le lien d'un parcours : HTTPS, ou http://localhost pour le développement.
bool journeyUrlAllowed(Uri url) {
  final host = url.host.toLowerCase();
  return url.scheme == 'https' ||
      (url.scheme == 'http' && (host == 'localhost' || host == '127.0.0.1'));
}

/// Même origine : schéma, hôte et port.
bool sameOrigin(Uri a, Uri b) =>
    a.scheme == b.scheme && a.host.toLowerCase() == b.host.toLowerCase() && a.port == b.port;
