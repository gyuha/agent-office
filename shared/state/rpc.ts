import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";
import { SNAPSHOT_RPC_NAME } from "./constants.ts";
import type { OfficeSnapshot } from "./contract.ts";

/** projectId가 없으면 모든 프로젝트(scope all). 서버가 만든 값을 그대로 돌려주므로 출력은 런타임 검증 없이 타입만 지정한다. */
export const officeSnapshotRpc = defineRpc({
  name: SNAPSHOT_RPC_NAME,
  input: z.object({ projectId: z.string().optional() }),
  output: z.custom<OfficeSnapshot>(),
});
