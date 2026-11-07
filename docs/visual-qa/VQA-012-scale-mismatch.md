# VQA-012 인원수에 따라 캐릭터 크기가 서로 맞지 않음 (orchestrator, 빈백, 걷기)

- 심각도: 중간
- 추정 담당: scene (모듈 스케일, 걷기 높이 상수)
- 상태: closed

## 증상
- N10/N16에서는 pod 스케일이 258/size로 줄어드는데 리드 책상과 orchestrator는 그대로다. orchestrator 머리 폭이 멤버의 약 2배 이상이라 같은 방에 다른 축척의 인물이 섞여 보인다.
- 빈백 위 멤버(actorHeight 256, 스케일 1)가 같은 화면의 책상 멤버보다 눈에 띄게 크다(N16 away).
- 걷기 높이는 200(멤버) 또는 230(manager)으로 고정이다. 그래서 N10/N16에서 자리에서 일어나면 캐릭터가 갑자기 커진다.

## 재현 조건
- N=16 away `setTime(6000)`, 480px
- N=16 working `setTime(14200)`

## 스크린샷
- shots/vqa012-n16-away-scale.png
- shots/vqa012-n16-orchestrator-scale.png

## 왜 어색한가
같은 방에서 원근 없이 크기만 다르면 거인과 아이처럼 보인다. 일어날 때 크기가 바뀌는 것은 프레임 튐으로 느껴진다.

## 기대 모습
한 방 안의 모든 인물(착석, 빈백, 걷기, orchestrator)은 같은 축척을 공유한다. pod를 줄이면 orchestrator, 빈백 인물, 걷기 인물도 같은 비율로 줄인다.

## 재확인 결과 (2026-11-07, 1차 재확인)

- N16 away `setTime(45000)`, N16 mixed `setTime(15000)`, N10 410px를 확인했다. orchestrator, 빈백 위 멤버, 걷는 인물이 착석 멤버와 같은 축척이다. 일어날 때 크기가 바뀌지 않는다.
- 캡처: shots/recheck-1/r012-n16-mixed-15000.png, shots/recheck-1/r012-n16-away-45000.png
- 판정: 해결. closed. 인물만 줄어 가구(리드 책상·의자·키보드, 빈백)가 상대적으로 너무 커진 문제는 [VQA-020](VQA-020-furniture-vs-person-scale.md)로 적었다.
