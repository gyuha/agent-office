# VQA-004 orchestrator 전용 빈백이 오른쪽 첫 줄 책상 의자와 겹침 (기존 알려진 문제, 재확인)

- 심각도: 높음
- 추정 담당: scene (`restLayout.managerSlot.byBackground` 배치)
- 상태: closed
- qa 회귀 테스트 필요

## 증상
- N10/N16(large): 남색 빈백이 qa#0499 책상의 의자 위쪽에 겹친다. orchestrator가 away로 앉으면 다리가 qa 모니터 쪽으로 뻗어 책상 위에 걸친 것처럼 보인다.
- N6(medium): 빈백 아래 가장자리가 art#94A2 의자 등받이와 닿아 겹친다.
- N3(small)은 여유가 있다.

## 재현 조건
- N=16, state=away, 480px, `setTime(6000)`
- N=10/16, state=mixed, `setTime(15000)`
- N=6, state=mixed, `setTime(15000)`

## 스크린샷
- shots/vqa004-n16-away-manager-bag.png
- shots/vqa004-n6-mixed-manager-bag.png
- shots/vqa005-n16-mixed-empty-beanbags.png (오른쪽 위)

## 왜 어색한가
가구끼리 겹쳐서 orchestrator가 멤버 책상 위에 누운 것처럼 보인다.

## 기대 모습
빈백은 리드 책상 옆 빈 바닥에 놓이고 어떤 멤버 책상·의자와도 겹치지 않는다(N3~N16 전부).

## 재확인 결과 (2026-11-07, 1차 재확인)

- N16 away `setTime(45000)`, N6/N10/N16 mixed `setTime(15000)`를 확인했다. orchestrator 빈백이 리드 책상 오른쪽, 뒷벽 수납장 앞으로 옮겨졌다. qa나 art 책상 의자와 겹치지 않는다. orchestrator가 앉아도 멤버 책상에 닿지 않는다.
- 캡처: shots/recheck-1/r004-n16-away-manager-bag.png, shots/recheck-1/r004-n6-mixed-manager-bag.png
- 판정: 해결. closed
