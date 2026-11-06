# Clay 3D 파츠 규격

v6/02-clay3d에서 직접 다시 그린 벡터입니다. `manifest.json`의 `files`는 각 SVG의 `viewBox`, 원본 `size`, SVG 좌표계의 관절 `pivot`을 포함합니다. 각 파츠는 내부 그라데이션을 갖춘 독립 SVG입니다. `node`나 네트워크 없이 렌더링할 수 있으며, 재생성 명령은 `python3 assets/tools/build_clay_parts.py`입니다.

## 조립

`appearanceIds`는 직원 8명과 재킷·넥타이를 착용한 관리자 2명입니다. 외형별 폴더에 head, face-{working,phone,sleeping,away,idle}, hair, body, arm-upper/lower-l/r, hand-l/r, leg-l/r, leg-seated-l/r가 있습니다. 각 파일의 `viewBox` 원점을 이미지 좌상단으로 착각하지 마세요. 파츠를 로컬 좌표로 그릴 때 각도 변환은 반드시 메타데이터의 pivot 주위에서 수행합니다. 캔버스의 이미지 좌표계로 바꿀 때는 `(pivot.x-viewBox[0], pivot.y-viewBox[1])`입니다.

부모와 부착 오프셋은 `rig`에 정의했습니다. body 원점 `(0,0)`에서 머리는 `(0,-42)`, 좌우 어깨는 `(±22,-15)`, 엉덩이는 `(±12,35)`입니다. 팔꿈치는 상완 기준 `(±21,20)`, 손은 하완 기준 `(±13,18)`입니다. 오프셋은 부모 좌표계의 pivot 간 거리입니다. 앉아 있을 때는 `leg-seated-*`를 `leg-*`와 같은 관절에 대체합니다. 시안 대비 캐릭터의 크기는 동일한 책상에서 **1.3배**를 권장합니다. `drawOrder`는 캐릭터 내부의 순서입니다.

장면 레이어는 바닥 → 벽 → 뒤쪽 가구 → 의자 → 캐릭터 → 책상 → 모니터 → 이펙트 → 이름표입니다. 머리·몸통이 책상 위에 드러나도록 캐릭터 원점을 책상 뒤쪽에 배치합니다. 가구의 `floorContact`와 선택적인 `seat`는 SVG 좌표계 기준입니다. 유리 관리자실은 back과 front를 별도로 그립니다. desk-front/back은 양쪽을 향한 섬 배치를 위한 좌석 위치와 서랍 방향이 다릅니다. 앞뒤 배치 시 모니터 화면이 보여야 하면 `monitor-screen.svg`를 사용하고, 관객 쪽 모니터 뒷면에는 provider 아이콘이 표시된 파일을 사용합니다.

## 시간 기반 애니메이션 권장값

`t`는 초, 각도는 도입니다. 주기 함수는 결정적으로 계산하고 프레임 시간 누적에 의존하지 않습니다. `sin` 인자는 라디안입니다.

| 상태 | 관절과 위치 | 부가 효과 |
| --- | --- | --- |
| working | 몸 x=`2 sin(2πt/.2)`, 머리 회전=`3 sin(2πt/.4)`, 좌/우 상완 회전=`±18 sin(2πt/.30)` | 김은 1.3초 동안 위로 15 이동하며 사라짐, 땀 1초, 종이 1.4초, `!!` 간헐 표시 |
| phone | 머리 +12°, 오른쪽 상완 -160°, 하완 +75° | 폰과 phone-glow를 손과 얼굴 사이에 배치 |
| sleeping | 머리 `(14,21)` 이동 후 +65°, 몸 +25°, 접힌 팔을 책상 높이에 배치 | Zzz는 1.5초 주기 위아래 6 이동 |
| away | `phase=t%14`; 0–2.1초 첫 경유점, 2.1–4.2초 목적지, 4.2–9.1초 정지, 9.1–14초 역순 복귀. 걷는 동안 팔·다리 `±25 sin(2πt/.35)` | 경로는 탕비 코너나 소파를 향해 통로를 따라 계산 |
| idle | 호흡 `1.5 sin(2πt/2.5)` 세로 이동 | 기본 표정 |
| needsAttention | 기존 상태 유지 | attention을 머리 위에 별도 표시 |

렌더러는 수면 팔 접기, 폰, 이동 경로와 상태 효과를 위 규칙에 따라 조립해야 합니다. 개별 SVG는 상태 전환이나 이동을 스스로 수행하지 않습니다. `preview.html`은 파츠 조립 예시이며 장면 전체 구현은 아닙니다. 애니메이션 파츠에는 `feTurbulence`를 사용하지 않습니다. 정적 질감 역시 생략하여 저사양 패널 비용을 줄였습니다.

## 프로바이더

`claude`, `codex`, `antigravity`, `copilot`, `muse`, `opencode`는 `monitors/monitor-{provider}.svg`, `gemini`는 `monitor-antigravity.svg`, 나머지는 `monitor-unknown.svg`입니다. 원본 아이콘은 Paseo 앱에 포함된 벡터를 사용합니다.

## 방 크기 시작값

SVG 단위를 기준으로 Solo는 최소 400×300, 관리자+2는 700×500, 관리자+6은 1100×850을 권장합니다. 그룹은 상단 유리 관리자실과 직원 섬(4개 마주보기)을 확보하고, 추가 직원은 2명 단위 창가 자리를 추가하세요. 6명 이상이면 소파와 회의 테이블을 넣고, 인접 좌석 및 이동 통로에 적어도 캐릭터 너비(약 90 단위)를 남깁니다. 실제 레이아웃은 scene에서 뷰포트 폭에 맞게 축소합니다.

## 뒷모습 파츠

각 외형의 `head-back`, `hair-back`, `body-back`, `arm-upper-{l,r}-back`, `arm-lower-{l,r}-back`을 사용합니다. `manifest.json`의 `backRig`와 `backDrawOrder`에 부모와 오프셋을 명시했으며 기존 손·다리 파츠를 공유합니다. `furniture/chair-back.svg`는 뒷모습 캐릭터의 허리 앞쪽 레이어에 놓습니다. 작업 중에는 어깨를 위아래로 움직이고, phone은 머리를 앞으로 숙이며, sleeping은 몸통을 앞으로 낮추고 `effects/zzz.svg`를 머리 위에 놓습니다. 이 자세는 scene이 시간과 상태에 따라 계산합니다.

뒷모습까지 재생성할 때는 `python3 assets/tools/build_clay_parts.py` 다음에 `python3 assets/clay/build_back.py`를 실행하세요. 두 번째 스크립트가 뒷모습 파일·매니페스트 항목·미리보기 행을 추가합니다.
