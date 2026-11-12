# VQA-051 서브에이전트 임시 직원 등장·퇴장으로 방 높이가 바뀌면, 빈백에 있던 away 직원이 새 빈백으로 가지 않고 옛 자리에 선 채로 멈춤

- 심각도: 중간
- 추정 담당: scene (`client/scene/core/actors.ts`의 `step()`이 레이아웃이 바뀐 뒤 away 목표를 다시 잡지 않음)
- 사용자 결정 필요: 아니오(결함). 다만 고친 뒤 "옛 빈백에 남기"와 "새 빈백으로 걸어가기" 중 무엇으로 할지는 scene이 고르거나 사용자에게 물을 수 있다.
- 상태: closed (25차 재확인)
- 출처: 24차 점검, preview(헤드리스 Chromium, setTransition)

## 증상

정규 8명(index 1, 4, 7이 away) 방에 임시 직원 1명이 들어오거나 나가면 방 높이가 바뀌고 빈백 수가 3↔5개로 바뀐다. 이때 p-4(review#A1C2)는 다음처럼 된다.
- 퇴장(9→8책상): 배정 자리가 남색 빈백(sceneY 1130)으로 바뀐다. 하지만 actor는 사라진 노란 빈백 자리(y 1310, 방 바닥 끝)에 `moving:false`로 남는다. 화면에서는 방 아래 벽선 위에 걷는 자세로 선 채 멈춘다. 2초, 10초, 30초 뒤 모두 같다.
- 등장(8→9책상): 배정 자리가 노란 빈백(y 1310)으로 바뀐다. 하지만 actor는 남색 빈백 자리(y 1130)에 `moving:false`로 남는다. 화면에서는 빈 남색 빈백 앞에 선 자세로 멈춘다(30초 동안).
- 같은 스냅샷을 전환 없이 그리면 p-4는 남색 빈백에 정상적으로 앉는다(r24-stuck-reference-static-n8away-480.png). 전환으로만 생긴다.
- orchestrator가 짚은 "빈백 재배정이 보인다"는 이 형태로 보인다. 걸어서 옮기는 장면이 아니라, 앉지도 걷지도 않고 멈춘 채 남는다.

## 재현 조건

- preview, 480px, `fixtureFn('8','working')`에서 members index 1·4·7을 away로 두고, member 0의 임시 직원 1명을 넣고 뺀다
- `mounted.setTransition(initial, ms, …)`, ms = 2000, 10000, 30000
- 실제 앱은 확인하지 않았다(실제 앱 클릭 금지). 다만 preview 전환이 실제 렌더 루프와 같은 `step()`을 쓰므로 실제 앱에서도 생길 것으로 본다[중간].

## 기대 모습

방이 다시 배치된 뒤 away 직원이 배정된 빈백에 앉아 있거나, 0.x초 안에 걸어가 앉는다. 방 가장자리나 빈 빈백 앞에 선 채로 남지 않는다.

## 캡처 (`shots/recheck-24/`)

- r24-trans-n8away-remove.png, r24-trans-n8away-add.png(0~10000ms 프레임)
- r24-stuck-p4-remove-10000ms-480.png, r24-stuck-p4-add-10000ms-480.png
- r24-stuck-reference-static-n8away-480.png(전환 없이 그린 정상 모습)

## 재확인 결과 (2026-11-12, 25차, preview만)

- 수정: 레이아웃이나 빈백 배정이 바뀌면 away 직원이 먼저 자기 책상으로 돌아간 뒤 새 빈백으로 걸어가 앉는다. 빈백을 잃은 away 직원은 책상에서 phone 자세로 앉는다.
- 조건: `mounted.setTransitionSequence`로 N3, N6, N8(index 1·4·7 away) × 임시 직원 0↔1을 재생했다. 퇴장은 축소 지연이 끝나는 61초 뒤 70~80초까지, 등장은 10초까지 봤다. 시점마다 inspect로 away 직원의 위치와 배정 자리의 거리, 이동 여부를 기록했다.
- 결과:
  - 멈춤 없음: 모든 경우 away 직원이 배정 자리까지 걸어가 거리 0으로 앉았다. N8 퇴장은 0.7초 뒤 출발해 3초에, N8 등장은 3초에, N6 등장은 2~5초에, N6 축소(61초) 뒤는 65초에 도착했다. 24차처럼 30초 넘게 선 채 멈추는 직원은 없었다.
  - 경로: N6 축소 뒤 p-1의 걷는 경로를 0.4초 간격으로 다른 책상 사각형과 비교했다. 겹침이 없고 책상 줄 사이 통로로 간다. 등장 때 p-4는 의자에서 일어나 책상 왼쪽으로 빠져나간다. 원래 away 이동과 같은 동작이다.
  - 빈백을 잃은 직원: N6 medium 배치의 p-4는 빈 빈백이 있어도 책상에서 phone 자세로 앉는다. 전환 없이 그린 정지 화면에서도 휴게석이 같다(`rest:false`, r25-static-n6away-reference.png). 기존 휴게석 규칙이고 이번 수정과는 관계없다.
- 캡처: shots/recheck-25/r25-n8away-remove-480.png, r25-n8away-add-480.png, r25-n6away-add-480.png, r25-n6away-remove-480.png, r25-n6away-walk-after-hold.png, *.json(시점별 측정)
- 판정: 해결. closed
