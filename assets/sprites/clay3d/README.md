# 클레이 3D 벡터 자산

승인된 `assets/mockups/v6/02-clay3d/index.html`의 직접 그린 SVG를 추출한 자산입니다. PNG 픽셀 시트가 아니며 기존 `assets/sprites/manifest.json`과 별도로 관리합니다. `node assets/tools/build_clay3d.cjs`로 재생성합니다. `manifest.json`은 이 디렉터리 기준 파일 목록을 담습니다.

- `characters/{agent-01…agent-09,manager-01,manager-02}/{working,away,phone,sleeping}.svg`: 11가지 외형, 네 상태. SVG viewBox는 `-90 -115 180 205`이고 캐릭터 리그 원점은 `(0,0)`입니다. 기존 시안의 책상 기준으로 캐릭터 원점은 좌석 원점보다 20단위 위입니다. 관리자용 옷은 차분한 남색입니다.
- `furniture/`: 일반·관리자 책상, 의자, 유리 칸막이, 회의 테이블, 소파, 화분, 탕비 코너, 벽 소품 및 실제 프로바이더 아이콘을 포함한 모니터. `gemini`는 `monitor-antigravity.svg`, 지원하지 않는 값은 `monitor-unknown.svg`를 사용합니다.
- `effects/attention.svg`: 물음표 오버레이. 캐릭터와 같은 리그 원점에 맞추려면 오버레이 viewBox의 원점에 주의하세요.
- 상태별 캐릭터에는 시안의 CSS 팔·머리·수면 효과가 포함되어 있습니다. `away`의 팔·다리 동작은 포함하지만 이동 경로는 포함하지 않습니다. scene에서 의자를 비우고 통로를 따라 위치를 바꾼 뒤 목적지에서 머물게 해야 합니다.
- 권장 레이어: 바닥 → 벽·뒤 가구 → 의자 → 캐릭터 → 책상 → 모니터 → 효과 → 이름표. 방 크기·위치, 유리실 레이아웃, 이름표, 클릭 판정과 화면 폭 제한은 scene에서 담당합니다.

**연결 주의:** 기존 scene은 픽셀 PNG와 프레임 메타데이터를 읽고 Canvas에 그립니다. 이 SVG 파일은 기존 PNG와 호환되지 않습니다. Canvas의 `drawImage`에 이미지로 넘겼을 때 SVG 내부 CSS 애니메이션은 브라우저에 따라 재생되지 않을 수 있습니다. 안정적인 재생을 위해 scene에서 리그를 직접 렌더링하거나 상태와 시간에 따른 프레임을 별도 생성해야 합니다. 이 자산을 추가하는 것만으로 플러그인 화면이 바뀌지는 않습니다.

프로바이더 아이콘은 Paseo 앱에 포함된 원본 SVG를 사용했으며 각 소유자의 상표입니다. 다른 클레이 일러스트는 이 프로젝트에서 직접 그렸습니다.
