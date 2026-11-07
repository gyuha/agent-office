# VQA-014 명판의 provider 아이콘이 일부만 아이콘이고 나머지는 색 점

- 심각도: 낮음
- 추정 담당: art (provider 아이콘 에셋 누락)
- 상태: closed

## 증상
claude와 codex는 64px 아이콘이 나오는데, gemini(art#94A2, docs#7B10 등)는 보라색 점, orchestrator는 노란 점만 나온다. 한 줄의 명판들 사이에 표시 방식이 섞여 있다. `assets/reference/provider-icons/`에 gemini 아이콘이 없다.

## 재현 조건
- N=6 mixed `setTime(15000)`, 480px (fixture provider는 claude/codex/gemini 순환, manager는 `orchestrator`)
- 실제 Paseo에서 manager provider가 claude라면 orchestrator 쪽은 발생하지 않을 수 있다(미확인).

## 스크린샷
- shots/vqa014-nameplates-provider-fallback.png
- shots/vqa014-orchestrator-plate.png

## 기대 모습
지원하는 provider는 모두 같은 크기의 아이콘을 쓴다. 미지원 provider는 일관된 기본 아이콘을 쓴다.

## 재확인 결과 (2026-11-07, 1차 재확인)

- N6 mixed `setTime(15000)`, N10 410px를 확인했다. gemini와 orchestrator에도 같은 크기의 픽셀 모니터 아이콘이 표시되어 명판 형식이 통일됐다.
- 캡처: shots/recheck-1/r011-r014-n6-row1-nameplates.png, shots/recheck-1/recheck-n10-410px.png
- 판정: 해결. closed
