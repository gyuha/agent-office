# VQA-041 첫 줄 가운데 멤버의 '?' 말풍선이 orchestrator 명판을 가림 (N4~6, 질문 대기 모션)

- 심각도: 중간
- 추정 담당: scene (질문 말풍선 위치, 행 배치)
- 상태: closed
- qa 회귀 테스트 필요

## 증상
medium 방(N4~6)에서 첫 줄 가운데 자리(액터 1, scene#3C71)의 머리 위가 리드 책상 명판 바로 아래에 있다. 질문 대기가 되면 '?' 말풍선이 "Orchestrator" 명판의 오른쪽 글자를 덮는다. qa는 "살짝 겹침"이라고 보고했지만, 실제로는 "at" 두 글자가 거의 가려 "Orchestr?r"처럼 읽힌다.
- 480px, 410px 모두 발생, N5와 N6 모두 발생
- N3(small), N10·N16(large)은 겹치지 않는다.
- 기존 '!'(attention)도 같은 위치 규칙이지만, '?' 말풍선이 더 넓어(128 대 80 logical px) 이번에 눈에 띄게 됐다.

## 재현 조건
- preview `#16` fixture를 멤버 5명 또는 6명으로 자름, 전원 working + needsAttention, 480px/410px DPR2, `setTime(20000)`

## 스크린샷
- shots/recheck-14/v041-n6-480-awaiting-full.png
- shots/recheck-14/v041-lead-plate-n3-n5-n6-n10-n16-480-410.png (위: 480px, 아래: 410px)

## 왜 어색한가
질문 대기라는 가장 중요한 알림이 manager 이름표와 겹쳐 둘 다 읽기 어렵다.

## 기대 모습
말풍선과 명판이 겹치지 않는다. 예: 겹칠 때 말풍선을 머리 오른쪽 위로 옮기거나, 말풍선을 명판보다 뒤에 그리지 말고 위치 자체를 피하거나, medium 방 첫 줄을 조금 아래로 내린다.

## 재확인 결과 (2026-11-09, 15차 재확인)

- 같은 조건(멤버 5·6명, 480/410px, 전원 working + needsAttention, `setTime(20000)`)으로 다시 캡처했다. 첫 줄 가운데 멤버의 '?' 말풍선이 명판 오른쪽 끝 바깥으로 옮겨져 "Orchestrator"가 전부 보인다. N3, N10, N16은 원래 자리 그대로다.
- 캡처: shots/recheck-15/r15-041-lead-plate-n3-n5-n6-n10-n16-480-410.png, shots/recheck-15/r15-041-n6-480-all-awaiting-row1.png
- 판정: 겹침은 해결. closed. 다만 옮겨진 말풍선이 누구 것인지 헷갈리는 문제가 있어 [VQA-043](VQA-043-shifted-question-bubble-ownership.md)로 따로 적었다.
