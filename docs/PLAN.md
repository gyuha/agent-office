# Agent Office — Paseo plugin 구현 계획 (orchestrator)

비주얼 기준: assets/mockups/v6/02-clay3d (2026-11-06 사용자 선택). 픽셀아트(v4)는 폐기했다. 클레이/소프트 3D 일러스트, SVG 리그 캐릭터, 섬 배치, 원근 바닥.

## 플랫폼 사실 (Paseo 0.15.2, @getpaseo/plugin 0.15.2에서 확인)
- 저장소 루트 = 플러그인 패키지. `paseo plugin init`의 구조를 따른다: `paseo-plugin.json`, `index.server.ts`, `index.client.tsx`, `OVERVIEW.md`, `package.json`(files 목록), `tsconfig.json`.
- 서버: `export default function contribute(server: PluginServerContext)`. `server.on("agent.turn_started" | "agent.turn_ended" | "agent.created" | "agent.closed" | "agent.archived" | "agent.permission_requested" | "agent.permission_resolved" | "workspace.created" | "workspace.archived", ...)`. `server.handle(rpc, fn)`로 RPC를 노출한다. `context.paseo`(PaseoApi)로 에이전트 목록을 조회한다.
- 에이전트 정보: id, provider, title, labels, parentAgentId.
- 클라이언트: React Native 19 / RN 0.81. DOM 라이브러리 없이 typecheck한다. `client.addScreen`, `client.addWorkspacePanel`, `client.addSidebarHeaderItem`로 화면을 붙인다. 웹(Platform.OS === "web")에서만 DOM과 canvas를 쓸 수 있다.

## 폴더 소유 (2026-11-06 변경: Paseo 번들 규칙상 모듈은 루트 client/, server/, shared/ 아래에만 둘 수 있고, shared/는 react나 클라이언트 SDK를 import할 수 없다)
- plugin: 루트 진입/설정 파일, `server/`, `shared/state/`(상태 기계, 계약 타입, rpc 정의), `client/`(패널, 어댑터, 훅. 단 `client/scene/`은 제외)
- scene: `client/scene/`(렌더러). 진입점은 `client/scene/index.tsx`의 `OfficeView`
- art: `assets/`(sprites/ 배포용 시트, vendor/ 원본, CREDITS)
- qa: `tests/`
- 계약: `shared/state/contract.ts`(타입만). 훅 `useOfficeSnapshot`은 `client/`에 있고, scene은 props로 받은 snapshot만 쓴다.
- 그룹 규칙: parentAgentId로 확정했다(실데이터로 확인). 시작 시에는 labels["paseo.parent-agent-id"], 이후에는 훅 payload를 쓴다.
- 갱신: 서버 푸시가 없으므로 클라이언트가 office.snapshot RPC를 2초마다 폴링한다.

## 상태 모델 (계약 초안. 확정은 plugin이 src/state/contract.ts로 한다)
- 에이전트 상태: working | away | phone | sleeping
  - turn_started → working
  - turn_ended → idle 계열. away 또는 phone을 에이전트 id 시드로 결정적으로 고른다.
  - idle이 SLEEP_AFTER_MS(기본 10분) 넘게 이어지면 sleeping
  - permission_requested: working을 유지하고 needsAttention 플래그를 세운다.
- 오피스(그룹): 루트 에이전트(관리자) + parentAgentId로 이어진 하위 에이전트. 하위가 없는 단독 에이전트는 Solo 오피스가 된다. 워크스페이스 단위로 오피스 목록을 만든다.
  - 그룹 규칙 미확정: Paseo 팀 에이전트(paseo run으로 띄운 역할)에 parentAgentId가 실제로 들어 있는지 확인되지 않았다. plugin이 실데이터로 확인해서 보고한다.

## 화면 범위 (2026-11-06 사용자 요구)
- 1차 묶음은 프로젝트다. 프로젝트 → 오피스(group/solo) → 에이전트 순서다.
- 워크스페이스 패널: 현재 프로젝트의 오피스만 보여 준다.
- 사이드바 메뉴 "Agent Office" 화면: 전체 프로젝트를 섹션으로 나눠 보여 준다.
- 계약: OfficeSnapshot { scope: "project" | "all"; projects: ProjectOffices[] }

## 단계
1. (병렬) plugin: 스캐폴드, 상태 기계, store, 계약 타입 / art: 배포용 sprite sheet와 규격 문서
2. scene: 계약과 시트로 OfficeView 구현. qa: 상태 기계 unit test (병렬)
3. qa: Playwright 시각 회귀

## 클레이 전환 (2026-11-06)
- art: assets/clay/에 SVG 파츠 자산과 manifest.json, README(리그, 기준점, 레이어, 애니메이션 곡선)를 만든다. assets/sprites(픽셀)는 전환이 끝나면 지운다.
- scene: 렌더링 파이프라인을 SVG 파츠 + canvas 변환 합성으로 바꾸고, 레이아웃을 클레이 시안의 구도로 바꾼다. core의 결정성(시간과 난수 주입)을 유지한다.
- qa: 시각 기준 이미지를 다시 만들고, 레이아웃 기하 테스트를 새 구도에 맞춘다.
