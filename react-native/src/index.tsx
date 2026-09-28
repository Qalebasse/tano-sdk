/**
 * Le parcours de vérification Tano dans une application React Native (react-native-webview).
 *
 * ```tsx
 * <TanoVerification
 *   url={session.url} // créée par votre serveur
 *   onEvent={(e) => { if (e.type === "completed") afficherMerci(); }}
 * />
 * ```
 *
 * iOS : `NSCameraUsageDescription`. Android : permission `CAMERA`, demandée avant d'ouvrir le
 * parcours. La caméra n'est accordée qu'à l'origine du parcours ; un lien sortant s'ouvre dans le
 * navigateur.
 */

import { useEffect, useRef } from "react";
import { Linking } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { type TanoEvent, journeyUrlAllowed, originOf, parseEvent } from "./event";

export { type TanoEvent, parseEvent } from "./event";

export interface TanoVerificationProps {
  readonly url: string;
  readonly onEvent: (event: TanoEvent) => void;
}

export function TanoVerification({ url, onEvent }: TanoVerificationProps) {
  if (!journeyUrlAllowed(url)) throw new Error("Le lien du parcours doit être en HTTPS.");
  const origin = originOf(url);
  const finished = useRef(false);
  const latest = useRef(onEvent);
  latest.current = onEvent;

  // Fermé avant la fin : la personne a quitté l'écran.
  useEffect(
    () => () => {
      if (!finished.current) latest.current({ type: "ended", reason: "cancelled" });
    },
    [],
  );

  const onMessage = (message: WebViewMessageEvent) => {
    const event = parseEvent(message.nativeEvent.data);
    if (event === null || finished.current) return;
    if (event.type === "completed" || event.type === "ended") finished.current = true;
    latest.current(event);
  };

  return (
    <WebView
      source={{ uri: url }}
      originWhitelist={origin === null ? [] : [origin]}
      onMessage={onMessage}
      onShouldStartLoadWithRequest={(request) => {
        if (originOf(request.url) === origin) return true;
        if (request.isTopFrame !== false) void Linking.openURL(request.url);
        return false;
      }}
      javaScriptEnabled
      domStorageEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
      incognito
    />
  );
}
