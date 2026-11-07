# VQA-017 빈백으로 갈 때와 돌아올 때 아래로 내려갔다가 되돌아오는 U턴 경로

- 심각도: 중간
- 추정 담당: scene (`navigation.ts` 레인 진입점과 격자 경로)
- 상태: closed
- qa 회귀 테스트 필요

## 증상
첫 열 멤버(plugin#FDF9, solo)가 빈백으로 갈 때 위쪽 빈백으로 바로 가지 않는다. 먼저 아래로 200 logical px쯤 내려갔다가 거의 같은 x에서 다시 올라온다. 복귀할 때도 같은 U턴을 반대로 한다.
- N6 working→away: (322,881)→(322,1047)→(312,1087)→(312,865)→빈백(138,829). 2750~5000ms
- N6 away→working: (312,855)→(312,1076)→(322,1058)→(322,891)→좌석. 3000~5250ms
- solo working→away: 1500~3000ms에 책상 아래로 내려갔다 다시 올라옴
- N3 working→away: y=1250까지 내려갔다 839로 올라옴

## 재현 조건
- N=6, 480px, `setTransition('working','away', 2500~5250)`, `setTransition('away','working', 3000~5250)`
- solo, `setTransition('working','away', 1000~5000)`

## 스크린샷
- shots/recheck-1/v017-n6-plugin-uturn-2500-5250.png
- shots/recheck-1/r007-r008-v017-n6-return-left-lounge.png (3000~4500)
- shots/recheck-1/v016-v017-solo-working-away.png

## 왜 어색한가
목적지와 반대 방향으로 걸었다가 같은 길로 되돌아온다. 길을 잃은 것처럼 보인다. 이동 시간도 1~2초 늘어난다.

## 기대 모습
가장 가까운 레인 진입점으로 곧장 가서 목적지 방향으로만 이동한다. 같은 선을 왕복하지 않는다.

## 재확인 결과 (2026-11-07, 2차 재확인)

- solo, N6 working→away와 away→working을 100ms 간격으로 추적했다. 같은 x에서 내려갔다 올라오는 U턴이 없다. away→working의 scene#3C71은 행 사이 통로(y≈1088)로 약 95 logical px 내려간 뒤 오른쪽으로 걸어 자리로 올라가는데, 수평 이동이 사이에 있어 되돌아가는 것처럼 보이지 않는다.
- 캡처: shots/recheck-2/r2-017-018-n6-working-away-sheet.png, shots/recheck-2/r2-017-018-n6-return-300-1000.png
- 판정: 해결. closed
