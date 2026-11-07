# VQA-028 착석 인물의 팔뚝이 사라져 손만 키보드 위에 떠 있음 (사용자 피드백)

- 심각도: 높음
- 추정 담당: scene (몸통 → 상판 → 손 오버레이 그리기 순서와 손 오버레이 영역), art (손 오버레이 프레임 범위)
- 상태: closed
- 출처: 사용자 실제 패널 피드백 "캐릭터의 팔뚝이 사라집니다." (orchestrator 표시)
- qa 회귀 테스트 필요

## 증상
VQA-027 수정으로 상판이 몸통 위에 그려진다. 그런데 손 오버레이에는 손만 있고 팔뚝과 소매는 없다. 그래서 어깨와 손 사이의 팔뚝이 상판에 덮인다. 몸통은 상판 뒤 모서리에서 끊기고, 손은 그 아래 키보드 위에 따로 떠 있다. 팔이 연결되지 않아 손만 책상 위에 놓인 것처럼 보인다.
- orchestrator(working): 조끼와 셔츠 아래가 상판 선에서 잘리고, 두 손만 키보드 위에 있다. 사용자가 실제 패널에서 지적한 것과 같다.
- 멤버(working): plugin#FDF9의 후드 소매가 상판에서 끊기고 손만 키보드 위에 있다.
- phone: scene#3C71의 휴대폰을 든 손과 몸통 사이 팔뚝이 상판에 가려진다.

## 재현 조건
- N=6, 480px DPR2, `setTime(20000)`, working(orchestrator, plugin), phone(scene)
- 같은 증상: N=1, 3, 16, 410px의 working과 phone 전체
- 실제 Paseo 패널(사용자 캡처)

## 스크린샷
- shots/recheck-6/v028-forearms-hidden.png (확대: orchestrator, plugin, scene)
- shots/recheck-6/r6-027-n6-desk-zoom.png

## 왜 어색한가
팔이 없는 몸과 떠 있는 손이 따로 그려진다. 작은 화면에서도 orchestrator 쪽은 눈에 띈다(사용자가 실제 패널에서 바로 발견).

## 기대 모습
손 오버레이에 손목에서 팔꿈치까지 팔뚝(소매 포함)을 함께 넣어, 상판 위로 팔이 몸통에서 키보드까지 이어져 보인다. 상판은 몸통 아래와 의자만 가린다.

## 재확인 결과 (2026-11-07, 7차 재확인)

- N=1, 3, 6, 16 × 480px/410px × working, phone, sleeping, attention을 `setTime(20000)`으로 확인했다. 소매에서 손까지 팔이 상판 위로 이어져 보이고, 손만 떠 있는 경우가 없다. orchestrator도 같다.
- 실제 Paseo 패널(Agent Office 탭, agent-desktop 스크린샷)에서 orchestrator와 qa#0499의 팔이 몸통에서 키보드까지 이어진다.
- 캡처: shots/recheck-7/r7-n6-480-desks-4states.png, shots/recheck-7/r7-n-width-sweep.png, shots/recheck-7/r7-live-paseo-panel.png, shots/recheck-7/r7-live-paseo-desks.png
- 판정: 해결. closed
