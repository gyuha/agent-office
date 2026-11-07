# VQA-010 승인 대기 표시가 "!"가 아니고, 머리에 묻히거나 몸과 떨어져 뜸

- 심각도: 중간
- 추정 담당: art (attention 에셋 모양), scene (위치 계산)
- 상태: closed
- qa 회귀 테스트 필요

## 증상
1. attention 에셋은 "!"가 아니라 노란 3줄 강조선이다. 머리카락 바로 위에 붙고 일부가 머리카락과 겹쳐 잘 보이지 않는다. 480px에서는 반짝이 장식처럼 보여 "승인 필요"로 읽히지 않는다.
2. 위치가 `a.y - station.actorHeight` 기준이라, 걷는 중이거나 빈백 위에 있으면 몸과 떨어진 곳에 뜬다.
   - 걷는 qa: 머리보다 약 50 CSS px 위, orchestrator 모니터 위
   - 빈백 위 orchestrator: 머리보다 약 60 CSS px 위, 창가 화분 사이

## 재현 조건
- N=6, state=working, 전원 `needsAttention=true`, `setTime(33000)`(qa visit 중)
- N=6, state=away, 전원 `needsAttention=true`, `setTime(5000)`

## 스크린샷
- shots/vqa010-attn-mark-on-hair.png
- shots/vqa010-attn-walker-mark-detached.png
- shots/vqa010-attn-away-manager-mark-detached.png

## 왜 어색한가
가장 중요한 알림이 장식처럼 묻히고, 어떤 캐릭터의 알림인지 헷갈린다.

## 기대 모습
머리 위 일정 간격에 또렷한 "!" 말풍선이 뜬다. 위치는 현재 그려진 포즈(걷기, 빈백, 착석)의 머리 기준으로 계산한다.

## 재확인 결과 (2026-11-07, 1차 재확인)

- 다음을 확인했다: N6 working에 전원 `needsAttention` `setTime(5000)`, 걷는 중(`setTransition` working→away 1500/3250, attention 포함), away `setTime(15000)`.
  - 아이콘이 노란 "!" 말풍선으로 바뀌었고, 착석·걷기·빈백 모든 포즈에서 머리 위를 따라간다.
- 남은 점(재오픈 사유 아님): 빈백 위 orchestrator의 "!"는 머리 위 약 21 CSS px로 다른 인물보다 조금 더 높고 오른쪽으로 치우쳐 뒷선반과 겹친다. 예전처럼 몸과 동떨어지지는 않는다.
- 캡처: shots/recheck-1/r010-attn-working.png, shots/recheck-1/r010-attn-walking.png, shots/recheck-1/r010-attn-away.png, shots/recheck-1/r010-attn-orchestrator-beanbag.png
- 판정: 해결. closed
