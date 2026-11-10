import type { PluginOpenScreenInput } from "@getpaseo/plugin/client";
import type { OfficeSnapshot } from "../shared/state/contract";
import { ALL_OFFICES_SCREEN_ID } from "./ids";

/** 승인·질문 등 사용자 응답을 기다리는(needsAttention) 에이전트 수. */
export function attentionCount(snapshot: OfficeSnapshot | null): number {
  if (!snapshot) return 0;
  return snapshot.projects
    .flatMap((project) => project.offices)
    .flatMap((office) => [office.manager, ...office.members])
    .filter((agent) => agent?.needsAttention).length;
}

/** 배지가 있으면 Awaiting 필터가 켜진 All Offices 화면, 없으면 필터 없이 연다. */
export function sidebarTarget(count: number): PluginOpenScreenInput {
  return count > 0 ? { screenId: ALL_OFFICES_SCREEN_ID, params: { filter: "awaiting" } } : { screenId: ALL_OFFICES_SCREEN_ID };
}
