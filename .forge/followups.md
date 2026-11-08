# Follow-ups

<!-- followup: fu-8e0bcc7fd613 | source: office-status-filter | task: 1 | date: 2026-11-08 | status: open | taken: - -->
- `tests/visual/harness/mount.html`을 `.gitignore`에 추가하고 git 추적을 해제한다(`git rm --cached`).
  근거: qa가 S3에서 빌드 산출물인 이 파일이 `git ls-files`에 들어 있고 수정된 상태라고 보고했다.

<!-- followup: fu-880141795920 | source: office-status-filter | task: 1 | date: 2026-11-08 | status: open | taken: - -->
- 시각 테스트 기준 이미지(42장, 약 20MB)의 저장소 크기 정책(Git LFS, 해상도 축소, 중복 캡처 정리)을 정한다.
  근거: S3와 S4 회귀 테스트 뒤 qa 보고 기준으로 기준 이미지가 42장, 20MB로 늘었다.
