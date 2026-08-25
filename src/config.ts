import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-shared-timer",
  displayName: "Shared Timer",
  visualProfile: "utility",
  shellLayout: "inset",
  description: "A calm shared countdown that keeps every device in the room on the same clock.",
  accentHex: "#7ea5ff",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
