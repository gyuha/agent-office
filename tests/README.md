# Agent Office — Tests

`tests/` 디렉터리는 상태 기계/서버 단위 테스트(`tests/unit/`)와 Playwright 기반 결정적 시각 회귀 테스트(`tests/visual/`)를 담는다.

## 1. 단위 테스트 실행 방법 (`tests/unit/`)

프로젝트 루트에서 `npm test`로 실행하거나, `tests/` 안에서 `npm run test:unit`으로 실행한다(외부 러너 없이 Node 내장 `node:test`와 `--experimental-strip-types` 사용).

```bash
# 저장소 루트에서 실행
npm test

# 또는 tests/ 디렉터리에서 실행
cd tests && npm run test:unit
```

## 2. Playwright 시각 회귀 테스트 실행 방법 (`tests/visual/`)

`tests/` 디렉터리 안에 독립된 `package.json`과 `@playwright/test`가 설치되어 있다. `client/scene/core/`와 `client/scene/generated/sprites.ts`를 번들한 결정적 하네스(`tests/visual/harness/index.html`)를 통해 실시간 `requestAnimationFrame` 대신 고정 시각 `t`와 고정 `dtMs` 스텝을 주입해 렌더링한다.

```bash
# 시각 회귀 테스트 실행 (하네스 자동 빌드 포함)
cd tests && npx playwright test
# 또는
cd tests && npm run test:visual
```

### 기준 이미지(Baseline Snapshots) 갱신 방법

렌더링 코어나 스프라이트가 의도적으로 변경되어 기준 이미지를 새로 생성/갱신해야 할 때:

```bash
cd tests && npx playwright test --update-snapshots
# 또는
cd tests && npm run test:visual:update
```

기준 이미지는 `tests/visual/scene.spec.ts-snapshots/*.png`에 저장된다.

### 단위 + 시각 회귀 전체 실행 (`tests/` 기준)

```bash
cd tests && npm test
```

## 3. 테스트 구성 요약

- `tests/unit/machine.test.ts`: `shared/state/machine.ts` 상태 기계 단위 테스트 (이벤트→상태, `SLEEP_AFTER_MS`, `needsAttention` 회귀, 생명주기, 부모 트리/순환/다중 워크스페이스 그룹, 스냅샷 범위, 순서 위반 내성)
- `tests/unit/mapping.test.ts`: `server/mapping.ts` 순수 매핑 함수 단위 테스트 (`identityFromHook`, `parentFromLabels`, `identityFromListed`, `seedFromListed`, `workspaceProjectFromListed`)
- `tests/unit/office.test.ts`: `server/office.ts` `contributeOffice(server, { now })` 통합 및 `refreshWorkspaces`/`loadAgents` 재시도 회귀 테스트
- `tests/visual/scene.spec.ts`: `client/scene/core/` Playwright 시각 회귀 및 기하/전이 검증
  1. **결정성**: 동일 입력(스냅샷, 액터, 시각 `t`) 재렌더링 시 픽셀 차이 `0` 단언
  2. **상태별 애니메이션**: `working`(`t=0, 100, 200`), `phone`(`t=0, 400, 800`), `sleeping`(`t=0, 400, 800`), `away` 이동 중(`t=200, 350`) 및 도착 후(`t=2000, 2400`), `needsAttention`(`t=0, 200`) 기준 이미지 비교 및 시간 경과에 따른 프레임 변화(`diff > 0`) 단언
  3. **레이아웃**: `project-1`, `project-3`, `project-7`, `project-15`, `all`(3개 프로젝트), `empty` 캡처 비교 + 비시각 기하 검증(에이전트 수 증가 시 방 넓이 단조 증가, 오피스 간 비겹침, 이름표 사각형 간 비겹침)
  4. **전이**: `working → away → working` 전이 시 프레임당 이동 거리 상한(`dtMs * 0.065`) 단언(순간이동 방지), 좌석 복귀, 동일 ID 신규 스냅샷 투입 시 위치 보존 및 중간 장면 캡처 비교
  5. **Known Issues**: 관리자 책상과 유리 파티션 하단 겹침, 이동 액터 간 동적 충돌 회피 부재를 실패 없이 검증/문서화
