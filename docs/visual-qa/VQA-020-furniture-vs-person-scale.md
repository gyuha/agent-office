# VQA-020 인물만 줄어 리드 가구와 빈백이 인물보다 지나치게 큼

- 심각도: 낮음
- 추정 담당: scene (리드 책상과 빈백 모듈 스케일), art (빈백 크기)
- 상태: closed

## 증상
VQA-012 수정으로 인물 축척은 통일됐다. 그런데 리드 책상, 의자, 키보드, 빈백은 크기가 그대로라 인물이 상대적으로 작아졌다.
- orchestrator의 머리가 리드 의자 등받이의 절반 정도다. 키보드가 상체보다 넓어서 큰 책상 앞의 아이처럼 보인다(N6, N10, N16 공통).
- 빈백 위 멤버가 빈백 높이의 1/3 정도라 빈백에 파묻힌 것처럼 보인다(N16 away).

## 재현 조건
- N=6 mixed `setTime(15000)`, N=10 410px `setTime(5000)`, N=16 away `setTime(45000)`

## 스크린샷
- shots/recheck-1/r011-v019-orchestrator-lead-desk.png
- shots/recheck-1/recheck-n10-410px.png
- shots/recheck-1/v020-n16-away-bag-vs-person.png

## 왜 어색한가
같은 방 안에서 가구와 인물의 비례가 멤버 책상(인물과 가구 비례가 맞음)과 다르다.

## 기대 모습
리드 책상 세트와 빈백의 크기를 멤버 pod와 같은 인물 대비 비례로 맞춘다.

## 재확인 결과 (2026-11-07, 2차 재확인)

- N3 mixed, N6 mixed, N10 410px, N16 away `setTime(15000)`을 확인했다. 리드 책상·의자·키보드와 빈백이 인물과 같은 비율로 줄었다. orchestrator가 큰 책상 앞의 아이처럼 보이지 않고, 빈백 위 인물도 빈백에 파묻히지 않는다.
- 다만 N10/N16에서 리드 명판만 줄지 않아 책상 밖으로 튀어나온다. 이 부분은 [VQA-021](VQA-021-lead-nameplate-overflow.md)로 따로 적었다.
- 캡처: shots/recheck-2/r2-020-n16-away-15000.png, shots/recheck-2/r2-020-n3-and-n10-410.png
- 판정: 해결. closed
