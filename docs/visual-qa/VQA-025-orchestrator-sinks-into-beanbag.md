# VQA-025 orchestrator가 리드 책상 옆으로 나온 직후 자기 빈백 뒤에 파묻힘

- 심각도: 낮음
- 추정 담당: scene (manager 경로와 빈백 그리기 순서)
- 상태: closed

## 증상
VQA-003 수정으로 orchestrator는 책상 뒤를 지나 오른쪽 측면으로 나온다. 그런데 나오는 지점이 남색 빈백 바로 뒤쪽이라, 약 0.33초(4프레임) 동안 빈백이 인물 앞에 그려진다. 다리와 하반신이 빈백 속에 묻혀 상체만 빈백 위로 튀어나온 것처럼 보인다. 이후 빈백 앞으로 내려와 다시 위로 올라가 앉는다. 복귀할 때도 같은 구간(away→working 332~664ms)을 거꾸로 지난다.

## 재현 조건
- N=6, 480px, `setTransition('working','away', 747~1079)`(83ms 간격)
- N=6, `setTransition('away','working', 332~664)`

## 스크린샷
- shots/recheck-3/v025-orchestrator-sinks-into-beanbag-664-1079.png
- shots/recheck-3/r3-003-orchestrator-departure.png
- shots/recheck-3/r3-003-orchestrator-return.png

## 왜 어색한가
빈백을 통과하거나 빈백 속을 걷는 것처럼 보인다. 앉을 빈백 뒤에서 앞으로 돌아 나와 다시 앉는 동선도 부자연스럽다.

## 기대 모습
측면 출구를 빈백과 겹치지 않는 위치(빈백 왼쪽 앞 바닥)로 두고, 빈백 앞쪽에서 바로 앉는다.

## 재확인 결과 (2026-11-07, 4차 재확인)

- N6 `setTransition('working','away', 664~1079)`, `setTransition('away','working', 332~664)`를 83ms 간격으로 확인했다. 측면으로 나온 orchestrator의 다리와 몸 전체가 빈백 앞에 보이고, 빈백 속에 묻히는 프레임이 없다. N4, N5, N6의 manager 출입 경로에서도 멤버 책상을 관통하는 프레임이 없다.
- 캡처: shots/recheck-4/r4-025-departure-664-1079.png, shots/recheck-4/r4-025-return-332-664.png, shots/recheck-4/r4-manager-n4-working-away.png, shots/recheck-4/r4-manager-n5-working-away.png, shots/recheck-4/r4-manager-n6-away-working.png
- 판정: 해결. closed
