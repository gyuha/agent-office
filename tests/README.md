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

`tests/` 디렉터리 안에 독립된 `package.json`과 `@playwright/test`가 있다(`cd tests && npm install`). `client/scene/core/`와 `client/scene/generated/office.ts`(v10 매니페스트 + 시트 data URI)를 번들한 결정적 하네스(`tests/visual/harness/index.html`)가 시간을 전부 주입한다: 액터 시계는 `core.step`의 dt, 효과·flame은 `draw(..., timeMs, sprites, epoch)` 인자로 정한다. DOM 오버레이(상단바·이름표 버튼)는 canvas 밖이라 스크린샷에 없으며 `tests/unit/sceneHeader.test.ts`가 가짜 DOM으로 검증한다.

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
- `tests/unit/sceneAnimation.test.ts`: 상태→애니메이션 매핑(working 타이핑·60초 flame, away 소파 walk→away 루프·소파 만석 시 자리, phone 자리, sleeping zzz, needsAttention 효과), 2초 폴링에도 시계 불변, 상태 전환 crossfade, 리사이즈 연속성
- `tests/unit/layoutGeometry.test.ts`: N=1~16 v10 배치 공식·비겹침·방 경계, 관리자 위치/명판, solo, scope all 스택
- `tests/unit/hitTest.test.ts`: 명판·책상(앉은 캐릭터·책상 몸체) 클릭 → agent id, 이동 중, 겹침, 스케일 보정
- `tests/unit/sceneHeader.test.ts`: 가짜 DOM으로 `mountOfficeScene`을 실행해 상단바(PROJECT / WORKSPACE(null이면 숨김) / AGENT)와 명판 버튼 검증, `providerColor`
- `tests/unit/manifestSheets.test.ts`: 매니페스트·generated 일관성, `sheetFrame`·`draw`가 임의 frames/fps에서 동작
- `tests/unit/viewport.test.ts`: `fitSceneWidth`, 1536 고정 좌표
- `tests/visual/scene.spec.ts`: 상태별(working/away-on-sofa/phone/sleeping/attention/flame) 및 레이아웃(solo/n3/n6/n10/n16/all/empty) 기준 스크린샷, 결정성·flame 60초·폴링 위상 불변 단언

## 4. 알려진 결함 / 대기 항목 (`{ todo }` 테스트)

- `generated/office.ts`가 `assets/office/manifest.json`보다 낡았다(`npm run sprites`로 재생성). 재생성 후 `manifestSheets.test.ts`의 todo와 `scene.spec.ts`의 skip(다중 프레임 시트)을 확인하고, 기준 스크린샷은 art 시트 교체가 끝난 뒤 `cd tests && npm run test:visual:update`로 한 번 갱신한다.
- `providerColor`가 프로토타입 키(`constructor` 등)에 함수를 돌려준다(scene).
