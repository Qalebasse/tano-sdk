import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Le SDK web depuis ses sources : les tests ne dépendent pas d'une construction préalable.
export default defineConfig({
  resolve: {
    alias: { "@tano/web": fileURLToPath(new URL("../web/src/index.ts", import.meta.url)) },
  },
  test: { environment: "happy-dom" },
});
