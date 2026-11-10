# VQA-045 사이드바 질문 대기 배지와 클릭 흐름 점검 (forge 작업 #3 S3)

- 심각도: 중간 (19차 기준, VQA-046 포함)
- 추정 담당: scene (client 사이드바 배지, 화면 열기)
- 상태: closed (20차 재확인. 19차에는 open)
- 출처: forge task 3 `sidebar-awaiting-badge` S3, C4

## 대상

- 기능: 사이드바 'Agent Office' 행 오른쪽에 needsAttention(도구 승인 또는 질문 대기) 에이전트 수를 statusWarning 배지로 깜빡이며 보여 준다. 배지가 있을 때 행을 누르면 All Offices가 Awaiting 필터로 열리고, 없으면 All로 열린다. 손 든 캐릭터를 누르면 그 에이전트가 열린다.
- 코드: `client/OfficeSidebarItem.tsx`, `client/attention.ts`, `client/OfficePanel.tsx`, `client/scene/mount-scene.ts`, `client/scene/index.tsx`

## 방법 (실제 Paseo 데스크톱 앱)

- `paseo plugin reload agent-office` 뒤 Paseo 데스크톱 창(밝은 테마)을 agent-desktop 스크린샷(DPR2)으로 봤다.
- 대기 상황: 이 워크스페이스(agent-office)에 Haiku 5.5 테스트 에이전트를 Always Ask 모드로 6개 만들었다(vqa19-probe-A~F). A·B는 /tmp 파일 쓰기 권한 요청, D·E·F는 AskUserQuestion 질문으로 대기를 만들었다. 확인 뒤 6개 모두 아카이브했고 /tmp 파일도 지웠다. 다른 프로젝트 에이전트에는 손대지 않았다.
- 클릭: 사이드바 행은 접근성 press(헤드리스)로 눌렀다. 캐릭터는 canvas 안에 그려져 접근성 요소가 없어서, 실제 마우스 클릭(`--headed`)을 한 번 썼다.
- 점검 중 사용자도 앱을 직접 쓰고 있었다. probe-A·B 권한 요청은 사용자가 수락했고, probe-D 질문에는 사용자가 "A"로 답했으며, 필터 바의 Working도 사용자가 눌렀다. 그래서 그 뒤로는 화면을 바꾸는 클릭을 멈추고 캡처만 했다.

## 확인 결과

| # | 항목 | 결과 | 근거 |
|---|---|---|---|
| 1 | 배지 위치: 'Agent Office' 행 오른쪽 | 통과 | Observatory 배지와 같은 오른쪽 끝 세로줄에 있다. 행 높이가 바뀌지 않고, 글자와 겹치거나 잘리지 않는다. 행이 선택돼 회색 배경일 때도 잘리지 않는다 |
| 2 | 숫자가 대기 에이전트 수와 같음 | 통과 | 권한 대기 2건이면 "2", 질문 대기 1건이면 "1"이다. 대기가 0이면 배지가 없다 |
| 3 | 색·크기·깜빡임이 Observatory 배지 옆에서 자연스러움 | **실패 → VQA-046** | 주황이 아니라 짙은 갈색과 회갈색 사이로 깜빡이고, Observatory 배지보다 작으며 크기도 함께 커졌다 작아졌다 한다 |
| 4a | 배지 있을 때 행 클릭 → Awaiting 눌린 상태, 대기 오피스만 | 통과 | 2회 확인했다. 처음 열 때(배지 2)와, All로 열려 있던 화면에서 누를 때(배지 1) 모두 'Awaiting 1'이 눌리고 agent-office 오피스만 보인다 |
| 4b | 손 든 캐릭터 클릭 → 그 에이전트 화면 | 통과 [중간] | probe-A 몸통을 클릭했다. 마지막 화면은 agent-office 워크스페이스의 vqa19-probe-A 탭(권한 요청 카드)이었고, probe-A에 `paseo.open-agent-tab` 라벨이 생겼다. 다만 클릭 3초 뒤 캡처에는 관련 없는 paseo-agent-team / Team planner 화면이 잠깐 있었다. 사용자가 같은 시각 앱을 조작하고 있어서, 그 화면이 클릭 때문인지는 가리지 못했다 |
| 4c | 배지 없을 때 행 클릭 → All | 통과 | 대기 0일 때 누르면 'All 14'가 눌리고 'Awaiting 0'이며 모든 오피스가 보인다 |
| 5 | 대기가 풀리면 약 2초 안에 배지가 사라짐 | 통과 | probe-F 질문을 `paseo permit deny`로 거절하면서 약 0.35초 간격으로 캡처했다. 거절 명령이 끝나고 0.31초 뒤에는 배지가 있고, 0.64초 뒤 프레임부터 없다(거절 시작 기준 1.05초 이내). 다시 나타나지 않았다(13초 관찰) |

## 관찰 (문제로 보지 않음)

- 배지는 에이전트 수를 세고, 필터 바는 오피스 수를 센다. 그래서 배지가 "2"인데 열린 화면에는 'Awaiting 1'이 보인다(한 오피스에 대기 2명). 설계대로라 문제로 보지 않았지만, 사용자가 두 숫자를 비교하면 어긋나 보일 수 있다[중간, 시각 판단].
- Observatory 배지 숫자는 우리 배지와 자주 달랐다(우리 2일 때 3, 우리 1일 때 없음 또는 2). Observatory는 다른 기준(완료, 오류 등 포함)으로 세는 것으로 보이며, 이번 점검 범위가 아니다[낮음].
- 첫 권한 수락 뒤 만든 probe-C는 /tmp 쓰기를 묻지 않고 바로 썼다. 사용자가 수락하면서 /tmp 쓰기를 허용한 것으로 보인다[중간]. 그래서 이후 대기는 질문 도구로 만들었다.

## 미확인

- 화면이 이미 열려 있을 때 다시 누르는 경우: 배지가 있을 때 행을 눌러 Awaiting으로 연 다음, 사용자가 필터 바에서 All이나 Working으로 바꾸고, 배지가 남은 상태로 행을 다시 누르는 경우다. `client/scene/index.tsx`는 전달받은 `filter` 값이 바뀔 때만 `setFilter`를 부른다. 그래서 같은 `{filter:"awaiting"}`가 다시 오면 Paseo가 화면을 새로 마운트하지 않는 한 사용자가 고른 필터가 그대로 남을 수 있다[중간, 코드 읽기 기반]. 사용자가 앱을 쓰고 있어 클릭으로 확인하지 못했다. 다음 회차에서 실제 앱으로 확인해야 한다.
- 어두운 테마: 확인하지 않았다(앱이 밝은 테마였고, 설정을 바꾸지 않았다).

## 캡처 (`shots/recheck-19/`)

전체 창 캡처(r19-click-with-badge, r19-question-click-row, r19-no-badge-click-all, r19-character-click-*)는 다른 프로젝트 이름과 프롬프트가 보여 공개 저장소에 올리지 않았다(로컬 전용).

- r19-badge-2-sidebar-zoom.png: 권한 대기 2건, 배지 "2"
- r19-046-badge-pulse-8frames.png, r19-046-badge-darkest-vs-lightest.png: 깜빡임 8프레임, Observatory 주황과 비교
- r19-click-with-badge.png: 배지 있을 때 행 클릭 → Awaiting 1, 손 든 probe-A·B
- r19-question-badge-1-sidebar.png, r19-question-click-row.png: 질문 대기 1건, 배지 "1" → Awaiting 1
- r19-no-badge-click-all.png: 배지 없을 때 → All 14
- r19-character-click-plus3s-other-workspace.png: 캐릭터 클릭 3초 뒤(다른 워크스페이스 화면)
- r19-character-click-opened-probe-A.png: 그 뒤 probe-A 에이전트 탭
- r19-release-badge-gone-timing.png: 거절 뒤 +0.31초(배지 있음) / +0.64초(사라짐)

## 닫는 조건

VQA-046이 실제 앱에서 해결되고, 위 '다시 누르는 경우'를 실제 앱에서 확인한다(남은 필터가 그대로면 별도 리포트로 연다).

## 재확인 결과 (2026-11-10, 20차)

- 3번 색·크기·깜빡임: VQA-046이 해결돼 통과로 바꿨다. 실제 앱에서 Observatory 배지와 크기·위치가 같고, 같은 주황 계열이다.
- 4b 캐릭터 클릭: 다시 확인했다. 사용자가 probe 질문에 바로 답해 손 든 상태가 30초 안에 풀려서, 대기가 끝난 vqa20-probe-B 캐릭터를 All 화면에서 눌렀다. 손 든 캐릭터와 클릭 경로가 같다(`agentAtPoint` → `onSelect` → `navigation.openAgent`). 클릭 직후부터 약 0.5초 간격으로 16프레임(+0.08~+8.08초)을 캡처했다. 첫 프레임부터 agent-office 워크스페이스의 vqa20-probe-B 탭이 활성이고, 8초 동안 다른 워크스페이스 화면이 끼지 않았다. 19차에 클릭 3초 뒤 보인 paseo-agent-team / Team planner 화면은 같은 시각의 사용자 조작 때문이었던 것으로 본다[중간]. 결함이 아니다.
  - 손 든 상태에서 누른 경우는 19차 probe-A 클릭 결과(그 에이전트 탭이 열림)로 확인했다.
- 범위 밖, 후속 작업: '배지가 남은 상태에서 같은 params로 다시 누르는 경우'(위 미확인 첫 항목)는 orchestrator 결정에 따라 이번 작업 범위 밖이다. 후속 작업으로 기록하고 closed 판단에서 뺐다.
- 어두운 테마: 배지 색이 테마와 무관한 고정값이라 테마 영향이 없다(코드 확인).
- 캡처: shots/recheck-20/r20-character-click-16frames.png(클릭 뒤 경과 시간 표시), shots/recheck-20/r20-character-click-f01-top.png, shots/recheck-20/r20-character-click-f01-full.png
- 판정: 이번 작업 범위의 확인 항목 1~5가 모두 실제 앱에서 통과했다. closed
