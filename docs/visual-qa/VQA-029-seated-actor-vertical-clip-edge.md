# VQA-029 착석 인물의 왼쪽이 세로 직선으로 잘리고, 어깨 높이에 가로 이음선이 보임

- 심각도: 중간
- 추정 담당: scene (`actorClip`과 `actorSourceClip` 영역, 손 오버레이 경계)
- 상태: closed
- qa 회귀 테스트 필요

## 증상
1. 착석 인물의 왼쪽이 화면 세로 직선에서 칼로 자른 듯 끊긴다. 직선 왼쪽에는 의자 등받이만 보이고 오른쪽부터 머리카락과 몸이 시작한다. working, phone, sleeping 모두 나타난다.
   - plugin#FDF9: 머리카락 왼쪽 끝과 후드가 세로선에서 잘린다.
   - scene#3C71: 포니테일이 세로선에서 잘린다(phone, sleeping).
   - sleeping: 엎드린 머리 왼쪽이 직선으로 잘려 사각형을 붙인 것처럼 보인다.
2. 어깨와 상판 사이 높이에 1px 가로 이음선이 몸통 옆에서 모니터 쪽으로 이어진다(orchestrator working, scene phone 확대 화면).

## 재현 조건
- N=6, 480px DPR2, `setTime(20000)`, working, phone, sleeping, 액터 0(plugin), 1(scene)
- solo 410px phone, N3 480px working, N16 480px phone, N16 410px sleeping에서도 같은 세로 직선이 보인다.

## 스크린샷
- shots/recheck-6/v029-vertical-clip-edge.png (5개 상태 확대)
- shots/recheck-6/r6-027-n6-desk-zoom.png
- shots/recheck-6/v028-forearms-hidden.png (가로 이음선)

## 왜 어색한가
캐릭터가 오려 붙인 그림처럼 보인다. 이번 수정 전에는 없던 합성 흔적이다.

## 기대 모습
인물 윤곽은 원래 스프라이트 외곽선 그대로 보이고, 의자와 상판 외에는 직선으로 잘리는 곳이 없다. 클립 경계에 이음선이 생기지 않는다.

## 재확인 결과 (2026-11-07, 7차 재확인)

- 같은 범위에서 인물 왼쪽 세로 직선 잘림과 어깨 높이 가로 이음선이 보이지 않는다. 머리카락, 포니테일, 후드, 엎드린 머리 윤곽이 원래 외곽선대로 보인다. 실제 패널에서도 같다.
- 캡처: shots/recheck-7/r7-n6-480-desks-4states.png, shots/recheck-7/r7-n-width-sweep.png, shots/recheck-7/r7-live-paseo-desks.png
- 판정: 해결. closed
