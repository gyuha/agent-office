# VQA-023 리드 명판의 이름이 "Or…"까지 잘려 읽을 수 없음

- 심각도: 낮음
- 추정 담당: scene (`core/nameplates.ts` 리드 명판 폭·글자 크기)
- 상태: closed

## 증상
VQA-021 수정으로 리드 명판에 모듈 배율이 적용되면서 명판 안쪽 폭이 "Orchestrator"보다 좁아졌다. 이름이 줄임표로 잘린다.
- N6 480px: "Orches…"
- N16 480px: "Orc…"
- N16 410px: "Or…"

멤버 명판("plugin#FDF9", "search#64CA" 등 11자)은 같은 화면에서 모두 끝까지 보인다.

## 재현 조건
- N=6 mixed 480px `setTime(15000)`, N=16 away 480px `setTime(15000)`, N=16 working+attention 410px `setTime(20000)`

## 스크린샷
- shots/recheck-3/v023-lead-plate-truncated-n6-n16-410.png

## 왜 어색한가
방에서 가장 중요한 인물의 이름표가 두세 글자만 남아 이름표 역할을 못 한다. 멤버 명판보다 짧게 잘려 위계도 거꾸로 보인다. 상단바 AGENT 칸에 이름이 있어 정보가 사라지지는 않는다.

## 기대 모습
리드 명판은 적어도 멤버 명판만큼의 글자 수를 표시한다. 명판 폭을 리드 책상 앞판 폭에 맞춰 넓히거나(앞판 안에서), 글자를 최소 크기까지 줄인 뒤에만 줄임표를 쓴다.

## 재확인 결과 (2026-11-07, 4차 재확인)

- N6 mixed 480px, N16 away 480px, N16 working+attention 410px를 확인했다. 세 경우 모두 "Orchestrator" 전체가 명판 안에 표시되고, 명판은 책상 앞판 안에 머문다.
- 캡처: shots/recheck-4/r4-023-lead-plate-full-name.png
- 판정: 해결. closed
