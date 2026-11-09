<!-- auto-retro: fg-loop -->
# 2026-11-09 — 질문 대기 모션(손 들기 + '?' 말풍선) 추가

## 계획과 실제
- 계획대로 된 것: art(시트 7종과 말풍선), scene(그리기 분기), qa(단위와 시각 테스트)가 각각 한 번에 끝났다. fg-loop 확인 항목 C1~C4는 첫 판정에서 통과했다.
- 달라진 것:
  - visual-qa가 말풍선 문제를 3건 연달아 찾았다(VQA-041 명판 가림 → VQA-041 수정 때문에 생긴 VQA-043 말풍선 주인 혼동, VQA-042 '?' 옆 획). 결국 말풍선 배치를 두 번 다시 만들었다.
  - 유료 fal.ai 생성의 실제 청구액을 MCP 도구로 조회할 수 없어, 장당 비용 상한 대신 장 수 상한만 지켰다(8/16장).
  - C4 확인 항목이 기존 필터 테스트 이름("Awaiting")과 겹쳐, 작업 전에도 통과하는 것을 기준값 단계에서 발견해 고쳤다.

## 배운 점
- 다음에 다르게 할 것:
  - 머리 위 효과를 더 큰 그림으로 바꿀 때는, 바꾸기 전에 '이웃 명판과 겹침'과 '말풍선 주인 구분(꼬리와 머리 거리, 가장 가까운 머리)'을 측정 기준으로 정해 두고 시작한다. 이번에는 겹침만 피하는 첫 수정이 주인 혼동이라는 새 문제를 만들었다.
  - 시각 테스트를 이름 필터(`-g`)로 고를 때는, 기존 테스트 이름과 겹치지 않는 고유한 문구를 쓰고 기준값 단계에서 0개인지 확인한다.
  - 유료 생성의 '비용 상한'은 실제 청구액을 조회할 수 있을 때만 조건으로 건다. 조회할 수 없으면 처음부터 장 수 상한으로 약속한다.
  - art 파이프라인 스크립트(`export_runtime.py`, `validate_half.py`)에는 추적 파일을 지우거나 다시 쓰는 부작용이 있다. 실행한 뒤 `git status`로 assets 밖과 provider-icon을 확인한다.

## 문서 반영
- 검토 안 됨(자동 회고)

## 후속 작업 후보
<!-- followup: fu-4ebfa3233f06 | source: awaiting-question-pose | task: 2 | date: 2026-11-09 | status: open | taken: - -->
- `assets/office/export_runtime.py`가 provider-icon 런타임 WebP 7개를 지우고 manifest 경로를 되돌리는 부작용을 고친다. 또 `validate_half.py`가 실행할 때마다 `edge-audit.json`, `validation.json`, `.pyc`를 다시 쓰는 문제도 정리한다.
  근거: art가 S1에서 export_runtime.py 실행 직후 git으로 provider-icon을 복원해야 했고, S1과 VQA-042에서 validate가 추적 파일을 다시 썼다.
