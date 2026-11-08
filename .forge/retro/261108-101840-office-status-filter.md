# 2026-11-08 — 오피스 상태 필터(All · Working · Awaiting · Idle) 추가

## 계획과 실제
- 계획대로 된 것: 판정 함수(S1)를 TDD로 만들었다. qa가 API 계약을 담은 테스트를 먼저 쓰고 `ERR_MODULE_NOT_FOUND`로 실패하는 것을 확인한 뒤, scene이 구현해 25개를 통과시켰다. 시각 회귀 테스트(S3) 15개를 추가했다. DoD 5개 항목이 모두 기준값에서 목표값으로 바뀌었다.
- 달라진 것:
  - 필터 바 위치. 계획은 `client/OfficePanel.tsx`의 React Native `OfficeScope`에 두기로 했지만, Playwright 하네스가 `mountOfficeScene` 경로만 그려서 그대로 두면 DoD 4번을 확인할 수 없었다. 실행 직전 승인을 받아 `mount-scene.ts`의 DOM 층으로 옮겼다.
  - 바를 DOM 맨 앞에 넣자 기존 테스트의 `parent.children[0] === 컬렉션` 가정이 깨져 42건이 실패했다. 바를 컬렉션 뒤에 붙이고 CSS `order:-1`로 위에 보이게 해서 해결했다.
  - visual-qa가 새 문제 2건을 찾았다. 필터 결과에 새로 들어오는 카드가 약 85ms 동안 빈 카드로 보였고(VQA-038), 폭 410px에서 카드가 378px로 줄어 명판이 잘렸다(VQA-039). 둘 다 S4에서 고쳤다.
  - 실행 방식. forge 기본인 Dynamic Workflow 대신 Paseo 팀 역할 에이전트에게 맡겼다. scene은 팀 정의가 바뀌어 새 claude 에이전트로 실행했다.

## 배운 점
- 다음에 다르게 할 것:
  - 시각 테스트가 DoD에 들어가는 계획은 질문 단계(fg-ask)에서 "그 화면을 하네스가 그리는가"를 먼저 확인한다. 이 프로젝트의 하네스(`tests/visual/harness/mount.html`)는 `mountOfficeScene`만 실행하므로, React Native 쪽(`client/OfficePanel.tsx`) UI는 시각 테스트로 검증할 수 없다.
  - 새 카드나 캔버스를 마운트하는 변경은 "첫 프레임을 그리기 전에 화면에 보이는가"를 처음부터 점검한다. 스크롤(VQA-036)과 필터(VQA-038)에서 같은 종류의 빈 카드가 두 번 나왔다. 이제는 둘 다 회귀 테스트가 지킨다.
  - 렌더러 DOM 구조를 바꿀 때는 기존 테스트가 DOM 순서(`children[0]` 등)를 가정하는지 먼저 확인한다. 화면 순서는 CSS `order`로 바꾸고 DOM 순서는 유지하면 테스트가 덜 깨진다.
  - 카드 최소 폭 같은 규칙은 바깥 여백까지 포함한 실제 폭으로 확인한다(VQA-039).

## 문서 반영
- CONTEXT.md: 질문 단계에서 오피스, 질문 대기, 작업중, 쉬는 중, 노는 중 오피스를 정의함(봉인 단계 추가 반영 없음)
- ADR: 없음

## 후속 작업 후보
<!-- followup: fu-8e0bcc7fd613 | source: office-status-filter | task: 1 | date: 2026-11-08 | status: open | taken: - -->
- `tests/visual/harness/mount.html`을 `.gitignore`에 추가하고 git 추적을 해제한다(`git rm --cached`).
  근거: qa가 S3에서 빌드 산출물인 이 파일이 `git ls-files`에 들어 있고 수정된 상태라고 보고했다.
<!-- followup: fu-880141795920 | source: office-status-filter | task: 1 | date: 2026-11-08 | status: open | taken: - -->
- 시각 테스트 기준 이미지(42장, 약 20MB)의 저장소 크기 정책(Git LFS, 해상도 축소, 중복 캡처 정리)을 정한다.
  근거: S3와 S4 회귀 테스트 뒤 qa 보고 기준으로 기준 이미지가 42장, 20MB로 늘었다.
