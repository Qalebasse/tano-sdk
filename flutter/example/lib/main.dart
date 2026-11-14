// Démonstration de tano_flutter : ouvre le parcours et journalise ses événements.
// Lien : --dart-define=TANO_URL=…, sinon l'aperçu local de tano-web.

// L'exemple montre une application Material ordinaire. Flutter 3.47 et suivants annoncent
// le déplacement de Material dans le paquet material_ui ; l'exemple suit l'import le plus répandu.
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:tano_flutter/tano_flutter.dart';

const journeyUrl = String.fromEnvironment('TANO_URL', defaultValue: 'http://localhost:5188/?ecran=consentement');

void main() => runApp(const MaterialApp(home: Demo()));

class Demo extends StatelessWidget {
  const Demo({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        body: SafeArea(
          child: TanoVerification(
            url: Uri.parse(journeyUrl),
            onEvent: (event) => debugPrint('TANO_EVENT $event'),
          ),
        ),
      );
}
