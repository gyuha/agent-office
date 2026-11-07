# VQA-021 N10/N16에서 리드 명판이 책상보다 넓어 앞판 밖으로 튀어나옴

- 심각도: 중간
- 추정 담당: scene (`core/nameplates.ts` 리드 명판 크기, 최소 글자 크기 6.5 CSS px)
- 상태: closed
- qa 회귀 테스트 필요

## 증상
VQA-020 수정으로 large 배경(N10, N16)의 리드 책상이 멤버 책상 크기로 줄었다. 그런데 "Orchestrator" 명판의 폭과 글자 크기는 그대로다. 명판이 책상 앞판 전체를 덮고 좌우로 책상 밖까지 삐져나온다. 책상 다리도 명판에 가려 책상이 아니라 간판처럼 보인다. N3/N6과 멤버 명판은 책상 안에 들어간다.

## 재현 조건
- N=16, state=away, 480px, `setTime(15000)`
- N=10, state=mixed, 410px, `setTime(15000)`

## 스크린샷
- shots/recheck-2/v021-n16-lead-plate-overflow.png
- shots/recheck-2/v021-n10-410-lead-plate-overflow.png

## 왜 어색한가
명판이 가구보다 커서 붙어 있는 이름표가 아니라 떠 있는 라벨처럼 보인다. 같은 화면의 멤버 명판과 비례가 다르다.

## 기대 모습
리드 명판은 리드 책상 앞판 안에 들어간다(멤버 명판과 같은 여백). 글자가 최소 크기에 걸리면 줄임표로 줄이거나, 리드 책상의 축소 비율을 조금 낮춘다.

## 재확인 결과 (2026-11-07, 3차 재확인)

- N6 mixed, N16 away(480px), N16 attention(410px)을 확인했다. 리드 명판이 책상 앞판 안에 들어가고 다리도 보인다. 튀어나옴은 해결됐다.
- 대신 명판이 작아져 이름이 "Orches…"(N6), "Orc…"(N16 480px), "Or…"(N16 410px)로 잘린다. 이 부분은 [VQA-023](VQA-023-lead-plate-name-truncated.md)로 적었다.
- 캡처: shots/recheck-3/r3-021-n6-lead-plate.png, shots/recheck-3/v023-lead-plate-truncated-n6-n16-410.png
- 판정: 해결. closed
