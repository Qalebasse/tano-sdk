import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';

import 'event.dart';

/// Le parcours de vérification Tano, dans une WebView.
///
/// ```dart
/// TanoVerification(
///   url: Uri.parse(session.url), // créée par votre serveur
///   onEvent: (event) {
///     if (event is TanoCompleted) afficherMerci(); // puis lisez le dossier côté serveur
///   },
/// )
/// ```
///
/// La caméra n'est accordée qu'à l'origine du parcours ; un lien vers une autre adresse s'ouvre
/// dans le navigateur. iOS : `NSCameraUsageDescription` dans l'Info.plist. Android : la
/// permission `CAMERA`, demandée par l'application avant d'ouvrir le parcours.
class TanoVerification extends StatefulWidget {
  const TanoVerification({super.key, required this.url, required this.onEvent});

  final Uri url;
  final void Function(TanoEvent event) onEvent;

  @override
  State<TanoVerification> createState() => _TanoVerificationState();
}

class _TanoVerificationState extends State<TanoVerification> {
  late final WebViewController _controller;
  bool _finished = false;

  @override
  void initState() {
    super.initState();
    assert(journeyUrlAllowed(widget.url), 'Le lien du parcours doit être en HTTPS.');

    final PlatformWebViewControllerCreationParams params =
        WebViewPlatform.instance is WebKitWebViewPlatform
            ? WebKitWebViewControllerCreationParams(
                allowsInlineMediaPlayback: true,
                mediaTypesRequiringUserAction: const <PlaybackMediaTypes>{},
              )
            : const PlatformWebViewControllerCreationParams();

    _controller = WebViewController.fromPlatformCreationParams(
      params,
      onPermissionRequest: (request) {
        // La caméra, pour le parcours seulement : la page chargée est retenue dans son origine.
        if (request.types.contains(WebViewPermissionResourceType.camera)) {
          request.grant();
        } else {
          request.deny();
        }
      },
    )
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..addJavaScriptChannel('TanoNative', onMessageReceived: (message) {
        final event = TanoEvent.parse(message.message);
        if (event == null || _finished) return;
        if (event is TanoCompleted || event is TanoEnded) _finished = true;
        widget.onEvent(event);
      })
      ..setNavigationDelegate(NavigationDelegate(
        onNavigationRequest: (request) {
          final target = Uri.tryParse(request.url);
          if (target != null && sameOrigin(target, widget.url)) {
            return NavigationDecision.navigate;
          }
          if (target != null && request.isMainFrame) {
            launchUrl(target, mode: LaunchMode.externalApplication);
          }
          return NavigationDecision.prevent;
        },
      ));

    final platform = _controller.platform;
    if (platform is AndroidWebViewController) {
      platform.setMediaPlaybackRequiresUserGesture(false);
    }
    _controller.loadRequest(widget.url);
  }

  @override
  void dispose() {
    if (!_finished) widget.onEvent(const TanoEnded('cancelled'));
    _controller.clearCache();
    _controller.clearLocalStorage();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => WebViewWidget(controller: _controller);
}
