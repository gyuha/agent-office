# Agent Office sprite sheets

이 폴더는 배포 가능한 PNG와 프레임 메타데이터입니다. `manifest.json`의 `sheets` 배열에서 `png`, `metadata` 경로를 이 README가 있는 디렉터리 기준으로 로드하세요. 원본 vendor 파일은 런타임에 필요하지 않습니다. `contact-sheet.png`는 확인용이며 매니페스트에는 포함하지 않습니다.

타일 그리드는 **32×32 원본 픽셀**입니다. 캔버스는 정수배로 확대하고 스무딩을 끄세요(`imageSmoothingEnabled = false`, CSS `image-rendering: pixelated`). 캐릭터 프레임은 64×64입니다. 확대 전에 원본 픽셀 좌표로 배치하세요.

## 파일과 메타데이터

- `characters/agent-01/` … `agent-08/`, `characters/manager-01/` … `manager-02/`: 외형별 `working.png`, `phone.png`, `sleeping.png`, `walk.png`, `idle.png`와 같은 이름의 JSON.
- `effects/`: `steam`, `sweat`, `paper`, `exclamation`, `zzz`, `phone-glow`, `attention`. 각 32×32 프레임 4개.
- `furniture/`: `desk`, `manager-desk`, `monitor-*`, `chair`, `glass-partition`, `meeting-table`, `sofa`, `glass-table`, `coffee-machine`, `water-cooler`, `copier`, `bin`, `bookshelf`, `plant`, `city-window`, `tv`, `clock`, `whiteboard`, `coat-rack`.
- `tiles/`: `floor`, `wall`, `wall-top`, `pantry-floor`.

JSON은 `frameWidth`, `frameHeight`, `frames`(각 `name`, `x`, `y`, `w`, `h`), `animations`(키별 `frames`, `fps`), `anchor`(`x`, `y`)를 포함합니다. 좌표는 PNG 왼쪽 위 기준 원본 픽셀입니다. 프레임 이름으로 목록을 찾아 순서대로 재생하세요. 걷기와 idle의 애니메이션 키는 `up`, `left`, `down`, `right`; 앉기 계열은 파일명과 동일합니다. 정지 가구는 `default`입니다.

## 앵커와 레이어

캐릭터 앵커는 프레임 내부 좌표입니다. 앉기 시트는 `(32,48)` 좌석 기준, walk·idle은 `(32,52)` 발 기준입니다. 기준점을 `(x,y)`에 둘 때 프레임은 `(x-anchor.x, y-anchor.y)`에 그립니다. 같은 좌석 기준에서 일반 책상은 왼쪽 위를 대략 `(x-40,y+7)`, 모니터는 `(x+5,y-10)`에 두면 v4처럼 정면 얼굴과 엠블럼이 함께 보입니다. 관리자 책상은 128×48이므로 그 중심과 좌석을 맞추고 책상은 가구 형태에 맞게 조정하세요. 의자는 캐릭터 뒤에 둡니다. 이 오프셋은 권장 시작값이며 가구 배치와 캐릭터 시점에 따라 테스트하며 조정하세요.

그리기 순서: **바닥 → 벽 → 뒤쪽 가구 → 의자 → 캐릭터 → 책상 → 모니터 → 이펙트 → 이름표**. 유리 파티션은 뒤쪽 프레임을 먼저, 투명 유리 면은 캐릭터 위에 별도 반투명 레이어로 그릴 수 있습니다. 파티션 PNG는 윤곽선만 포함합니다. PNG 자체는 사각형 프레임이지만 투명 영역이 있습니다.

## 상태와 효과

| 상태 | 캐릭터 | 효과 / 동작 |
| --- | --- | --- |
| working | `working`, 12 fps | `steam`, `sweat`, `paper`, 간헐적 `exclamation`을 머리·책상 근처에 겹침 |
| away | 방향별 `walk`, 9 fps → `idle`, 3 fps | 경로를 따라 탕비 코너나 소파로 이동 후 머무름. 책상 의자는 비워 둠 |
| phone | `phone`, 3 fps | 폰과 얼굴빛은 프레임에 포함. `phone-glow`는 선택 |
| sleeping | `sleeping`, 3 fps | 책상 쪽으로 숙인 머리·팔과 `zzz` |
| needsAttention | 기존 상태 유지 | `attention`을 머리 위에 추가 |

이펙트 앵커 `(16,32)`를 머리 위 위치에 맞추세요. 이름표는 효과와 겹치지 않도록 최상위 레이어에서 조정합니다. `working`의 팔 잔상은 프레임에 포함되어 있습니다.

## 공급자

`claude` → `furniture/monitor-claude.png`, `codex` → `monitor-codex.png`, `antigravity` 또는 `gemini` → `monitor-antigravity.png`, `copilot` → `monitor-copilot.png`, `muse` → `monitor-muse.png`, `opencode` → `monitor-opencode.png`. `pi`, `omp`, 알 수 없는 값과 누락은 `monitor-unknown.png`로 처리합니다. 아이콘은 Paseo에 포함된 각 프로바이더 아이콘을 참고해 픽셀로 편집한 상표입니다.

## 방 크기 권장안

모든 값은 32px 타일 단위의 시작점입니다. 벽, 통로, 캐릭터 이동 경로를 포함해 scene에서 조절하세요.

| 책상 수 | 권장 실내 크기 | 관리자실 / 라운지 |
| --- | --- | --- |
| Solo 1 | 최소 6×7 | 관리자실 없이 탕비 소품 하나 |
| 관리자 + 2 | 최소 9×10 | 상단 5×4 관리자 공간 |
| 관리자 + 6 | 최소 15×14 | 상단 5×4 관리자 공간, 4×4 이상 라운지와 회의 공간 |
| 추가 직원 | 좌석 3개마다 최소 3타일 깊이 추가 | 좌석과 가구 사이 최소 1타일 통로 확보 |

`assets/tools/build_sprites.py`는 로컬 vendor와 v4에서 직접 그린 소품을 이용해 PNG·JSON·manifest를 재생성합니다. `assets/tools/contact_sheet.py`는 외형 10개 × 상태 5개와 모니터 7종을 포함한 확인 이미지를 만듭니다. 자세한 출처와 파생물 라이선스는 [크레딧](../CREDITS.md)을 보세요.
