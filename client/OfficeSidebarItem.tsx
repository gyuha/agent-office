import type { PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { ALL_OFFICES_SCREEN_ID } from "./ids";

export function OfficeSidebarItem({ currentScreen, openScreen }: PluginSidebarItemProps) {
  return (
    <SidebarRow
      icon="Building2"
      active={currentScreen?.screenId === ALL_OFFICES_SCREEN_ID}
      onPress={() => openScreen({ screenId: ALL_OFFICES_SCREEN_ID })}
    />
  );
}
