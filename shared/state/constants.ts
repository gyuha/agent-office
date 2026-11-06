/** 오피스 상태 기계와 서버/클라이언트가 공유하는 상수. 숫자와 키는 여기에서만 정의한다. */

/** idle(away/phone)이 이 시간을 넘기면 sleeping으로 본다. */
export const SLEEP_AFTER_MS = 10 * 60 * 1000;

/** 클라이언트가 서버 스냅샷을 다시 가져오는 주기. 서버가 푸시를 지원하지 않아 폴링한다. */
export const SNAPSHOT_POLL_MS = 2000;

/** turn이 끝난 뒤 고르는 대기 자세. 에이전트 id 해시로 결정한다. */
export const IDLE_POSES = ["away", "phone"] as const;

/** 데몬이 팀 에이전트의 부모 id를 복제해 두는 라벨. `agents.list()`에는 parentAgentId가 없어 이 값을 쓴다. */
export const PARENT_AGENT_LABEL = "paseo.parent-agent-id";

/** RPC 이름. */
export const SNAPSHOT_RPC_NAME = "office.snapshot";

/** 제목이 없는 에이전트에 쓰는 이름의 id 접두 길이. */
export const FALLBACK_NAME_ID_LENGTH = 7;

/** 워크스페이스→프로젝트 매핑을 데몬에서 다시 가져오는 최소 간격. 매핑에 없는 워크스페이스가 보이면 짧은 간격을 쓴다. */
export const WORKSPACE_REFRESH_MS = 10_000;
export const WORKSPACE_REFRESH_UNMAPPED_MS = 2000;
