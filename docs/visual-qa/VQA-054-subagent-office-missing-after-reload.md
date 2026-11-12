# VQA-054 서브에이전트 실행 중 플러그인 reload 뒤, 오피스에 부모 에이전트와 임시 직원이 모두 빠져 대시보드(실행 중 2)와 어긋남

- 심각도: 높음 (forge 작업 #4의 핵심 판정 "대시보드 실행 중 수 = 오피스 임시 직원 수"가 실제 앱에서 깨짐)
- 추정 담당: plugin (`server/office.ts`의 초기화·복원 경로)
- 사용자 결정 필요: 아니오(결함)
- 상태: open
- 출처: 사용자 실제 앱 확인(2026-11-12), 스크린샷 shots/recheck-27/r27-user-dashboard-vs-office.png

## 증상

- 에이전트 대시보드: visual-qa#9E42 → vqa27-probe → vqa waiter A, vqa waiter B(둘 다 실행 중 표시)
- Agent Office(오른쪽 패널, agent-office / Greeting 워크스페이스): visual-qa#9E42 책상 하나만 일반 책상(solo)으로 있다. All 1 / Working 0 / Awaiting 0 / Idle 1. vqa27-probe도, 임시 직원 2명도 없다.
- 즉 오피스 임시 직원 0, 대시보드 실행 중 서브에이전트 2

## 시간 순서 (UTC, 2026-11-12)

| 시각 | 일 |
|---|---|
| 15:19:06 | `paseo run`으로 vqa27-probe 생성(parent = visual-qa, workspace wks_5ac75b8647ca2253) |
| 15:19:15 | probe가 Agent 도구로 waiter A·B를 백그라운드로 띄우고 자기 턴을 끝냄(probe는 이후 idle) |
| 15:19:16 | waiter 둘 실행 시작. 셸 프로세스 2개가 `until [ -f /tmp/vqa27-release ]` 대기(15:26:38에도 계속 실행 중, hand-back 0건) |
| 15:20:31 | agent-office 플러그인 reload(Stopping → Loading → ready). visual-qa가 한 것은 아님 |
| 15:21:58 | Orchestrator 아카이브 |
| 15:23 무렵 | 사용자 캡처: 위 증상 |

## 확인한 것 (읽기 전용, 앱 조작 없음)

1. 데몬 데이터는 정상이다: 데몬에 직접 `agents.list()`(플러그인과 같은 필터)를 보냈다. vqa27-probe가 `workspaceId: wks_5ac75b8647ca2253`, 라벨 `paseo.parent-agent-id = visual-qa`, status idle로 들어 있다.
2. 매핑 코드도 정상이다: 같은 목록과 probe 타임라인(tail 200)을 플러그인의 `createOfficeStore`, `identityFromListed`, `runningSubagentsFromTimeline`에 그대로 넣었다(저장소 밖 스크립트 /tmp/r27/replay.mjs). 결과는 `group: manager visual-qa#9E42, members [vqa27-probe:away], subagents [vqa waiter A, vqa waiter B]`로 기대한 화면이다.
3. 따라서 실행 중인 플러그인의 메모리 store만 probe와 서브에이전트를 모른다. 화면은 15:21:58 아카이브가 반영된 뒤라 RPC 자체는 계속 성공하고 있었다.

## 원인 추정 (plugin이 확인할 것)

- reload 뒤 store를 다시 채우는 것은 `ensureInitialized` → `loadAgents`(목록 + 타임라인 복원) 한 번뿐이고, 결과는 `initialization` 프라미스로 계속 재사용된다. 첫 호출이 hook 컨텍스트(`track`)에서 올 수 있는데, 그때의 `paseo` 객체가 목록을 일부만 주거나, 실패 뒤 다른 경로로 성공 처리되면 빠진 에이전트가 다시 채워지지 않는다[낮음, 코드 읽기 기반].
- probe는 서브에이전트를 백그라운드로 띄운 뒤 idle이라, reload 뒤 hook 이벤트가 오지 않는다. 그래서 목록 초기화에서 빠지면 다음 턴까지 오피스에 돌아오지 않는다. 서브에이전트도 이벤트가 reload 전에 이미 지나가 타임라인 복원으로만 잡을 수 있는데, 부모가 store에 없으니 복원 대상에서도 빠진다[높음, 코드 근거].
- 플러그인 로그(`paseo plugin logs agent-office`)에는 오류가 없다. `track`의 `.catch(() => {})` 등에서 오류가 삼켜질 수 있다.

## 재현 조건

1. 워크스페이스에 부모 에이전트(예: Haiku auto)를 만들고, Agent 도구로 서브에이전트 2개를 백그라운드로 띄우게 한다. 부모는 idle이 되고 서브에이전트는 계속 실행 중이어야 한다.
2. 서브에이전트가 실행 중일 때 `paseo plugin reload agent-office`를 실행한다.
3. Agent Office 패널과 에이전트 대시보드를 비교한다.

## 기대 모습

reload 뒤에도 오피스에 부모(vqa27-probe)가 있고, 그 옆에 임시 직원 2명(waiter A·B)이 보여 대시보드 실행 중 수와 같다.

## 캡처

- shots/recheck-27/r27-user-dashboard-vs-office.png(사용자 캡처)
