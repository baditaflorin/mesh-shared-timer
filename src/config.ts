import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-shared-timer",
  description:
    "Kitchen/classroom/Pomodoro timer — every phone ticks and alarms in unison via mesh clock",
  accentHex: "#f7b500",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
