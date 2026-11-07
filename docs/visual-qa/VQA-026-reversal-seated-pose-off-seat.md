# VQA-026 이동 중 상태가 다시 바뀌면, 대기 동안 앉은 포즈로 바닥에 떠 있음

- 심각도: 중간
- 추정 담당: scene (`core/actors.ts` 300ms 시차 대기와 `draw.ts` 비이동 포즈 선택)
- 상태: closed
- qa 회귀 테스트 필요

## 증상
걷는 중에 상태가 원래대로 되돌아가면(반전), 300ms 시차 그룹(빈백 슬롯 짝수 번)에 속한 멤버는 그 자리에서 다시 약 300ms 동안 대기한다. 이 대기 동안 `moving=false`라서 걷기 포즈 대신 현재 상태 포즈가 좌석이나 빈백 밖 위치에 그대로 그려진다.
- working→away→(0.5초 뒤) working: plugin#FDF9와 qa#0499가 자기 책상 왼쪽 앞 바닥에서 의자 없이 앉은 working 포즈로 약 0.3~0.4초 동안 떠 있다. 다리가 책상 앞판 앞으로 나와 명판 "plugin" 글자를 가린다.
- away→working→(0.5초 뒤) away: 같은 두 멤버가 빈백 오른쪽 맨바닥에서 빈백에 기댄 포즈로 약 0.3초 동안 누워 있다(빈백 없이 공중에 기댄 모양).
- 반전 대기가 끝나면 다시 걷기 포즈로 돌아가 원래 자리로 걷는다. 위치 컷(순간이동)은 없다.

흐름은 다음과 같다.
```
working(착석) → away: 시차 300ms 뒤 걷기 시작 → 0.5s: working으로 반전
  → 다시 300ms 대기(moving=false) → 좌석 밖에서 working 앉은 포즈 표시 ← 문제
  → 걷기 재개 → 착석
```

## 재현 조건
- N=6, 480px DPR2, 라이브 루프. 상태를 working으로 2.5초 유지한 뒤 away로 바꾸고, 500ms 뒤 working으로 되돌린다. 바꾼 뒤 약 560~840ms 구간(프레임 4~6)에서 p-0(plugin#FDF9)과 p-3(qa#0499)
  - trace: 429ms에 p-0 (418,868) 이동 → 562ms, 698ms에 p-0 정지(이동 목록에 없음) → 837ms에 다시 이동
- 반대 방향: away 유지 → working → 500ms 뒤 away. 523~781ms 구간
- `setTransition`은 상태를 한 번만 바꾸므로 반전을 재현할 수 없다. 라이브 루프로 120~135ms 간격 캡처했다.
- N3, N16에서도 같은 시차 그룹 멤버에게 같은 대기 정지가 trace로 확인된다(N3 p-0).

## 스크린샷
- shots/recheck-4/v026-n6-reversal-working-pose-in-front-of-desk.png (프레임 2~7, plugin 책상)
- shots/recheck-4/v026-n6-reversal-frame04-full.png
- shots/recheck-4/v026-n6-reversal-working-away-working-sheet.png
- shots/recheck-4/v026-n6-reversal-away-working-away-sheet.png (프레임 5~6, 빈백 옆 바닥)
- shots/recheck-4/v026-ra6-trace.txt

## 왜 어색한가
걷던 사람이 의자도 빈백도 없는 맨바닥에 앉거나 누운 모양으로 순간 바뀌었다가 다시 일어나 걷는다. 책상 앞에서는 명판을 가린다. 상태 알림이 짧게 깜빡이는 실제 사용 환경(승인, 재시작)에서 자주 생길 수 있다.

## 기대 모습
좌석이나 빈백에 도착하지 않은 동안에는 항상 선 자세를 쓴다(걷기 또는 정지한 선 프레임). 반전 때는 대기 없이 바로 되돌아 걷거나, 대기하더라도 선 자세를 유지한다.

## 재확인 결과 (2026-11-07, 5차 재확인)

- 새로 추가된 `preview.setTransitionSequence`로 반전을 시간 고정해 재현했다. 대상은 N3, N6, N16, 양방향(working→away→working, away→working→away)이고, 반전 시점은 200, 500, 1500ms다(18조합). 각 조합에서 반전 후 0~7000ms를 100ms 간격으로 수치 추적했다.
  - 좌석이나 빈백 밖에서 멈춰 있는 시간: 모든 조합에서 0ms
  - 순간이동(100ms당 40 logical px 초과): 0건
  - 다른 책상 관통: 0건
  - 걷는 인물끼리 근접(50×40 logical px): 0건
  - 최종 위치: 전원이 좌석 또는 빈백에 도착
  - 페이지 오류: 0건
  - 반전 후 복귀 시간은 나간 시간과 거의 같다(반전 200ms → 약 0.3초, 500ms → 약 0.6초, 1500ms → 약 1.6초). 반전 즉시 되돌아 걷는다는 뜻이다.
- 83ms 간격 캡처(N6 양방향 500ms, N3 away 반전 200ms, N16 working 반전 1500ms)에서 반전 직후 바로 몸을 돌려 걷고, 좌석이나 빈백에 닿는 순간에만 앉은 포즈로 바뀐다. 바닥에 앉거나 누운 포즈는 없다.
- 참고(리포트 안 함): away 반전에서 scene#3C71이 레인을 따라 아래로 조금 내려갔다가 되돌아가며 남색 빈백 위쪽을 스친다. 반전 자체가 되돌아가는 동작이고 레인도 정상 경로라 문제로 보지 않았다.
- 캡처: shots/recheck-5/r5-026-n6-waw-500-frames.png, shots/recheck-5/r5-026-n6-awa-500-frames.png, shots/recheck-5/r5-026-n6-awa-500-lounge-zoom.png, shots/recheck-5/r5-026-n3-awa-200-frames.png, shots/recheck-5/r5-026-n16-waw-1500-frames.png
- 판정: 해결. closed
