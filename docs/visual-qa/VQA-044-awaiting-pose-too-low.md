# VQA-044 질문 대기 자세가 책상 쪽으로 너무 내려가 의자와 어긋남 (사용자 피드백, 질문 대기 모션)

- 심각도: 중간
- 추정 담당: art (awaiting 시트 몸 위치), scene (재생성)
- 상태: closed (18차 재확인. 17차에 한 번 reopened)
- 출처: 사용자 피드백 "질문 대기 자세가 책상에서 너무 내려가 있다. 의자에 맞춰 올려 달라."
- qa 회귀 테스트 필요

## 증상(수정 전)
awaiting 3프레임에서 몸 전체가 working보다 아래로 내려가 있었다. 머리가 의자 등받이 위쪽보다 낮고, 어깨가 상판 가까이 붙어 책상 속으로 가라앉은 것처럼 보였다. plugin#FDF9와 orchestrator에서 특히 눈에 띄었다.
- 사용자 캡처: shots/recheck-17/v044-user-awaiting-too-low.png

## 재현 조건(수정 전)
- 착석 working + needsAttention, 480px, 3프레임

## 기대 모습
머리와 어깨 높이가 working(타이핑)과 같아서, 의자 등받이에 맞게 앉아 있고 손만 올라간다.

## 재확인 결과 (2026-11-09, 17차)

- art가 awaiting 시트를 올렸고 scene이 재생성했다. scene 측정으로는 working과 머리·어깨 높이 차이가 최대 0.9 CSS px다(shots/recheck-17/v044-scene-height-compare.png).
- 직접 확인: 멤버 6명 + orchestrator, N6과 N16, 480px와 410px. working 기준 프레임과 awaiting 3프레임(20000/20250/20500ms)을 같은 크기로 나란히 놓고 봤다.
  - 높이: 7명 모두 머리 정수리, 얼굴, 어깨선이 working과 같은 높이다. 의자 등받이가 머리 뒤에 같은 비율로 보이고, 책상 속으로 가라앉지 않는다.
  - 팔: 손 든 팔이 세 프레임 모두 상판·모니터에 가리거나 잘리지 않는다. orchestrator 3프레임(가장 높이 든 프레임 포함)도 프레임 가장자리에서 잘리지 않는다.
  - 말풍선(VQA-041, 043 규칙): 전원 대기와 scene#3C71 한 명만 대기 모두, 말풍선이 해당 머리 위에 붙고 orchestrator 명판과 겹치지 않는다(480/410px).
  - 프레임 튐: 세 프레임 사이 몸 위치가 고정이다.
- 실제 패널: 확인하지 않았다(탭 조작 금지, 이번 회차는 preview 기준).
- 캡처: shots/recheck-17/r17-044-n6-480-working-vs-awaiting-3frames.png(왼쪽 열이 working), shots/recheck-17/r17-044-n6-410-working-vs-awaiting-3frames.png, shots/recheck-17/r17-044-orchestrator-n6-n16-3frames.png, shots/recheck-17/r17-044-single-awaiting-bubble-480-410.png
- 판정: 해결. closed

## 다시 열림 (2026-11-09, 사용자 피드백)

- 사용자: "아직 엉덩이가 의자에 앉아 있는 느낌이 들지 않는다." 빨간 화살표는 Orchestrator를 가리킨다(shots/recheck-18/v044-user-awaiting-not-seated.png).
- 17차의 판정 기준("머리·어깨 높이를 working과 맞춤")이 사용자 기준을 충족하지 못했다. working 자세는 타이핑하느라 몸이 앞으로 숙어 상판 뒤로 낮게 보이는데, 같은 높이로 맞추니 손을 든 대기 자세는 의자에 걸터앉지 못하고 상판 뒤로 가라앉아 보였다. 판정 기준을 잘못 세운 visual-qa의 실수다.
- 상태를 reopened로 바꾸고 점검 기준을 고쳤다: "대기 자세는 의자 좌석에 앉아 머리가 등받이 위로, 가슴이 상판 위로 보임"

## 재확인 결과 (2026-11-09, 18차)

- art가 대기 자세를 working보다 27~38 logical px 높게 앉혔고, scene이 재생성했다. 진입과 해제 때 0.2초 동안 오르내린다. scene 측정 최저값은 머리가 등받이 위로 0.41 머리 높이, 가슴 노출 1.90이다.
- 직접 확인: 멤버 6명 + orchestrator × N=1, 3, 5, 6, 10, 16 × 480/410px × 3프레임(20000/20250/20500ms)
  - 앉은 모습: 7명 모두 머리가 등받이 위로 올라오고, 가슴과 배가 상판 위로 보인다. 등받이 앞 좌석에 똑바로 앉은 모습이다. working(앞으로 숙여 타이핑)과 비교하면 몸이 확실히 올라와 "의자에 앉아 손을 든" 모습으로 읽힌다.
  - 손 든 팔: 3프레임 모두 상판·모니터에 가리거나 잘리지 않는다.
  - orchestrator 손과 말풍선: 상단바(DOM 헤더)와 방 위쪽 벽 경계에 닿지 않는다. N5·N6에서는 말풍선이 화이트보드 아래 가장자리 바로 밑에 있고, N10·N16에서는 뒤쪽 수납장 위 벽에 있다. N3(small 방)에서는 말풍선 위쪽 절반이 화이트보드 아래 메모 위에 겹친다. 말풍선 테두리가 진하고 '?'가 또렷해 화이트보드 내용과 섞여 읽히지 않으므로, 문제로 보지 않았다[중간, 시각 판단]. 이 겹침은 대기 자세를 올리기 전(14차)에도 있었다.
  - 말풍선 규칙(VQA-041, 043): 명판 겹침이 없고, 주인 머리에 붙는다.
  - 진입: 첫 프레임에 손을 든 자세로 바뀐 뒤 약 0.2초 동안 몸과 말풍선이 함께 부드럽게 올라간다(0→50→100→150→200ms 단계적). 튀거나 순간이동하지 않는다.
  - 해제: 라이브 루프에서 그려진 프레임을 모두 캡처했다(17/101/195/274ms). 타이핑 자세로 바뀐 뒤 101→195→274ms에 걸쳐 내려앉는다. 내려오는 두 프레임 동안 손이 키보드보다 조금 위에 떠 있고 불꽃이 이미 켜져 있지만, 0.2초 안이라 자연스러운 "다시 자세를 숙임"으로 보인다.
- 캡처: shots/recheck-18/r18-044-n6-480-working-vs-awaiting-3frames.png(왼쪽 열이 working), shots/recheck-18/r18-044-n6-410-working-vs-awaiting-3frames.png, shots/recheck-18/r18-044-room-top-n1-16-480-410.png, shots/recheck-18/r18-044-orchestrator-solo-zoom.png, shots/recheck-18/r18-044-enter-rise-0-250.png, shots/recheck-18/r18-044-release-fall-live.png
- 판정: 해결. closed
