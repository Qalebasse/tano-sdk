// Démonstration de tano_flutter : ouvre le parcours et journalise ses événements.
// Lien : --dart-define=TANO_URL=…, sinon l'aperçu local de tano-web.

import 'package:flutter/material.dart';
import 'package:tano_flutter/tano_flutter.dart';

const lien = String.fromEnvironment('TANO_URL', defaultValue: 'http://localhost:5188/?ecran=consentement');

void main() => runApp(const MaterialApp(home: Demo()));

class Demo extends StatelessWidget {
  const Demo({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        body: SafeArea(
          child: TanoVerification(
            url: Uri.parse(lien),
            onEvent: (event) => debugPrint('TANO_EVENT $event'),
          ),
        ),
      );
}
