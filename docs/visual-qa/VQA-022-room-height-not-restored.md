# VQA-022 방 높이가 보고된 값으로 복원되지 않아 아래쪽 빈 바닥이 큼 (preview 기준)

- 심각도: 낮음
- 추정 담당: scene (`core/layout.ts` 행 간격·방 높이)
- 상태: closed

## 증상
scene은 480px 기준 방 높이가 N6 386px, N16 546px로 복원됐다고 보고했다. 그런데 현재 preview(`client/scene/preview.html`, 18:08 빌드, `core/*.ts`보다 최신)에서 측정하면 여전히 N6 489px, N16 660px다(헤더 포함, DPR2 캔버스 978/1320 device px). 행 간격이 넓은 그대로라 N6 아래 행 아래와 N16 행 사이·맨 아래에 빈 바닥이 넓게 남는다. 480px 패널에서 스크롤이 더 길어진다.

## 재현 조건
- N=6 mixed, N=16 away, 480px DPR2, `setTime(15000)`
- `layout.ts`: `py=(n<=6?450:500)+Math.floor(i/cols)*(rowHeight+actorHeight+48)`

## 스크린샷
- shots/recheck-2/r2-n6-mixed-15000.png
- shots/recheck-2/r2-020-n16-away-15000.png

## 왜 어색한가
가구가 줄어든 뒤 바닥만 넓어 방이 휑하다. 보고된 수치와 실제 화면도 맞지 않는다.

## 기대 모습
보고대로 N6 386px, N16 546px. 또는 실제 Paseo 패널 기준 값이 다르다면 그 값을 README에 맞게 고친다. 실제 패널은 탭 조작 금지로 확인하지 못했다(미확인).

## 재확인 결과 (2026-11-07, 3차 재확인)

- 480px DPR2 `setTime(15000)` 기준 방 높이(헤더 포함)를 측정했다: N6 394px(788 device px), N16 546px(1092 device px), N3과 solo 386px. scene 보고(N6 393.2px, N16 546px)와 맞는다. 아래 빈 바닥이 사라졌고 마지막 행 명판도 잘리지 않는다.
- 캡처: shots/recheck-3/r3-022-n6-mixed-480.png, shots/recheck-3/r3-022-n16-away-480.png, shots/recheck-3/r3-022-n16-bottom-row.png
- 판정: 해결. closed
