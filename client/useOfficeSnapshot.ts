import { useRpc } from "@getpaseo/plugin/client";
import { useEffect, useState } from "react";
import { SNAPSHOT_POLL_MS } from "../shared/state/constants";
import type { OfficeSnapshot } from "../shared/state/contract";
import { officeSnapshotRpc } from "../shared/state/rpc";

/**
 * 서버 스냅샷을 구독한다. projectId가 있으면 그 프로젝트만(scope "project"), 없으면 모든 프로젝트(scope "all").
 * 첫 응답 전에는 null. 요청이 실패하면 직전 스냅샷을 유지한다.
 */
export function useOfficeSnapshot(projectId?: string): OfficeSnapshot | null {
  const fetchSnapshot = useRpc(officeSnapshotRpc);
  const [snapshot, setSnapshot] = useState<OfficeSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);
    const tick = () => {
      fetchSnapshot({ projectId }).then(
        (next) => {
          if (!cancelled) setSnapshot(next);
        },
        () => {},
      );
    };
    tick();
    const timer = setInterval(tick, SNAPSHOT_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [fetchSnapshot, projectId]);

  return snapshot;
}
