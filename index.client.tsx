import type { PluginClientContext } from "@getpaseo/plugin/client";
import { AllOfficesScreen, OfficePanel } from "./client/OfficePanel";
import { OfficeSidebarItem } from "./client/OfficeSidebarItem";
import { ALL_OFFICES_SCREEN_ID, PANEL_ID } from "./client/ids";

export default function contribute(client: PluginClientContext) {
  client.addWorkspacePanel({ id: PANEL_ID, title: "Agent Office", icon: "Building2", locations: ["workspace", "explorer"], Component: OfficePanel });
  client.addScreen({ id: ALL_OFFICES_SCREEN_ID, title: "Agent Office", Component: AllOfficesScreen });
  client.addSidebarHeaderItem({ id: ALL_OFFICES_SCREEN_ID, title: "Agent Office", Component: OfficeSidebarItem });
  return () => {};
}
