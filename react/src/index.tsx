/**
 * Le parcours de vérification Tano dans une page React.
 *
 * Une enveloppe de `mount` (@tano/web) : le composant monte le cadre, le démonte, et le remonte
 * quand le lien change. Les rappels sont lus à jour sans remonter le parcours.
 */

import { type CSSProperties, useEffect, useRef } from "react";

import { type EmbedStep, type EndReason, type JourneyEvent, mount } from "@tano/web";

export type { EmbedStep, EndReason, JourneyEvent } from "@tano/web";

export interface TanoVerificationProps {
  /** Le lien de la session, créé par votre serveur (`POST /v1/sessions`). */
  readonly url: string;
  readonly onReady?: () => void;
  readonly onStep?: (step: EmbedStep) => void;
  readonly onCompleted?: () => void;
  readonly onEnded?: (reason: EndReason) => void;
  readonly onEvent?: (event: JourneyEvent) => void;
  /** Le lien a expiré : rendez-en un nouveau, le parcours reprend dans le même cadre. */
  readonly onExpired?: () => Promise<string>;
  readonly minHeight?: number;
  readonly title?: string;
  readonly className?: string;
  readonly style?: CSSProperties;
}

export function TanoVerification(props: TanoVerificationProps) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;

  // Le cadre se remonte quand le lien change, et seulement alors : le reste est lu via `latest`.
  useEffect(() => {
    if (host.current === null) return;
    const { onExpired, minHeight, title } = latest.current;
    const mounted = mount(host.current, {
      url: props.url,
      onReady: () => latest.current.onReady?.(),
      onStep: (step) => latest.current.onStep?.(step),
      onCompleted: () => latest.current.onCompleted?.(),
      onEnded: (reason) => latest.current.onEnded?.(reason),
      onEvent: (event) => latest.current.onEvent?.(event),
      ...(onExpired === undefined
        ? {}
        : { onExpired: () => (latest.current.onExpired ?? onExpired)() }),
      ...(minHeight === undefined ? {} : { minHeight }),
      ...(title === undefined ? {} : { title }),
    });
    return () => mounted.destroy();
  }, [props.url]);

  return <div ref={host} className={props.className} style={props.style} />;
}
