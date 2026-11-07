# VQA-031 large 방(N7~16)에 아래쪽 벽선이 없어 바닥이 화면 끝에서 잘린 것처럼 보임

- 심각도: 중간
- 추정 담당: art (`background-large` 아래쪽 벽/걸레받이), scene (`drawBackground`의 trim 영역)
- 상태: closed
- qa 회귀 테스트 필요

## 증상
small·medium 방은 바닥 끝에 진한 갈색 벽선(걸레받이)이 있어 방이 닫혀 보인다. large 방(N7~16)은 바닥 타일이 캔버스 끝까지 그대로 이어지다 잘린다.

orchestrator가 물은 `/tmp/scene-margin-contact.png`의 N16 문제는 캡처가 잘린 것이 아니다. 실제 캔버스에 벽이 없다.
- 근거 1: 캔버스 전체 높이(N16 480px 1148 device px = 574 CSS px)를 캡처했는데 마지막 행 아래가 바닥 타일로 끝난다.
- 근거 2: 런타임 에셋 `assets/office/runtime/background-large.webp`(785×785)의 아래 80px에 벽선이 없다. medium 에셋에는 벽선이 있다.
- 근거 3: `draw.ts`는 배경 맨 아래 trim 구간을 방 끝에 붙여 그리는데, large는 그 구간이 바닥이라 벽이 생기지 않는다.

이번 여백 변경 전 캡처(recheck-3 N16)에도 벽선이 없었다. 즉 새로 생긴 회귀가 아니라 원래 large 에셋에 벽이 없었던 것이다.

## 재현 조건
- N=7~16, 480px/410px, 모든 상태, `setTime(20000)`

## 스크린샷
- shots/recheck-8/v031-n16-480-bottom-no-wall.png
- shots/recheck-8/v031-v032-n10-480-bottom.png
- shots/recheck-8/v031-asset-background-large-bottom.png (에셋 아래 80px)
- shots/recheck-8/v031-asset-background-medium-bottom.png (비교: 벽선 있음)

## 왜 어색한가
방이 닫히지 않고 화면 밖으로 이어져 캡처가 잘린 것처럼 보인다. 인원이 많을 때만 방 모양이 달라진다.

## 기대 모습
large 방도 small·medium과 같은 아래쪽 벽선으로 끝난다. 방 높이가 바뀌어도 벽선은 항상 방 맨 아래에 붙는다.

## 재확인 결과 (2026-11-07, 9차 재확인)

- N=1, 3, 5, 6, 7, 8, 10, 13, 16 × 480px/410px 전체 캔버스를 캡처했다. 모든 방 크기에서 아래쪽 걸레받이(진한 갈색 벽선)가 방 맨 아래에 보인다. large 방(N7~16)도 small·medium과 같은 모양으로 닫힌다.
- 캡처: shots/recheck-9/r9-031-n16-480-bottom-wall.png, shots/recheck-9/r9-031-n7-410-bottom-wall.png, shots/recheck-9/r9-margin-sheet-480.png, shots/recheck-9/r9-margin-sheet-410.png
- 판정: 해결. closed
