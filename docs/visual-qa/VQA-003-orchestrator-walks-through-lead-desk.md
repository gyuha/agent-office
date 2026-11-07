# VQA-003 orchestrator가 리드 책상을 관통해 걸어 나가고 들어옴

- 심각도: 높음
- 추정 담당: scene (`navigation.ts` manager 경로: 측면 출구가 없음)
- 상태: closed
- qa 회귀 테스트 필요

## 증상
orchestrator가 away로 바뀌면 좌석 좌표(책상 뒤)에서 바로 걷기 포즈로 바뀐다. 그 다음 책상 앞판과 "Orchestrator" 명판 앞을 가로질러 오른쪽으로 걷는다. 걷기 스프라이트가 책상 앞에 그려져서 책상 위를 걷는 것처럼 보인다. 복귀할 때도 명판 위를 지나 좌석으로 들어가고, 도착 프레임에서는 의자 앞으로 머리만 튀어나온다.

## 재현 조건
- N=6(N3/N10/N16 동일), state=away, 480px: `setTime(0, 100, 200, 300)`. p-lead가 (774,613)→(1161,609), `moving=true`.
- 라이브 away→working 복귀: 프레임 2~4.

흐름은 다음과 같다.
```
working(리드 책상 착석) → away → 좌석 위치에서 걷기 포즈 → 책상 앞판을 가로질러 오른쪽 → 빈백
```

## 스크린샷
- shots/vqa003-n6-away-orchestrator-through-desk.png (0~500ms)
- shots/vqa003-vqa006-vqa007-return-frames0-5.png (프레임 2~4)

## 왜 어색한가
첫 프레임부터 책상 몸통과 다리가 겹친다. 멤버는 책상 옆으로 빠져나가는데(`exit = s.x-14`) orchestrator만 책상을 통과한다.

## 기대 모습
멤버처럼 책상 옆(왼쪽이나 오른쪽 끝)으로 먼저 나간 뒤 앞 바닥으로 내려온다. 이동 중에는 책상 뒤에 가려지거나, 책상 영역 밖에서만 보인다.

## 참고
`floorRoute`에서 `atHome&&!s.manager` 조건 때문에 manager는 측면 출구 없이 좌석에서 바로 출발한다.

## 재확인 결과 (2026-11-07, 1차 재확인)

- N6 working→away `setTransition` 0~2250ms, away→working 1000~2250ms를 확인했다. orchestrator가 리드 책상 앞판이나 명판 위를 지나가지 않는다. 오른쪽 화분 쪽으로 빠져나와 빈백으로 간다.
- 캡처: shots/recheck-1/r003-v016-n6-orchestrator-departure-0-2250.png
- 판정: 원래 증상(책상 관통)은 해결. closed. 대신 책상 뒤를 지나는 동안 약 1~1.25초 완전히 사라지는 문제가 새로 생겨 [VQA-016](VQA-016-actor-vanishes-behind-desk.md)으로 적었다.

## 재확인 결과 (2026-11-07, 2차 재확인)

- 회귀: 이번 수정에서 manager 경로가 바뀌면서 원래 증상이 다시 나타났다. N6 `setTransition('working','away', 0~667)`(83ms 간격)과 `setTransition('away','working', 750~1500)`을 확인했다.
  - orchestrator가 전환 첫 프레임(0ms)부터 의자에서 바로 선 걷기 포즈로 바뀌어 리드 책상 앞판 앞에 그려진다. 좌석 높이(y=650)를 따라 오른쪽으로 걸으며 "Orchestrator" 명판을 가린다. 복귀할 때도 같은 선으로 명판 위를 지나 좌석에 들어간다.
  - 발 위치가 책상 몸통 높이라 책상 위를 걷거나 책상을 통과하는 것처럼 보인다(1차 리포트와 같은 증상).
- 캡처: shots/recheck-2/r2-003-orchestrator-departure-0-667.png, shots/recheck-2/r2-003-orchestrator-return-750-1500.png
- 판정: reopen. 심각도 높음. 담당 scene. VQA-016(사라짐)은 다시 나타나면 안 되므로, 책상 뒤에서 상체만 보이며 옆으로 나온 뒤 앞 바닥으로 내려오는 방식이 필요하다. qa 회귀 테스트 필요(manager 경로가 리드 책상 front 사각형과 겹치지 않는지).

## 재확인 결과 (2026-11-07, 3차 재확인)

- N6 `setTransition('working','away', 0~1494)`, `setTransition('away','working', 0~1577)`을 83ms 간격으로 확인했다. orchestrator가 의자에서 일어나 책상 뒤(모니터 뒤쪽)를 지나 오른쪽 측면으로 나온다. 앞판과 명판은 모든 프레임에서 인물보다 앞에 그려지고, 책상 뒤에서도 상체가 보여 사라지는 프레임이 없다(VQA-016 재발 없음).
- 캡처: shots/recheck-3/r3-003-orchestrator-departure.png, shots/recheck-3/r3-003-orchestrator-return.png
- 판정: 해결. closed. 측면으로 나온 직후 자기 빈백 뒤에 파묻히는 프레임은 [VQA-025](VQA-025-orchestrator-sinks-into-beanbag.md)로 따로 적었다.
