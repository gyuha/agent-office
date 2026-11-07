# VQA-013 orchestrator 주변 반투명 사각 경계와 대형 배경 오른쪽 아래 잘린 가구

- 심각도: 낮음
- 추정 담당: art
- 상태: closed

## 증상
1. 리드 책상에서 일하는 orchestrator의 왼쪽 팔꿈치부터 키보드 아래까지 미세하게 밝은 사각 테두리(세로선과 가로선)가 보인다. 대비를 올리면 분명하다. lead-back/front 또는 orchestrator 스프라이트의 반투명 가장자리로 추정한다(원인 미확정).
2. large 배경(N10, N16) 오른쪽 아래 구석에 화분과 책상 조각이 화면 끝에서 잘린 채 보인다. 멤버 책상과 같은 계열이라 "잘린 책상"으로 읽힌다.

## 재현 조건
- N=6 mixed `setTime(15000)`, 480px DPR2 (1번)
- N=10 또는 16 mixed `setTime(15000)` (2번)

## 스크린샷
- shots/vqa013-orchestrator-halo-box-contrast.png (대비 2.2배)
- shots/vqa013-n10-bottom-right-cut-furniture.png

## 왜 어색한가
1번은 합성 흔적처럼 보인다. 2번은 배치되지 않은 책상이 화면 밖에 걸친 것처럼 보인다.

## 기대 모습
스프라이트 가장자리에 반투명 사각 잔여물이 없어야 한다. 배경 구석에는 책상으로 오인될 가구 조각이 없어야 한다.

## 재확인 결과 (2026-11-07, 1차 재확인)

- 1번(orchestrator 주변 사각 테두리)은 크게 줄었다. 대비 3배 확대에서만 키보드 왼쪽에 희미한 세로선 하나가 보이고, 480px 기본 표시에서는 보이지 않는다.
- 2번(large 배경 오른쪽 아래 잘린 가구)은 사라졌다. N10과 N16 구석이 빈 바닥이다.
- 캡처: shots/recheck-1/r013-orchestrator-halo-contrast3x.png, shots/recheck-1/r013-n10-bottom-right.png
- 판정: 해결. closed
