# VQA-016 자리를 떠나거나 돌아올 때 책상 뒤에서 캐릭터가 완전히 사라짐

- 심각도: 중간
- 추정 담당: scene (책상 뒤 경로 구간의 그리기 순서와 가림)
- 상태: closed
- qa 회귀 테스트 필요

## 증상
책상을 관통하지 않도록 경로를 책상 뒤(좌석 높이)로 바꾼 뒤, 그 구간에서 인물이 책상과 의자 그림에 완전히 가려진다. 의자는 비어 있는데 사람이 보이지 않는 시간이 생긴다.
- orchestrator 출발: working→away 0~1000ms(약 1.25초) 동안 의자가 비고 아무도 안 보인다. 1250ms에 화분 옆에서 갑자기 나타난다.
- orchestrator 복귀: away→working 1250~2000ms(약 1초) 동안 안 보이다가 2250ms에 의자에 바로 앉아 나타난다.
- 멤버 복귀: plugin#FDF9가 away→working 5500~5667ms(약 0.25초) 동안 책상 뒤에서 안 보이다가 5750ms에 착석한 채 나타난다.
- solo 출발: working→away 1000ms에 의자가 비고 머리카락 일부만 책상 왼쪽에 보인다.

흐름은 다음과 같다.
```
착석 → (책상 뒤 경로: 전신 가림, 0.25~1.25s) → 책상 옆에서 갑자기 등장 → 이동
```

## 재현 조건
- N=6, 480px, `setTransition('working','away', 0~1250)`, `setTransition('away','working', 1000~2250)`, `setTransition('away','working', 5500~5917)`
- solo, `setTransition('working','away', 1000)`

## 스크린샷
- shots/recheck-1/r003-v016-n6-orchestrator-departure-0-2250.png
- shots/recheck-1/v016-n6-orchestrator-return-0-2250.png
- shots/recheck-1/r006-v016-n6-plugin-desk-arrival.png
- shots/recheck-1/v016-v017-solo-working-away.png

## 왜 어색한가
사람이 순간이동한 것처럼 보인다. 특히 orchestrator는 1초 넘게 사라진다. 서 있는 사람의 키가 책상보다 크므로 책상 뒤를 걸어도 머리와 상체는 보여야 자연스럽다.

## 기대 모습
책상 뒤를 지날 때도 책상 윗면 위로 상체가 보인다(책상 앞판만 다리를 가림). 또는 의자에서 일어나 책상 옆으로 바로 빠져나와, 가려지는 시간이 1~2프레임을 넘지 않는다.

## 재확인 결과 (2026-11-07, 2차 재확인)

- 멤버: 출발할 때(N6 working→away 250~750) 책상 뒤에서도 머리와 상체가 보인다. 도착할 때(N6 away→working 4250~4333) 머리카락만 보이는 구간이 2프레임(약 170ms)으로 기준(1~2프레임) 안이다.
- orchestrator: 더 이상 사라지지 않는다. 대신 책상 앞판을 지나가는 문제가 다시 생겨 VQA-003을 reopen했다.
- 캡처: shots/recheck-2/r2-016-scene-desk-arrival-3833-4417.png, shots/recheck-2/r2-016-018-n6-departure-250-1500.png
- 판정: 해결. closed
