/**
 * Agent Office의 scene 계약. scene은 이 파일의 타입과 훅만 의존한다.
 *
 * scene이 지켜야 할 규칙
 * - 모든 값은 읽기 전용이고 불변이다. 받은 객체를 수정하지 않는다. 스냅샷은 매번 새로 만들어진다.
 * - 이 파일은 타입만 담는다(런타임 import 없음). Paseo 번들 규칙상 shared 모듈은 react/클라이언트 SDK를 import할 수 없다.
 *   클라이언트 훅 useOfficeSnapshot(workspaceId)은 `client/useOfficeSnapshot.ts`에 있다. scene은 보통 훅이 필요 없고
 *   props로 받은 snapshot만 쓴다.
 * - 이 계약은 "무슨 일이 일어나는가"만 담는다. 좌표, 스프라이트 이름, 애니메이션 정보는 없다.
 *   그 매핑은 scene이 state, kind, provider로부터 직접 정한다.
 * - 알 수 없는 필드와 알 수 없는 provider 문자열은 무시하거나 기본 표현으로 처리한다(필드가 추가될 수 있다).
 * - 스냅샷은 서버가 약 2초 간격(SNAPSHOT_POLL_MS)으로 갱신해 준다. 상태가 바뀐 시각은 stateSince(ms)로 알 수 있다.
 * - 1차 묶음은 프로젝트다. scope가 "all"이면 projects마다 섹션 헤더(projectName)를 그리고, "project"면 헤더 없이 그려도 된다.
 *   같은 프로젝트의 다른 워크스페이스 에이전트도 부모 트리가 같으면 한 오피스다. 닫히거나 아카이브된 에이전트는 들어 있지 않다.
 * - Office.members에는 manager가 들어 있지 않다. solo 오피스는 manager가 null이고 members에 에이전트 1명이 있다.
 *
 * scene 진입 방식(어댑터)
 * - scene은 `client/scene/index.tsx`에서 아래 시그니처로 OfficeView를 export한다.
 *     export function OfficeView(props: { snapshot: OfficeSnapshot }): JSX.Element
 * - plugin은 `client/`의 얇은 어댑터가 그 모듈을 동적으로 불러온다. 파일이 없으면 스냅샷을 텍스트로 보여 주는
 *   개발용 폴백을 쓴다. scene이 파일을 만들면 어댑터 수정 없이 연결된다.
 */
export type AgentState = "working" | "away" | "phone" | "sleeping";

export type AgentProvider = "claude" | "codex" | "antigravity" | (string & {});

export interface AgentView {
  readonly id: string;
  readonly name: string;
  readonly provider: AgentProvider;
  readonly state: AgentState;
  /** 현재 state가 시작된 시각(epoch ms). sleeping은 잠들기 시작한 시각이다. */
  readonly stateSince: number;
  /** 권한 승인을 기다리는 요청이 하나 이상 있다. state는 working으로 유지된다. */
  readonly needsAttention: boolean;
}

export interface Office {
  /** 그룹은 manager의 에이전트 id, solo는 그 에이전트의 id. */
  readonly id: string;
  readonly kind: "group" | "solo";
  /** group의 관리자(루트 에이전트). solo는 null. */
  readonly manager: AgentView | null;
  /** manager를 제외한 구성원. 생성 순서. */
  readonly members: readonly AgentView[];
}

/** 한 프로젝트의 오피스들. 프로젝트의 여러 워크스페이스에 걸친 에이전트도 부모 트리별로 묶여 여기에 들어온다. */
export interface ProjectOffices {
  readonly projectId: string;
  readonly projectName: string;
  readonly offices: readonly Office[];
}

export interface OfficeSnapshot {
  /** "project"는 한 프로젝트(projects 길이 1), "all"은 에이전트가 있는 모든 프로젝트(이름순). */
  readonly scope: "project" | "all";
  readonly projects: readonly ProjectOffices[];
  /** 서버가 이 스냅샷을 만든 시각(epoch ms). */
  readonly generatedAt: number;
  /** scope가 "project"일 때 패널이 열린 워크스페이스 제목. "all"이거나 알 수 없으면 null. */
  readonly workspaceName?: string | null;
}
