# VQA-019 불꽃 오라가 거의 보이지 않고, orchestrator는 키보드 위에 주황 선이 그어짐

- 심각도: 중간
- 추정 담당: scene (불꽃 클리핑, 몸통 덧그리기), art (flame_aura 형태)
- 상태: closed

## 증상
VQA-011 수정 뒤 불꽃이 모니터 왼쪽, 책상 앞판 위로 잘리고 몸통이 다시 그려진다. 그 결과 보이는 것은 어깨 옆의 가는 주황 선뿐이다. 60초 이상 working(불꽃 켜짐)과 막 시작한 working(불꽃 꺼짐)의 차이가 480px DPR2 화면에서 액터당 약 300 device px(약 75 CSS px, 대부분 1px 두께 선)에 그친다. 일반 시청 거리에서는 구분할 수 없다. orchestrator는 주황 선이 키보드 위를 세로로 지나가 화면 잡티처럼 보인다.

## 재현 조건
- N=6, state=working, 480px DPR2, `setTime(61000)`, `setTime(61250)`
- 비교군: 같은 조건에서 `stateSince = generatedAt + 100000` (불꽃 꺼짐)
- 픽셀 차이: 61000ms 2,074px, 61250ms 2,157px (차이 임계 40, 전체 캔버스)

## 스크린샷
- shots/recheck-1/v019-flame-on-vs-off-61000.png (왼쪽: 켜짐, 오른쪽: 꺼짐)
- shots/recheck-1/v019-flame-61000-61625.png
- shots/recheck-1/r011-v019-orchestrator-lead-desk.png (키보드 위 주황 선)

## 왜 어색한가
"오래 집중 중" 표시가 사실상 사라졌다. 남은 가는 선은 효과가 아니라 렌더링 잡티로 보인다.

## 기대 모습
모니터와 명판을 덮지 않으면서도, 인물 뒤 의자 쪽(왼쪽, 위)으로 불꽃이 또렷하게 보인다. 480px에서 켜짐과 꺼짐을 한눈에 구분할 수 있어야 한다. 키보드나 손 위에는 그리지 않는다.

## 재확인 결과 (2026-11-07, 2차 재확인)

- N6 mixed `setTime(15000)`에서 plugin, orchestrator, review의 왼쪽 어깨 뒤에 굵은 주황 불꽃이 또렷하게 보인다. 모니터, 명판, 키보드, 손 위에는 그려지지 않는다. 480px 기본 표시에서 불꽃이 켜졌는지 바로 구분된다.
- 캡처: shots/recheck-2/r2-019-flame-plugin-orchestrator-review.png, shots/recheck-2/r2-n6-mixed-15000.png
- 판정: 해결. closed
