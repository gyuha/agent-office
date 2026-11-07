# VQA-001 working 상태인데 자리를 떠 "방문" 걷기를 하고, 도착 지점에서 제자리걸음함

- 심각도: 높음
- 추정 담당: scene (`client/scene/core/actors.ts`의 visit 로직)
- 상태: closed
- qa 회귀 테스트 필요

## 증상
working 멤버가 일정 주기로 자리에서 일어나 orchestrator 책상 앞(x=900) 또는 오른쪽 통로(x=1190)까지 걸어갔다가 돌아온다. 그 사이 책상은 비고 타이핑 연출도 없다. 도착한 뒤 약 1.5초 동안 같은 좌표에서 걷기 애니메이션이 계속 재생된다(제자리걸음). solo 사무실에는 orchestrator가 없는데도 빈 방을 가로질러 오른쪽 벽까지 갔다 온다.

## 재현 조건
- N=6, state=working, 480px, DPR2. 액터 3(qa#0499).
- `setTime(30000)`에 출발, `32500`~`34000` 구간은 (900, 641)에 정지했지만 `moving=true`(제자리걸음), `36500`에 복귀.
- solo, state=working: `setTime(14000~19000)`. 14.25초에 자리를 떠 18.5초 이후 복귀한다.
- 주기: `elapsed ≥ 10s`부터 16초마다 4초 동안, `index === (2+cycle) % members`인 멤버가 걷는다. working 시간의 약 1/4은 자리를 비우는 셈이다(solo 기준).

흐름은 다음과 같다.
```
working(착석) → 10s 경과 → visit 목적지로 걷기 → 도착 후 제자리걸음(1.5s) → 자리로 복귀 → 크로스페이드
```

## 스크린샷
- shots/vqa001-n6-working-visit-30000-36750.png (전체 경로 22프레임)
- shots/vqa001-n6-visit-arrive-walk-in-place.png (32500/33000 도착 후에도 걷는 포즈)
- shots/vqa001-solo-working-visit-14000-19000.png

## 왜 어색한가
working은 "지금 일하는 중"이라는 의미다. 자리를 비우고 돌아다니면 사용자는 에이전트가 쉬거나 멈췄다고 읽는다. 목적지에 아무 상호작용도 없고 같은 자리에서 다리만 움직여 기계적으로 보인다. solo에는 갈 대상조차 없다.

## 기대 모습
working은 자리에서 타이핑만 한다. 이동은 실제 상태 전환(away 진입/복귀)에서만 일어난다. 걷기 애니메이션은 경로가 남아 있을 때만 재생한다(`route.length === 0`이면 정지 포즈).

## 참고 (코드 위치)
`actors.ts`: `a.moving = a.route.length>0 || dist>2 && destination==='visit'` 조건이 도착 후 제자리걸음을 만든다. N6 index 2, N16 index 2처럼 visit 목적지가 장애물 안이면 경로 계산이 조용히 실패해 아무 일도 없는 경우도 있어 동작이 일정하지 않다.

## 재확인 결과 (2026-11-07, 1차 재확인)

- 같은 조건으로 다시 확인했다: N6 working에서 `setTime` 0, 10000, 14500, 30000~36500, solo working에서 14000~18500. 모든 액터의 좌표가 좌석에 고정되어 있고 `moving=false`, `destination=seat`였다. visit 이동과 제자리걸음이 없다.
- 캡처: shots/recheck-1/r001-n6-working-33000.png, shots/recheck-1/r001-solo-working-17000.png
- 판정: 해결. closed
