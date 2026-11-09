# Follow-ups

<!-- followup: fu-8e0bcc7fd613 | source: office-status-filter | task: 1 | date: 2026-11-08 | status: open | taken: - -->
- `tests/visual/harness/mount.html`을 `.gitignore`에 추가하고 git 추적을 해제한다(`git rm --cached`).
  근거: qa가 S3에서 빌드 산출물인 이 파일이 `git ls-files`에 들어 있고 수정된 상태라고 보고했다.

<!-- followup: fu-880141795920 | source: office-status-filter | task: 1 | date: 2026-11-08 | status: open | taken: - -->
- 시각 테스트 기준 이미지(42장, 약 20MB)의 저장소 크기 정책(Git LFS, 해상도 축소, 중복 캡처 정리)을 정한다.
  근거: S3와 S4 회귀 테스트 뒤 qa 보고 기준으로 기준 이미지가 42장, 20MB로 늘었다.

<!-- followup: fu-4ebfa3233f06 | source: awaiting-question-pose | task: 2 | date: 2026-11-09 | status: open | taken: - -->
- `assets/office/export_runtime.py`가 provider-icon 런타임 WebP 7개를 지우고 manifest 경로를 되돌리는 부작용을 고친다. 또 `validate_half.py`가 실행할 때마다 `edge-audit.json`, `validation.json`, `.pyc`를 다시 쓰는 문제도 정리한다.
  근거: art가 S1에서 export_runtime.py 실행 직후 git으로 provider-icon을 복원해야 했고, S1과 VQA-042에서 validate가 추적 파일을 다시 썼다.
