# VQA-008 여러 멤버가 같은 왼쪽 레인(x=312)을 동시에 지나가며 서로 겹침

- 심각도: 중간
- 추정 담당: scene (`navigation.ts` 단일 레인, 출발 시간 분산 없음)
- 상태: closed

## 증상
여러 명이 동시에 away로 바뀌거나 동시에 복귀하면 모두 같은 x=312 레인을 지난다. 2~3명이 한 좌표에 포개져 한 덩어리처럼 보인다(얼굴 위에 얼굴). 복귀 때는 3명이 레인에서 겹친 채 같은 방향으로 이동한다.

## 재현 조건
- N=6 라이브: away 5초 → working, 전환 후 프레임 1~3(약 120~400ms)
- N=6 away `setTime(1000~1500)`: scene/art가 plugin 책상 왼쪽 레인 진입 직전에 겹침

## 스크린샷
- shots/vqa008-return-frame1-lane-overlap.png
- shots/vqa008-return-frame2-lane-overlap.png
- shots/vqa008-return-frame3-lane-overlap.png
- shots/vqa008-return-live-sheet.png

## 왜 어색한가
사람끼리 통과해 걷는 것으로 보인다. 누가 누구인지 구분하기 어렵다.

## 기대 모습
출발 시각을 사람마다 조금씩 엇갈리게 하거나, 레인 안에서 앞사람과 최소 간격을 유지한다.

## 재확인 결과 (2026-11-07, 1차 재확인)

- N6/N16 양방향 `setTransition` 추적에서 동시에 움직이는 멤버가 항상 1명 이하였다. 왼쪽 레인에서 서로 겹치는 프레임이 없다.
- 캡처: shots/recheck-1/r007-r008-v017-n6-return-left-lounge.png
- 판정: 해결. closed. 다만 대기열 때문에 상태 반영이 크게 늦어지는 부작용이 생겨 [VQA-018](VQA-018-movement-queue-delay.md)로 적었다.
