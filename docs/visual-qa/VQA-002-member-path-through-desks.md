# VQA-002 멤버 이동 경로가 다른 책상을 관통함 (앞판·명판 위를 걸어감)

- 심각도: 높음
- 추정 담당: scene (`core/navigation.ts` 장애물 영역과 그리기 순서)
- 상태: closed
- qa 회귀 테스트 필요

## 증상
1. away로 전환할 때 둘째, 셋째 열 멤버(scene#3C71, art#94A2)가 자기 좌석 높이(y≈913, 의자 바로 앞)를 따라 수평으로 이동한다. 이 선이 왼쪽 책상들의 몸통 높이와 같아서 캐릭터가 plugin/scene 책상 앞판과 명판 위를 그대로 지나간다(명판 글자가 가려짐).
2. visit 이동(VQA-001) 중 qa가 1행과 2행 사이 좁은 틈을 지나갈 때 위 책상의 명판을 머리로 가리고, 아래 책상의 모니터·의자가 다리를 자른다. 책상 속을 걷는 것처럼 보인다.

## 재현 조건
- N=6, state=away, 480px: `setTime(300~1100)` (p-1, p-2 경로 y=913). 이후 y=913에서 x 1042→342.
- N=6, state=working: `setTime(30750~31500)` (p-3 경로 y=1009, 행 사이).
- 라이브 복귀(away→working) 프레임 8~10에서도 art가 scene 책상 명판 위를 지나감.

## 스크린샷
- shots/vqa002-n6-away-row-walk-through-desks.png (300~900ms)
- shots/vqa002-n6-away-sheet-0-4000.png
- shots/vqa002-n6-visit-row-gap-overlap.png (30750/31000)
- shots/vqa015-walk-slide-12fps.png (1167~1417에서 plugin 책상 앞판 위를 걷는 모습)

## 왜 어색한가
발 위치가 책상 몸통 안쪽이라 사람이 책상을 통과하는 것처럼 보인다. 탑뷰 공간 규칙(책상은 막혀 있음)이 깨진다.

## 기대 모습
수평 이동은 책상 행 사이의 빈 바닥(명판 아래쪽)을 지나고, 다른 책상의 앞판·명판·모니터와 겹치지 않는다. 행 사이 간격이 200px 캐릭터가 지나가기에 부족하면 행 아래쪽 통로나 왼쪽 레인으로 우회해야 한다.

## 참고
장애물 사각형은 `frontOcclusionY-95` 아래 부분만 막는다. 그래서 의자와 모니터가 그려지는 책상 윗부분과 좌석 높이 수평선은 통행 가능 영역으로 남는다.

## 재확인 결과 (2026-11-07, 1차 재확인)

- N6 working→away와 away→working을 `setTransition`으로 250ms 간격, 도착 구간은 83ms(12fps) 간격으로 확인했다. 행 간격이 넓어져서 수평 이동은 행 사이 빈 바닥(y≈1090)으로 지나간다. 다른 책상의 앞판·명판·모니터와 겹치지 않는다.
- 캡처: shots/recheck-1/r002-n6-working-away-sheet.png, shots/recheck-1/r002-r015-n6-return-rowgap-12fps.png
- 판정: 해결. closed. 다만 출발 직후 아래로 내려갔다가 되돌아오는 우회 경로는 새로 생긴 문제라 [VQA-017](VQA-017-path-u-turn.md)로 따로 적었다.
