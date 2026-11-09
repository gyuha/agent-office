# VQA-040 질문 대기 모션 점검 (forge 작업 #2, S4)

- 심각도: 해당 없음 (기능 점검 기록)
- 추정 담당: scene, art
- 상태: closed (열린 문제 없음)

## 점검 대상
needsAttention이고 착석 중인 working 에이전트는 타이핑 대신 화면을 보며 한 손을 흔드는 3프레임 루프(`<id>-awaiting`, 4fps)를 보여 준다. 머리 위에는 '?' 말풍선(question_bubble)이 뜨고, 불꽃 오라는 그리지 않는다. 대기가 풀리면 타이핑으로 돌아가고, 걷는 중에는 기존 '!'를 쓴다.

## 방법
- preview `#16` fixture를 멤버 1, 3, 5, 6, 10, 16명으로 자르고 전원 working + needsAttention으로 만들었다. 480px와 410px, DPR2에서 `setTime(20000/20250/20500)`으로 세 프레임을 캡처했다. 7명 외형(actor-0~5, orchestrator)이 모두 포함된다.
- 전환:
  - 진입: `setTransition('working','working', 0~500ms, {needsAttention:true})`
  - 해제: 라이브 루프에서 needsAttention을 끈 직후 약 60ms 간격으로 6장
  - 걷기 폴백: `setTransition('working','away', 600/1500ms, {needsAttention:true})`
- 리뷰 합성: `assets/office/review/awaiting-compose.png`

## 결과

| 항목 | 결과 |
|---|---|
| 손 든 팔 | 7명 × 3프레임 모두 손과 팔이 상판 위로 보인다. 모니터에 가리거나 잘리지 않는다. 손이 몸 왼쪽(모니터 반대편)에 있어 겹치지 않는다. |
| orchestrator 첫 프레임 | 손이 램프 옆에 완전히 보이고 프레임 가장자리에서 잘리지 않는다. 세 프레임 모두 정상 |
| 말풍선 위치·꼬리 | 머리 위 약 10 logical px, 꼬리가 머리를 향한다. 410px N16에서도 잘리지 않는다(약 13 CSS px 높이). |
| 프레임 튐·깜빡임 | 세 프레임 사이 몸 위치가 고정이고, 손 높이만 바뀐다. 말풍선은 머리 위치를 따라가며 1~2px 움직이는데, 흔드는 동작에 맞아 튀어 보이지 않는다. |
| 불꽃 | 대기 중에는 그리지 않는다. 해제 직후 프레임부터 타이핑과 불꽃이 함께 돌아온다. |
| 진입·해제 전환 | 둘 다 한 프레임 하드 컷이고 고스트나 빈 프레임이 없다. |
| 걷기 폴백 | 걷는 중인 에이전트는 '!'를 유지한다. 자리의 phone 포즈(needsAttention이지만 state가 away/phone)도 '!'를 쓴다. 규칙대로다. |
| 매 회차 점검 항목 | 착석 위치, 팔, 윤곽, 아래 여백·벽선 이상 없음 |

## 캡처
- shots/recheck-14/r14-040-n6-480-members-3frames.png, shots/recheck-14/r14-040-orchestrator-3frames.png
- shots/recheck-14/r14-040-n16-410-awaiting.png, shots/recheck-14/r14-040-solo410-n10-n3.png, shots/recheck-14/r14-040-awaiting-compose.png
- shots/recheck-14/r14-040-enter-awaiting-0-417.png, shots/recheck-14/r14-040-release-live.png, shots/recheck-14/r14-040-walking-fallback-bang.png

## 판정
모션은 closed. VQA-041, 042가 남아 있다.

## 확인하지 못한 것
- 실제 패널: 오른쪽 패널이 "에이전트 대시보드" 탭이라 확인하지 않았다(탭 조작 금지).
- tests/visual의 'awaiting pose' 기준 이미지와는 비교하지 않았다(qa 영역).

## 재확인 결과 (2026-11-09, 15차 재확인)

- 041, 042는 closed. 옮겨진 말풍선의 주인을 알아보기 어려운 문제가 VQA-043으로 남아 있다.
- 매 회차 점검 항목(7명 손·팔, 프레임, 말풍선 잘림, 착석·여백)은 다시 봐도 이상 없다.

## 재확인 결과 (2026-11-09, 16차 재확인)

- VQA-041, 042, 043이 모두 closed다. 질문 대기 모션 점검은 열린 문제 없이 끝났다.
