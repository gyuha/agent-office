# VQA-039 전체 화면 폭이 약 440px 이하이면 카드가 378px로 줄어 N16 명판이 다시 잘림

- 심각도: 낮음
- 추정 담당: scene (scope all 1열 카드 폭: 바깥 여백 16px × 2)
- 상태: closed

## 증상
VQA-035에서 카드 최소 폭을 410px로 정했지만, 1열일 때는 바깥 여백 때문에 카드가 "화면 폭 − 32px"이 된다. 화면 폭 410px에서는 카드가 378px라 N16 방 명판이 "plugin#FD…", "review#A1…", "Orchestrat…"로 잘린다. 480px(카드 448px)에서는 모두 보인다. 워크스페이스 패널(scope project)은 여백 없이 410px 전체를 써서 문제가 없다.

## 재현 조건
- preview `#grid`(또는 `#filters`에 N16 오피스가 있을 때), 화면 폭 410px, DPR2, Delta(N16) 카드

## 스크린샷
- shots/recheck-12/v039-grid-410-n16-card-378px-plates.png
- shots/recheck-12/v039-grid-480-n16-card-448px-ok.png (비교)

## 왜 어색한가
VQA-023, 035와 같은 이름 잘림이다. 다만 사이드바 전체 화면이 410px까지 좁아지는 경우는 드물어 낮음으로 매겼다.

## 기대 모습
1열일 때 카드 폭이 410px 아래로 내려가지 않게 바깥 여백을 줄이거나, 명판이 카드 폭 378px에서도 전체 이름을 표시한다.

## 재확인 결과 (2026-11-08, 13차 재확인)

- `#grid` Delta(N16) 카드의 폭: 화면 410·420·442px에서 410px, 480px에서 448px. 1열 카드가 410px 아래로 내려가지 않는다.
- 410px 화면에서 N16 명판이 모두 끝까지 보인다("plugin#FDF9", "review#A1C2", "Orchestrator").
- 410px `#filters`: 바깥 여백이 0이 되어 첫 카드가 필터 바 바로 아래(50.59px)에 붙는다. 바의 아래 크림색 테두리와 카드의 금색 테두리로 경계가 구분되고, 워크스페이스 패널과 같은 모습이라 문제로 보지 않았다. 가로 스크롤 없음
- 캡처: shots/recheck-13/r13-039-grid-410-n16-card-410px-plates.png, shots/recheck-13/r13-039-filters-410-top.png
- 판정: 해결. closed
