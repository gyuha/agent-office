# VQA-024 "PR up!"/"Done!" 말풍선이 승인 대기 "!"를 가림

- 심각도: 중간
- 추정 담당: scene (`draw.ts` 효과 위치와 우선순위)
- 상태: closed
- qa 회귀 테스트 필요

## 증상
working 멤버가 needsAttention인 상태에서 장식 말풍선("PR up!", "Done!")이 뜨면 머리 위 같은 자리에 겹친다. 말풍선이 attention "!" 아이콘을 거의 다 덮어 "!"의 윗부분만 조금 보인다. 말풍선은 13초 주기로 약 1.3초씩 뜬다.

## 재현 조건
- N=16, state=working, 전원 `needsAttention=true`, 410px, `setTime(20000)`. 액터 11(api#C0DE)
- 같은 주기 조건이면 다른 N과 480px에서도 발생한다(말풍선 시각은 `phase + index*0.93` 기준).

## 스크린샷
- shots/recheck-3/v024-n16-410-bubble-covers-attention.png
- shots/recheck-3/v024-n16-410-attn-20000-full.png

## 왜 어색한가
가장 중요한 알림(승인 필요)이 장식 효과에 가려진다. 사용자가 이 순간을 보면 승인 요청을 놓친다.

## 기대 모습
needsAttention인 액터에는 장식 말풍선과 +숫자 효과를 띄우지 않는다. 또는 "!"가 항상 맨 위에 오고 말풍선은 겹치지 않는 위치로 옮긴다.

## 재확인 결과 (2026-11-07, 4차 재확인)

- N16 working, 전원 `needsAttention=true`, 410px에서 `setTime` 5000, 9000, 20000, 33000을 확인했다. "!"만 표시되고 "PR up!", "Done!" 말풍선과 +숫자 팝업은 나오지 않는다. 같은 조건의 일반 working(attention 없음)에서는 말풍선이 정상으로 나온다.
- 캡처: shots/recheck-4/r4-024-n16-410-attention-only.png, shots/recheck-4/r4-sweep-n16-480.png
- 판정: 해결. closed
