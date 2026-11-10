import type { PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { useEffect, useRef } from "react";
import { Animated, Easing, Platform, Text } from "react-native";
import { attentionCount, sidebarTarget } from "./attention";
import { ALL_OFFICES_SCREEN_ID } from "./ids";
import { useOfficeSnapshot } from "./useOfficeSnapshot";

// 테마의 statusWarning은 밝은 테마에서 갈색이라 쓰지 않는다. Agent Observatory 배지와 같은 계열의 고정 주황 + 흰 글자.
const BADGE_COLOR = "#CB711C";

function AttentionBadge({ count }: { count: number }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== "web" }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      style={{
        minWidth: 22,
        height: 20,
        paddingHorizontal: 5,
        borderRadius: 10,
        backgroundColor: BADGE_COLOR,
        alignItems: "center",
        justifyContent: "center",
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }),
      }}
    >
      <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "800", lineHeight: 14 }}>{count}</Text>
    </Animated.View>
  );
}

export function OfficeSidebarItem({ currentScreen, openScreen }: PluginSidebarItemProps) {
  const count = attentionCount(useOfficeSnapshot());
  return (
    <SidebarRow
      icon="Building2"
      active={currentScreen?.screenId === ALL_OFFICES_SCREEN_ID}
      trailing={count > 0 ? <AttentionBadge count={count} /> : undefined}
      onPress={() => openScreen(sidebarTarget(count))}
    />
  );
}
