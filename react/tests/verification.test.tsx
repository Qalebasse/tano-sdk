import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TanoVerification } from "../src/index.js";

afterEach(cleanup);

describe("TanoVerification", () => {
  it("monte le cadre à l'adresse d'intégration, et le remonte quand le lien change", () => {
    const { container, rerender, unmount } = render(
      <TanoVerification url="https://verify.tano.africa/#jeton-1" />,
    );
    expect(container.querySelector("iframe")?.src).toBe("https://verify.tano.africa/embed#jeton-1");

    rerender(<TanoVerification url="https://verify.tano.africa/#jeton-2" />);
    const frames = container.querySelectorAll("iframe");
    expect(frames).toHaveLength(1);
    expect(frames[0]?.src).toBe("https://verify.tano.africa/embed#jeton-2");

    unmount();
    expect(container.querySelector("iframe")).toBeNull();
  });
});
