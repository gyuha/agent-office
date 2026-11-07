# Agent Office v10 — office-c 기반 모듈형 개발실

**현재 UI 수정본:** 「상단 작업 정보·책상 명판」 절을 우선합니다. 책상·모니터 그림, 방 크기·배치·포즈는 그대로이며, 상단은 작업 정보로 교체하고 하단 HUD는 제거했습니다.

[로컬 실행](index.html) · [원본과 6명 화면 비교](compare-6.png) · [기계 판독 규격](layout.json)

## 제작 원칙과 범위

모든 장면·책상·캐릭터·효과·HUD 그림은 **Codex 내장 image_gen**으로 생성했고, 모든 호출에 `assets/mockups/v8/office-c.png`를 참조 이미지로 입력했습니다. 특정 기존 게임이나 개발사 이름을 프롬프트에 넣지 않았습니다. 원본 고해상도 픽셀 일러스트의 따뜻한 햇빛·목재·식물·큰 얼굴을 유지하는 것이 우선입니다.

직접 다시 그리기, 팔레트 양자화, 16px 격자 축소, nearest 확대, pixelated 강제를 사용하지 않았습니다. 후처리는 생성 시트의 프레임 자르기·투명 여백 정렬·책상 앞 가림 레이어 분리뿐입니다. 브라우저가 화면 크기에 맞춰 부드럽게 축소합니다. v9의 그림은 하나도 사용하지 않았고 인원별 열 수·상태 제어·왕복 이동의 구조만 새 코드에 반영했습니다. v9 및 프로젝트 실행 코드는 수정하지 않았습니다.

`source/`에는 수정하지 않은 생성 원본 13장이 있습니다. `source/bg-large.png`는 바닥에 원치 않은 책상이 생성된 초기 결과이며 실행에는 쓰지 않습니다. `source/bg-large-final.png`는 office-c와 초기 배경 두 장을 입력해 작은 책상만 제거한 최종본입니다. 생성 프롬프트·참조 경로와 원본 위치는 prompts.json에도 기록했습니다.

## 단일 방과 배치 규칙

별도 관리자실이나 칸막이가 없습니다. 큰 관리자 책상은 같은 방의 뒷벽 중앙에 있고, 소파·침대·러그는 왼쪽 가장자리에 있습니다. 배경 자체에 창문·블라인드·식물·화이트보드·책장을 포함합니다. 인원별 배경은 소형(1~3), 중형(4~6), 대형(7~16)입니다.

```
columns = N <= 3 ? N : N <= 6 ? 3 : 4
rows = ceil(N / columns)
N <= 6: world = 1536 × 1024, podWidth = 310
N > 6:  world = 1536 × 1536, podWidth = 258
N <= 6: podLeft(i) = 350 + (i % columns) * 380
N > 6:  podLeft(i) = 340 + (i % 4) * 286
N <= 3: podTop(i) = 610
4..6:   podTop(i) = 450 + floor(i/3) * 275
7..16:  podTop(i) = 500 + floor(i/4) * 260
podHeight = podWidth * nativePodHeight / nativePodWidth
actorSeat = [podLeft + podWidth*0.27, podTop + podWidth*0.61]
actorHeight = N <= 6 ? 240 : 200
```

| N | 열×행 | 배경 | 월드 |
| --- | --- | --- | --- |
| 3 | 3×1 | small | 1536×1024 |
| 6 | 3×2 | medium | 1536×1024 |
| 10 | 4×3 | large | 1536×1536 |
| 16 | 4×4 | large | 1536×1536 |

배경은 원본 비율을 유지합니다. small/medium 생성 결과는 모두 1536×1024이고, large는 1254×1254를 1536 정사각형으로 표시합니다. medium에 1536×1280을 요청했으나 생성 결과가 1536×1024여서 세로로 늘이지 않았습니다. 인원이 많아질 때는 대형 배경을 선택합니다.

## 부품 크기·기준점

모든 자산은 parts/ 아래 PNG입니다. 좌표는 고해상도 이미지 픽셀 단위이며 논리 타일 제한이 없습니다. 크기와 원본 절단 사각형은 layout.json에 있습니다. 아래는 실행에서 사용하는 주요 자산입니다. 중복된 개별 포즈 PNG는 이름 규칙으로 묶었습니다.

| 자산 | 원본 크기 | 기준점·용도 |
| --- | --- | --- |
| `parts/background-small.png` | 1536×1024 | 좌상단, 월드 배경 |
| `parts/lead-front-small.png` | 520×153 | sourceBox의 월드 위치, 관리자 책상 가림 |
| `parts/background-medium.png` | 1536×1024 | 좌상단, 월드 배경 |
| `parts/lead-front-medium.png` | 498×134 | sourceBox의 월드 위치, 관리자 책상 가림 |
| `parts/background-large.png` | 1254×1254 | 좌상단, 월드 배경 |
| `parts/lead-front-large.png` | 453×133 | sourceBox의 월드 위치, 관리자 책상 가림 |
| `parts/pod-0-back.png` | 479×365 | 좌상단, 같은 pod 사각형으로 배치 |
| `parts/pod-0-front.png` | 479×365 | 좌상단, 같은 pod 사각형으로 배치 |
| `parts/pod-1-back.png` | 475×369 | 좌상단, 같은 pod 사각형으로 배치 |
| `parts/pod-1-front.png` | 475×369 | 좌상단, 같은 pod 사각형으로 배치 |
| `parts/pod-2-back.png` | 482×369 | 좌상단, 같은 pod 사각형으로 배치 |
| `parts/pod-2-front.png` | 482×369 | 좌상단, 같은 pod 사각형으로 배치 |
| `parts/actor-0-sheet.png` | 1280×1296 | 프레임 [160,410] 발 기준 |
| `parts/actor-1-sheet.png` | 1280×1296 | 프레임 [160,410] 발 기준 |
| `parts/actor-2-sheet.png` | 1280×1296 | 프레임 [160,410] 발 기준 |
| `parts/actor-3-sheet.png` | 1280×1296 | 프레임 [160,410] 발 기준 |
| `parts/actor-4-sheet.png` | 1280×1296 | 프레임 [160,410] 발 기준 |
| `parts/actor-5-sheet.png` | 1280×1296 | 프레임 [160,410] 발 기준 |
| `parts/actor-lead-sheet.png` | 1280×1296 | 프레임 [160,410] 발 기준 |
| `parts/flame-0.png` | 305×226 | 좌상단, 효과/HUD 배치 |
| `parts/flame-1.png` | 316×261 | 좌상단, 효과/HUD 배치 |
| `parts/flame-2.png` | 351×278 | 좌상단, 효과/HUD 배치 |
| `parts/emphasis.png` | 243×165 | 좌상단, 효과/HUD 배치 |
| `parts/points-3.png` | 244×210 | 좌상단, 효과/HUD 배치 |
| `parts/points-10.png` | 271×210 | 좌상단, 효과/HUD 배치 |
| `parts/bubble-done.png` | 301×210 | 좌상단, 효과/HUD 배치 |
| `parts/bubble-pr.png` | 319×210 | 좌상단, 효과/HUD 배치 |
| `parts/zzz.png` | 255×205 | 좌상단, 효과/HUD 배치 |
| `parts/hud-panel.png` | 352×159 | 좌상단, 효과/HUD 배치 |
| `parts/icon-active.png` | 276×172 | 좌상단, 효과/HUD 배치 |
| `parts/icon-tokens.png` | 206×210 | 좌상단, 효과/HUD 배치 |

- `pod-{0..2}-back.png`는 생성된 책상·모니터·의자·컵·책·식물 전체입니다. 각각 초록·파랑·자두 의자를 사용하여 claude/codex/gemini를 작게 구별합니다. 이름은 앞면 나무 판 중앙의 HTML 명판으로 표시하며, provider는 작은 색 점으로 함께 구별합니다.
- `pod-{0..2}-front.png`는 같은 생성본에서 왼쪽 위 53%×40% 영역의 알파만 분리한 가림 레이어입니다. 의자 뒤에 캐릭터를 앉히고 책상 앞면·오른쪽 모니터를 다시 얹기 위한 자산입니다. 나머지 이미지 색·디테일은 그대로입니다.
- 관리자는 배경의 큰 나무 책상을 사용합니다. 발 기준점과 표시 높이는 small=[778,342]/230, medium=[785,340]/220, large=[800,385]/230입니다. `lead-front-*`는 그 배경 책상의 앞 부분을 자른 PNG로 뒤쪽 큰 책상 위에 앉는 문제를 막습니다.
- 상단 HUD는 생성된 남색·크림 테두리 패널을 border-image로 유지하고 PROJECT / WORKSPACE / AGENT를 HTML 텍스트로 표시합니다. 데이터 원본은 scene.js 상단 `const header` 객체 하나이며 `window.setOfficeHeader({project,workspace,agent})`로 갱신할 수 있습니다. 기존 날짜·통계와 하단 HUD는 제거했습니다.

## 캐릭터 시트

- 외형 0: 갈색 헝클어진 머리·빨간 후드. 1: 포니테일·헤드폰·크림 후드. 2: 검은 머리·둥근 안경·파란 셔츠. 3: 분홍 단발·자두 가디건. 4: 금발·세이지 비니·짙은 후드. 5: 곱슬 갈색 머리·머스터드 스웨터. lead: 흰 머리·검은 안경·남색 조끼.
- 외형별 생성 시트 안에 같은 인물의 12포즈를 함께 요청했습니다. 원본 생성 결과는 1254×1254, 4열×3행입니다. 경계는 width/4와 height/3을 반올림해 자릅니다. 주요 알파 연결 영역의 바운딩 박스를 기준으로 투명 여백을 잘라 **그림을 리샘플링하지 않고** 320×432 프레임에 패딩 정렬합니다.
- 발 기준점 **[160,410]**, 조립 시트 1280×1296, 4열×3행입니다. 한 외형의 얼굴·헤어·복장은 모든 프레임에서 유지됩니다. pose별 작은 표정·손 차이는 생성 원본을 사용합니다.

| 행 | 열 0 | 열 1 | 열 2 | 열 3 |
| --- | --- | --- | --- | --- |
| 0 | working 0 | working 1 | working 2 | working 3 |
| 1 | phone 0 | phone 1 | sleeping 0 | sleeping 1 |
| 2 | walking-left 0 | walking-left 1 | walking-right 0 | walking-right 1 |

- 프레임 속도: working 6fps, phone 2.5fps, sleeping 1fps, walking 6fps. 좌우 각각 2프레임입니다. 이동의 y 성분이 있을 때도 좌우 걷기 그림을 쓰며 4방향 전용 그림은 아직 없습니다.
- 시트 이름 `actor-{0..5|lead}-sheet.png`. 개별 프레임 이름 `actor-{id}-{working-0..3|phone-0..1|sleeping-0..1|walking-left-0..1|walking-right-0..1}.png`.
- generated `flame-{0..2}`, `points-{3|10}`, `bubble-{done|pr}`, `zzz`, `emphasis`가 분리되어 있습니다. 불꽃은 5fps, 숫자는 1.5초 상승·페이드, 말풍선은 약 1.3초 표시합니다.

## 그리기 순서

1. 인물이 없는 생성 배경.
2. 관리자 캐릭터 → 배경에서 추출한 관리자 책상 앞 → 상체/손 복원 클립.
3. pod와 보행 캐릭터를 발의 y 좌표로 정렬합니다.
4. pod 전체(의자 포함) → 초집중 불꽃 → 캐릭터 포즈 → pod 앞/모니터 가림 → 생성 캐릭터 상체·손 클립. 이 클립은 전화기와 손이 책상에 가려지지 않도록 하며, 새 손을 그리는 방식이 아닙니다.
5. 숫자·완료·수면 말풍선. 다른 pod와 겹치는 완료 말풍선은 생략합니다.
6. 상단 작업 정보·책상 명판·상태 툴팁은 HTML UI입니다.

## 상태 제어와 이동

- 3/6/10/16 버튼, 1~16 선택, 각 인물과 관리자의 자동/작업/휴대폰/수면 제어를 제공합니다. 상태 컨트롤은 번호를 유지하고 실제 이름은 책상 앞면 명판에 표시합니다. 인물 hover 툴팁은 현재 상태만 보여 줍니다.
- 0번 자동 데모: 0~3초 working → 3~5초 phone → 5~7초 sleeping → 7~12초 working. 0.35초 포즈 크로스페이드입니다.
- 수동 phone이 12초 이상 지속되면 sleeping으로 바뀝니다. 수면은 자기 자리에서 엎드리며 침대까지 이동해 눕는 동작은 아직 없습니다.
- 처음 10초는 착석 상태를 보여줍니다. 이후 16초 주기에서 (2+주기번호)%N 인물 한 명만 방문합니다. 4~7초에 이동, 7~8초 방문, 8~11초 복귀입니다. 자리 → 자기 줄 아래 → 오른쪽 통로 → 뒤쪽 만남 통로 → 관리자/화이트보드 인근 방문점 순서입니다. 돌아올 때는 역순입니다.
- 현재 위치가 경로상 목표를 최대 500px/s로 따라가므로 상태 변경에도 순간이동하지 않고 복귀합니다. walking 이미지는 착석 이미지 높이의 80%로 보여 발 기준 깊이감을 맞췄습니다. 오른쪽 통로는 월드 우측 경계에서 최소 80px를 남깁니다.
- 900px에서도 페이지 전체를 부드럽게 줄여 보여주며 인원별 상태 컨트롤은 줄바꿈합니다. 모든 구성은 file://에서 외부 요청 없이 실행됩니다.

## office-c와 아직 다른 점·한계

- 전체 색감·창문·식물·나무 질감은 같은 계열이지만 **동일한 원화의 분리판은 아닙니다**. 재생성된 인물은 눈과 얼굴이 조금 더 둥글고, 책상·의자의 음영은 원본보다 부드럽습니다.
- 규칙적인 격자로 조립하므로 office-c의 자연스러운 비대칭 배치와 뒤섞인 생활감은 줄어듭니다. 한 방·뒤쪽 중앙 관리자는 사용자 요청을 따른 구조 변경입니다.
- HUD 문자는 HTML monospace여서 원본의 커스텀 픽셀 글꼴과 정확히 같지 않고, 아이콘 종류도 단순화했습니다. manager는 원본과 같은 흰 머리·안경 느낌이지만 정확히 같은 얼굴의 복제는 아닙니다.
- 일부 포즈는 몸통 깊이·손 위치에 미세한 흔들림이 남으며 책상 접점은 클립 기반입니다. 실제 플러그인 통합 전에는 포즈별 손 기준점과 occlusion mask를 더 정밀하게 조정하는 것이 좋습니다.
- 방문 경로는 고정 통로와 단일 방문 슬롯을 쓰며 일반적인 충돌 회피·임의 가구 재배치는 구현하지 않았습니다. 시안의 목업 지표는 실제 에이전트 데이터와 연결되어 있지 않습니다.
- large 배경을 고해상도로 균등 확대하고 화면 전체를 축소하므로 원본의 픽셀 경계를 그대로 보존하는 게임 엔진 렌더링과는 차이가 있습니다. 이번에는 그림체를 우선했습니다.

## 생성 프롬프트 원문

모든 항목의 참조 이미지 1은 `assets/mockups/v8/office-c.png`입니다. bg-large-final에만 참조 이미지 2로 초기 대형 배경을 추가했습니다. 아래는 실제 호출에 전달한 원문입니다.

### bg-small

```text
Use the attached image as the binding art-direction reference. This is our own original artwork. Preserve its soft high-resolution pixel illustration, rich tiny details, big expressive round faces, 2-to-3-head proportions, warm sunlight, honey wood, sage plants, cream highlights, dark navy/plum outlines and consistent line weight. Do not simplify to low-resolution blocks, do not limit the palette, do not imitate any named game. No logos, trademarks or watermarks. Original modular asset for the same office. Generate a 1536x1024 empty single-room office background plate, NO PEOPLE, NO speech bubbles, NO HUD, NO text. Three-quarter overhead camera like the reference, straight horizontal back wall. ONE continuous open room, absolutely no interior divider or separate manager room. Back wall: broad windows with blinds and hanging plants, a whiteboard, bookcases at edges. One large premium wooden orchestrator desk centered at the BACK wall, facing toward the foreground workers, with lamp, books, mug and a small monitor offset to the right; empty chair behind it. The front edge of this rear desk should finish near 35% image height. Cozy sofa, patterned rug, small bed and coffee table confined to the FAR LEFT edge/corner. Keep the entire central and right floor from 42% to 92% image height empty, warm birch floor tiles ready for a grid of six modular desk pods. Furniture must not intrude into this build area. Same warmth and detailed decorative density as reference around edges.
```

### bg-medium

```text
Use the attached image as the binding art-direction reference. This is our own original artwork. Preserve its soft high-resolution pixel illustration, rich tiny details, big expressive round faces, 2-to-3-head proportions, warm sunlight, honey wood, sage plants, cream highlights, dark navy/plum outlines and consistent line weight. Do not simplify to low-resolution blocks, do not limit the palette, do not imitate any named game. No logos, trademarks or watermarks. Original modular asset for the same office. Generate a 1536x1280 empty SINGLE open office background plate for ten desks, NO people, NO speech bubbles, NO HUD, NO text. Three-quarter overhead camera, horizontal back wall. Absolutely no room dividers or separate manager room. Windows, blinds, hanging plants, whiteboard and edge bookshelves along rear wall. A single large wooden orchestrator desk centered at rear, empty chair, lamp, books, mug, monitor on right; its front edge finishes near 26% height. Sofa, small rest bed, ornate rug and coffee table confined to far left edge/corner. Large empty warm wooden tiled floor from 34% to 93% height in the center/right, ready for four columns and three rows of modular desk pods. Same decorative richness and cozy sunlit illustration quality as reference.
```

### bg-large

```text
Use the attached image as the binding art-direction reference. This is our own original artwork. Preserve its soft high-resolution pixel illustration, rich tiny details, big expressive round faces, 2-to-3-head proportions, warm sunlight, honey wood, sage plants, cream highlights, dark navy/plum outlines and consistent line weight. Do not simplify to low-resolution blocks, do not limit the palette, do not imitate any named game. No logos, trademarks or watermarks. Original modular asset for the same office. Generate a 1536x1536 square empty SINGLE open office background plate for sixteen desks, NO people, NO speech bubbles, NO HUD, NO text. Three-quarter overhead camera, horizontal back wall, no partitions and no separate manager room. Windows, blinds, hanging plants, whiteboard, edge bookshelves along rear wall. Large wooden orchestrator desk centered at back, empty chair, lamp, books, mug, right-offset monitor; desk front edge finishes near 23% height. Sofa, small bed, patterned rug and coffee table only in far LEFT edge/corner, at most 17% image width. Central/right floor from 30% to 94% image height is empty warm birch tiles for a 4x4 desk pod grid. Rich warm sunlit details at room edges like reference; maintain a sensible projection without extreme foreshortening.
```

### pods

```text
Use the attached image as the binding art-direction reference. This is our own original artwork. Preserve its soft high-resolution pixel illustration, rich tiny details, big expressive round faces, 2-to-3-head proportions, warm sunlight, honey wood, sage plants, cream highlights, dark navy/plum outlines and consistent line weight. Do not simplify to low-resolution blocks, do not limit the palette, do not imitate any named game. No logos, trademarks or watermarks. Original modular asset for the same office. Generate a transparent-background modular furniture sprite sheet, 1536x1024, THREE columns and ONE row of three isolated desk pods. Equal column width 512 pixels, each complete pod centered in its column with transparent margins; no object crosses a column boundary. NO people, NO words, NO UI, NO floor tile or room. Each pod is the same size and same three-quarter overhead projection as the employee desks in the reference. Include wooden work desk with front drawers and legs, padded swivel chair BEHIND the desk at the left-center seat, keyboard on desk in front of that seat, monitor offset to the RIGHT so a separate character face at the left-center remains readable. Small mug, books and small plant at edges. Variant1 cream CRT with teal chair, variant2 dark LCD with blue chair, variant3 dark LCD with plum chair. Detailed warm wood texture and soft high-resolution pixel shading matching the reference exactly. Each desk pod has a clear top surface and front face and a believable empty character slot. Keep the desktop horizontal level consistent across the three variants. Genuine transparent alpha, not a checkerboard drawing.
```

### effects-hud

```text
Use the attached image as the binding art-direction reference. This is our own original artwork. Preserve its soft high-resolution pixel illustration, rich tiny details, big expressive round faces, 2-to-3-head proportions, warm sunlight, honey wood, sage plants, cream highlights, dark navy/plum outlines and consistent line weight. Do not simplify to low-resolution blocks, do not limit the palette, do not imitate any named game. No logos, trademarks or watermarks. Original modular asset for the same office. Generate a transparent asset atlas, 1536x1024, strict 4 columns by 3 rows of equal 384x341 cells, clean transparent gutters, no labels outside artwork, nothing crossing cell edges. Match the reference speech balloons and fire exactly in aesthetic, dark navy pixel outlines, creamy paper interiors, chunky readable lettering. Row 1 cells: fire aura frame A, fire aura frame B, fire aura frame C, yellow exclamation emphasis marks (!). Auras must be hollow U-shaped around a transparent character-sized central opening. Row 2 cells: separate white speech balloon '+3', balloon '+10', balloon 'Done!', balloon 'PR up!'. Row 3 cells: white 'Zzz' balloon; a plain blank navy HUD panel with cream/gold pixel border and no text filling its own cell; an isolated green three-person group metric icon; an isolated mint layered-stack token icon. Center each object within its cell, generous margins. No people, no furniture, no other text, no logos. True transparent alpha.
```

### actor-0

```text
Use the attached image as the binding art-direction reference. This is our own original artwork. Preserve its soft high-resolution pixel illustration, rich tiny details, big expressive round faces, 2-to-3-head proportions, warm sunlight, honey wood, sage plants, cream highlights, dark navy/plum outlines and consistent line weight. Do not simplify to low-resolution blocks, do not limit the palette, do not imitate any named game. No logos, trademarks or watermarks. Original modular asset for the same office. Generate a true-transparent character animation sheet, 1536x1536, STRICT 4 columns x 3 rows = 12 equal 384x512 cells. ONE same consistent character repeated twelve times with identical face, hairstyle, outfit and proportions. Center character in each cell, ample transparent gutters, no frame crosses a cell boundary. No chairs, desks, monitors, keyboard, floor, scenery, labels or words. All sitting poses have bent legs, hands in front, body facing three-quarter toward the viewer and slightly right. Match the cute big face and detailed soft pixel shading of the reference employees, not tiny block sprites. Every character is full body with clear hands and feet, consistent scale, head size and foot baseline in all cells. Row1: four consecutive typing sitting poses, subtle alternating fingers/wrists (type on an invisible keyboard). Row2: phone sitting pose A, phone sitting pose B (same smartphone with subtle scrolling finger motion), sleeping slumped seated pose A, sleeping slumped pose B (eyes closed, head on folded arms, invisible tabletop; do not draw tabletop). Row3: walking LEFT step A, walking LEFT step B, walking RIGHT step A, walking RIGHT step B. Fully side-facing walk directions, alternating leg positions. No props except phone in the two phone frames. Character identity: short tousled dark-brown hair, red hoodie, round cheerful face, no glasses. Preserve this exact identity in all 12 cells. Genuine transparent alpha.
```

### actor-1

```text
Use the attached image as the binding art-direction reference. This is our own original artwork. Preserve its soft high-resolution pixel illustration, rich tiny details, big expressive round faces, 2-to-3-head proportions, warm sunlight, honey wood, sage plants, cream highlights, dark navy/plum outlines and consistent line weight. Do not simplify to low-resolution blocks, do not limit the palette, do not imitate any named game. No logos, trademarks or watermarks. Original modular asset for the same office. Generate a true-transparent character animation sheet, 1536x1536, STRICT 4 columns x 3 rows = 12 equal 384x512 cells. ONE same consistent character repeated twelve times with identical face, hairstyle, outfit and proportions. Center character in each cell, ample transparent gutters, no frame crosses a cell boundary. No chairs, desks, monitors, keyboard, floor, scenery, labels or words. All sitting poses have bent legs, hands in front, body facing three-quarter toward the viewer and slightly right. Match the cute big face and detailed soft pixel shading of the reference employees, not tiny block sprites. Every character is full body with clear hands and feet, consistent scale, head size and foot baseline in all cells. Row1: four consecutive typing sitting poses, subtle alternating fingers/wrists (type on an invisible keyboard). Row2: phone sitting pose A, phone sitting pose B (same smartphone with subtle scrolling finger motion), sleeping slumped seated pose A, sleeping slumped pose B (eyes closed, head on folded arms, invisible tabletop; do not draw tabletop). Row3: walking LEFT step A, walking LEFT step B, walking RIGHT step A, walking RIGHT step B. Fully side-facing walk directions, alternating leg positions. No props except phone in the two phone frames. Character identity: brown ponytail, cream hoodie, large sage over-ear headphones. Preserve this exact identity in all 12 cells. Genuine transparent alpha.
```

### actor-2

```text
Use the attached image as the binding art-direction reference. This is our own original artwork. Preserve its soft high-resolution pixel illustration, rich tiny details, big expressive round faces, 2-to-3-head proportions, warm sunlight, honey wood, sage plants, cream highlights, dark navy/plum outlines and consistent line weight. Do not simplify to low-resolution blocks, do not limit the palette, do not imitate any named game. No logos, trademarks or watermarks. Original modular asset for the same office. Generate a true-transparent character animation sheet, 1536x1536, STRICT 4 columns x 3 rows = 12 equal 384x512 cells. ONE same consistent character repeated twelve times with identical face, hairstyle, outfit and proportions. Center character in each cell, ample transparent gutters, no frame crosses a cell boundary. No chairs, desks, monitors, keyboard, floor, scenery, labels or words. All sitting poses have bent legs, hands in front, body facing three-quarter toward the viewer and slightly right. Match the cute big face and detailed soft pixel shading of the reference employees, not tiny block sprites. Every character is full body with clear hands and feet, consistent scale, head size and foot baseline in all cells. Row1: four consecutive typing sitting poses, subtle alternating fingers/wrists (type on an invisible keyboard). Row2: phone sitting pose A, phone sitting pose B (same smartphone with subtle scrolling finger motion), sleeping slumped seated pose A, sleeping slumped pose B (eyes closed, head on folded arms, invisible tabletop; do not draw tabletop). Row3: walking LEFT step A, walking LEFT step B, walking RIGHT step A, walking RIGHT step B. Fully side-facing walk directions, alternating leg positions. No props except phone in the two phone frames. Character identity: short black hair, round dark glasses, pale blue shirt. Preserve this exact identity in all 12 cells. Genuine transparent alpha.
```

### actor-3

```text
Use the attached image as the binding art-direction reference. This is our own original artwork. Preserve its soft high-resolution pixel illustration, rich tiny details, big expressive round faces, 2-to-3-head proportions, warm sunlight, honey wood, sage plants, cream highlights, dark navy/plum outlines and consistent line weight. Do not simplify to low-resolution blocks, do not limit the palette, do not imitate any named game. No logos, trademarks or watermarks. Original modular asset for the same office. Generate a true-transparent character animation sheet, 1536x1536, STRICT 4 columns x 3 rows = 12 equal 384x512 cells. ONE same consistent character repeated twelve times with identical face, hairstyle, outfit and proportions. Center character in each cell, ample transparent gutters, no frame crosses a cell boundary. No chairs, desks, monitors, keyboard, floor, scenery, labels or words. All sitting poses have bent legs, hands in front, body facing three-quarter toward the viewer and slightly right. Match the cute big face and detailed soft pixel shading of the reference employees, not tiny block sprites. Every character is full body with clear hands and feet, consistent scale, head size and foot baseline in all cells. Row1: four consecutive typing sitting poses, subtle alternating fingers/wrists (type on an invisible keyboard). Row2: phone sitting pose A, phone sitting pose B (same smartphone with subtle scrolling finger motion), sleeping slumped seated pose A, sleeping slumped pose B (eyes closed, head on folded arms, invisible tabletop; do not draw tabletop). Row3: walking LEFT step A, walking LEFT step B, walking RIGHT step A, walking RIGHT step B. Fully side-facing walk directions, alternating leg positions. No props except phone in the two phone frames. Character identity: pink bob hairstyle, plum cardigan over white shirt. Preserve this exact identity in all 12 cells. Genuine transparent alpha.
```

### actor-4

```text
Use the attached image as the binding art-direction reference. This is our own original artwork. Preserve its soft high-resolution pixel illustration, rich tiny details, big expressive round faces, 2-to-3-head proportions, warm sunlight, honey wood, sage plants, cream highlights, dark navy/plum outlines and consistent line weight. Do not simplify to low-resolution blocks, do not limit the palette, do not imitate any named game. No logos, trademarks or watermarks. Original modular asset for the same office. Generate a true-transparent character animation sheet, 1536x1536, STRICT 4 columns x 3 rows = 12 equal 384x512 cells. ONE same consistent character repeated twelve times with identical face, hairstyle, outfit and proportions. Center character in each cell, ample transparent gutters, no frame crosses a cell boundary. No chairs, desks, monitors, keyboard, floor, scenery, labels or words. All sitting poses have bent legs, hands in front, body facing three-quarter toward the viewer and slightly right. Match the cute big face and detailed soft pixel shading of the reference employees, not tiny block sprites. Every character is full body with clear hands and feet, consistent scale, head size and foot baseline in all cells. Row1: four consecutive typing sitting poses, subtle alternating fingers/wrists (type on an invisible keyboard). Row2: phone sitting pose A, phone sitting pose B (same smartphone with subtle scrolling finger motion), sleeping slumped seated pose A, sleeping slumped pose B (eyes closed, head on folded arms, invisible tabletop; do not draw tabletop). Row3: walking LEFT step A, walking LEFT step B, walking RIGHT step A, walking RIGHT step B. Fully side-facing walk directions, alternating leg positions. No props except phone in the two phone frames. Character identity: blond side fringe, sage green knit beanie, charcoal hoodie. Preserve this exact identity in all 12 cells. Genuine transparent alpha.
```

### actor-5

```text
Use the attached image as the binding art-direction reference. This is our own original artwork. Preserve its soft high-resolution pixel illustration, rich tiny details, big expressive round faces, 2-to-3-head proportions, warm sunlight, honey wood, sage plants, cream highlights, dark navy/plum outlines and consistent line weight. Do not simplify to low-resolution blocks, do not limit the palette, do not imitate any named game. No logos, trademarks or watermarks. Original modular asset for the same office. Generate a true-transparent character animation sheet, 1536x1536, STRICT 4 columns x 3 rows = 12 equal 384x512 cells. ONE same consistent character repeated twelve times with identical face, hairstyle, outfit and proportions. Center character in each cell, ample transparent gutters, no frame crosses a cell boundary. No chairs, desks, monitors, keyboard, floor, scenery, labels or words. All sitting poses have bent legs, hands in front, body facing three-quarter toward the viewer and slightly right. Match the cute big face and detailed soft pixel shading of the reference employees, not tiny block sprites. Every character is full body with clear hands and feet, consistent scale, head size and foot baseline in all cells. Row1: four consecutive typing sitting poses, subtle alternating fingers/wrists (type on an invisible keyboard). Row2: phone sitting pose A, phone sitting pose B (same smartphone with subtle scrolling finger motion), sleeping slumped seated pose A, sleeping slumped pose B (eyes closed, head on folded arms, invisible tabletop; do not draw tabletop). Row3: walking LEFT step A, walking LEFT step B, walking RIGHT step A, walking RIGHT step B. Fully side-facing walk directions, alternating leg positions. No props except phone in the two phone frames. Character identity: curly dark auburn hair, warm mustard sweater, no glasses. Preserve this exact identity in all 12 cells. Genuine transparent alpha.
```

### actor-lead

```text
Use the attached image as the binding art-direction reference. This is our own original artwork. Preserve its soft high-resolution pixel illustration, rich tiny details, big expressive round faces, 2-to-3-head proportions, warm sunlight, honey wood, sage plants, cream highlights, dark navy/plum outlines and consistent line weight. Do not simplify to low-resolution blocks, do not limit the palette, do not imitate any named game. No logos, trademarks or watermarks. Original modular asset for the same office. Generate a true-transparent character animation sheet, 1536x1536, STRICT 4 columns x 3 rows = 12 equal 384x512 cells. ONE same consistent character repeated twelve times with identical face, hairstyle, outfit and proportions. Center character in each cell, ample transparent gutters, no frame crosses a cell boundary. No chairs, desks, monitors, keyboard, floor, scenery, labels or words. All sitting poses have bent legs, hands in front, body facing three-quarter toward the viewer and slightly right. Match the cute big face and detailed soft pixel shading of the reference employees, not tiny block sprites. Every character is full body with clear hands and feet, consistent scale, head size and foot baseline in all cells. Row1: four consecutive typing sitting poses, subtle alternating fingers/wrists (type on an invisible keyboard). Row2: phone sitting pose A, phone sitting pose B (same smartphone with subtle scrolling finger motion), sleeping slumped seated pose A, sleeping slumped pose B (eyes closed, head on folded arms, invisible tabletop; do not draw tabletop). Row3: walking LEFT step A, walking LEFT step B, walking RIGHT step A, walking RIGHT step B. Fully side-facing walk directions, alternating leg positions. No props except phone in the two phone frames. Character identity: white wavy hair, rectangular black glasses, dark navy vest and white shirt, distinguished friendly older orchestrator. Preserve this exact identity in all 12 cells. Genuine transparent alpha.
```

### bg-large-final

```text
Use the attached image as the binding art-direction reference. This is our own original artwork. Preserve its soft high-resolution pixel illustration, rich tiny details, big expressive round faces, 2-to-3-head proportions, warm sunlight, honey wood, sage plants, cream highlights, dark navy/plum outlines and consistent line weight. Do not simplify to low-resolution blocks, do not limit the palette, do not imitate any named game. No logos, trademarks or watermarks. Original modular asset for the same office. Image 1 is only the art-style reference (office-c). Image 2 is the background plate to correct. Edit Image 2: REMOVE all sixteen small employee desks, all books and little potted plants standing on those sixteen desks. Replace all their footprints with continuous EMPTY warm wooden floor matching the surrounding floor seamlessly. Preserve the rear large orchestrator desk, rear wall windows, shelves, sofa/bed on the far left edge, all room edge decoration, camera and lighting. No people. Absolutely ZERO employee desks or central-floor objects. The center/right floor below the rear manager desk must be completely vacant. No HUD, no text.
```

## 최종 검증 결과

2026-11-07, headless Chrome, file:// 직접 실행. 3/6/10/16명 모두 2.84초 이상 재생 후 캡처했고 콘솔·런타임 오류는 0건입니다. 각 캡처 및 compare-6.png를 직접 열어 확인했습니다. N=1~16의 desk pod 경계가 방 안에 있고 서로 겹치지 않는지도 계산 검사했습니다.

수동 phone→12초 후 sleeping, 자동 3·5·7초 상태 전환, 인원 버튼, 단일 방문 보행, hover 툴팁, setOfficeStats 값 갱신을 확인했습니다. 폭 900px에서 문서와 장면 폭은 885px로 가로 넘침 없이 축소됩니다. 상세 결과는 validation.json에 있습니다.

| 파일 | 크기 | 용량 |
| --- | --- | --- |
| `preview-10.png` | 1536×1704 | 3,204,285 B |
| `preview-16.png` | 1536×1704 | 3,403,917 B |
| `preview-3.png` | 1536×1192 | 2,412,532 B |
| `preview-6.png` | 1536×1192 | 2,669,695 B |
| `compare-6.png` | 3072×1192 | 5,095,437 B |

변경 범위: 이번 작업은 v10 내부뿐입니다. git status에 표시되는 v7·v8·v9 및 .agents/teams/orchestrator.json은 작업 시작부터 있던 변경이며 수정하지 않았습니다.

## 책상 앞판·모니터 방향 수정 (2026-11-07)

사용자 피드백에 따라 **두 항목만** 수정했습니다. desk pod 3종과 관리자 책상의 관객 쪽 면을 서랍·손잡이·내부 칸 나눔 없는 평평한 한 장의 나무 모데스티 패널로 바꾸고, CRT/LCD 모두 자리에 앉은 인물을 향하도록 돌려 관객에게는 케이스 뒤판·통풍구·스탠드·케이블만 보이게 했습니다. 모니터는 기존 오른쪽 위치를 유지해 얼굴을 가리지 않습니다.

수정은 Codex image_gen에 office-c와 기존 v10 pod를 참조로 넣어 생성했습니다. 관리자 책상은 해당 기존 배경도 추가 참조했습니다. 직접 그리기나 팔레트 축소는 하지 않았습니다. 재생성으로 무관한 영역이 변하지 않게, 생성 결과의 앞판과 모니터 영역만 원본에 합성했습니다. 방·소품 등 지정 영역 밖 픽셀은 기존 값을 유지하며 식물의 늘어진 잎도 보존합니다. 생성된 투명 자산의 부드러운 그림자는 기존 것을 유지합니다.

- 생성 원본: `source/pods-facing-inward.png`, `source/bg-small-desk-corrected.png`, `source/bg-medium-desk-corrected.png`, `source/bg-large-final-desk-corrected.png`.
- 수정 전 소스 보존: `source/before-desk-fix/`. 현재 `source/pods.png`와 배경 source 별칭은 필요한 부분만 합성한 실행용 소스입니다.
- 원문 프롬프트·참조 목록: `desk-fix-prompts.json`. 합성 영역: `desk-fix-regions.json`. 재현: `python3 assets/mockups/v10/correct_desks.py` 후 `python3 assets/mockups/v10/prepare_assets.py`.
- desk pod의 기존 sourceBox와 PNG 크기를 고정했습니다. 캐릭터 기준점·모듈 배치·앞뒤 그리기 순서는 바뀌지 않았고 layout.json 내용도 동일합니다.
- `scene.js`, `index.html`, layout JSON/JS, 캐릭터 원본·포즈·HUD·효과 등 보호 대상 113개 파일은 수정 전후 SHA-256이 동일합니다.

### 이번 수정의 생성 프롬프트 원문

#### pods-facing-inward

```text
Use image 1 (office-c) only as our own art-style reference. Image 2 is the current v10 pod reference; preserve its exact warm detailed high-resolution pixel illustration and material rendering. No palette reduction, no blocky redraw, no logos, no game or developer names. ONLY correct the desk anatomy and monitor direction. No changes to camera, dimensions, furniture locations, chair locations, object sizes, plants, books, mugs, pencil cups, lighting, shadows or unrelated detail. Image 2 is also the edit target. Edit this same 1536x1024 transparent three-column sprite atlas in place. Keep three complete isolated pods in the EXACT same pixel footprints, chair heights and desktop heights as image 2. On ALL THREE desks, replace the ENTIRE viewer-facing vertical apron below the desktop with ONE flat continuous wooden modesty board. Remove all drawers, handles, center vertical subdivision seams, inset panels, cabinet doors, shelves or open compartments. One wide uninterrupted wood-grain board with only its OUTER edge border and natural shading. Preserve the wooden legs, outer silhouette and desktop. On each desk turn the MONITOR on its stand so its screen faces the empty chair behind the desk, NOT the viewer. The viewer sees only the BACK CASE, vents, rear casing, stand and a short cable, absolutely no visible display, code, green lines or screen bezel. First pod is a beige CRT: show its bulky back shell, not its glass. Second and third are dark LCDs: rear flat cases facing viewer. Keep monitors on the RIGHT side of desktop so the future character face at the LEFT seat is unobstructed. Keep all three colored chairs and exact accessory variants. True transparent background, no new floor.
```

#### bg-small-desk-corrected

```text
Use image 1 (office-c) only as our own art-style reference. Image 2 is the current v10 pod reference; preserve its exact warm detailed high-resolution pixel illustration and material rendering. No palette reduction, no blocky redraw, no logos, no game or developer names. ONLY correct the desk anatomy and monitor direction. No changes to camera, dimensions, furniture locations, chair locations, object sizes, plants, books, mugs, pencil cups, lighting, shadows or unrelated detail. Image 3 is the EDIT TARGET: the existing empty single-room background. Preserve every pixel outside the central orchestrator desk as closely as possible, preserving exact room geometry and image dimensions. Edit ONLY the large central desk: its viewer-facing vertical front must become ONE wide flat uninterrupted wooden modesty panel. Remove ALL vertical inset-panel divider seams and any drawer/handle/cabinet features from that desk front; retain only outer perimeter trim, wood grain and the same soft shading. Keep desktop edge, lamp, books, mug, chair, monitor position and plants unchanged. Ensure the right-offset monitor presents ONLY its back case/vents, stand and cable toward the viewer, screen toward the empty chair. If already showing its back, preserve that direction. No text, no people, no HUD. No changes to the room, other furniture or floor. Keep original aspect ratio and resolution.
```

#### bg-medium-desk-corrected

```text
Use image 1 (office-c) only as our own art-style reference. Image 2 is the current v10 pod reference; preserve its exact warm detailed high-resolution pixel illustration and material rendering. No palette reduction, no blocky redraw, no logos, no game or developer names. ONLY correct the desk anatomy and monitor direction. No changes to camera, dimensions, furniture locations, chair locations, object sizes, plants, books, mugs, pencil cups, lighting, shadows or unrelated detail. Image 3 is the EDIT TARGET: the existing empty single-room background. Preserve every pixel outside the central orchestrator desk as closely as possible, preserving exact room geometry and image dimensions. Edit ONLY the large central desk: its viewer-facing vertical front must become ONE wide flat uninterrupted wooden modesty panel. Remove ALL vertical inset-panel divider seams and any drawer/handle/cabinet features from that desk front; retain only outer perimeter trim, wood grain and the same soft shading. Keep desktop edge, lamp, books, mug, chair, monitor position and plants unchanged. Ensure the right-offset monitor presents ONLY its back case/vents, stand and cable toward the viewer, screen toward the empty chair. If already showing its back, preserve that direction. No text, no people, no HUD. No changes to the room, other furniture or floor. Keep original aspect ratio and resolution.
```

#### bg-large-final-desk-corrected

```text
Use image 1 (office-c) only as our own art-style reference. Image 2 is the current v10 pod reference; preserve its exact warm detailed high-resolution pixel illustration and material rendering. No palette reduction, no blocky redraw, no logos, no game or developer names. ONLY correct the desk anatomy and monitor direction. No changes to camera, dimensions, furniture locations, chair locations, object sizes, plants, books, mugs, pencil cups, lighting, shadows or unrelated detail. Image 3 is the EDIT TARGET: the existing empty single-room background. Preserve every pixel outside the central orchestrator desk as closely as possible, preserving exact room geometry and image dimensions. Edit ONLY the large central desk: its viewer-facing vertical front must become ONE wide flat uninterrupted wooden modesty panel. Remove ALL vertical inset-panel divider seams and any drawer/handle/cabinet features from that desk front; retain only outer perimeter trim, wood grain and the same soft shading. Keep desktop edge, lamp, books, mug, chair, monitor position and plants unchanged. Ensure the right-offset monitor presents ONLY its back case/vents, stand and cable toward the viewer, screen toward the empty chair. If already showing its back, preserve that direction. No text, no people, no HUD. No changes to the room, other furniture or floor. Keep original aspect ratio and resolution.
```

### 책상 수정 후 검증

3/6/10/16명 화면을 약 2.9초 실행 후 preview 4개와 compare-6.png를 갱신했습니다. 콘솔·런타임 오류는 모두 0입니다. 각 최종 캡처에서 모든 desk pod와 관리자 책상의 평평한 앞판, CRT/LCD 뒤판, 인물 얼굴 가림 여부를 직접 확인했습니다. 배치·HUD·방 크기·포즈·캐릭터 기준점·그리기 순서는 그대로입니다.

| 파일 | 해상도 | 용량 |
| --- | --- | --- |
| `preview-3.png` | 1536×1192 | 2,408,093 B |
| `preview-6.png` | 1536×1192 | 2,666,124 B |
| `preview-10.png` | 1536×1704 | 3,206,716 B |
| `preview-16.png` | 1536×1704 | 3,405,974 B |
| `compare-6.png` | 3072×1192 | 5,092,808 B |

## 상단 작업 정보·책상 명판 (2026-11-07)

이번 수정은 상단바 내용 교체, 하단바 제거, 이름 명판 추가의 세 항목뿐입니다. desk pod·관리자 책상·모니터·캐릭터·효과 PNG와 방 크기·배치·포즈는 변경하지 않았습니다. layout.json 기존 필드는 유지하고 `ui` 필드만 추가했습니다. 자산 준비 스크립트도 이 UI 메타데이터를 보존합니다.

### 상단 데이터 형식

scene.js 상단의 단일 객체가 값의 원본입니다.

```js
const header = {
  project: 'agent-office',
  workspace: 'Greeting with no task specified',
  agent: 'Orchestrator'
};
```

각 값은 `textContent`로 렌더링하며 전체 값을 `title`에도 넣습니다. `setOfficeHeader({workspace:'새 워크스페이스'})`로 일부 값만 갱신할 수 있습니다. PROJECT / WORKSPACE / AGENT 라벨을 붙이고 남색·크림 패널과 굵은 monospace 글자를 유지했습니다. 기존 DAY/시간·ACTIVE·DONE은 없어졌습니다.

상단 열 비율은 데스크톱 1:1.8:1, 900px 이하 1:1.65:1.05입니다. 모든 열과 텍스트에 min-width:0을 적용하고 한 줄 nowrap, overflow:hidden, text-overflow:ellipsis로 말줄임합니다. 긴 값은 원문 title 툴팁으로 확인합니다. 값 글꼴은 900 굵기 monospace 25px, 900px 이하 18px, 550px 이하 12px입니다.

### 하단 제거

TOKENS / TESTS / LOCAL STUDIO HUD DOM을 완전히 제거했습니다. 별도 빈 공간을 두지 않아 방 이미지의 바닥이 장면의 맨 아래가 됩니다. 방 내부 해상도 1536×1024 또는 1536×1536은 그대로입니다. 기존 setOfficeStats API는 제거하고 setOfficeHeader로 대체했습니다.

### 이름 명판 규격

명판은 그림을 수정하지 않는 HTML overlay입니다. 평평한 나무 판 위에 황동 명판, 짙은 각인 글자와 작은 provider 색 점을 올립니다. 앞면의 중앙을 따라 배치하며 인물·모니터를 덮지 않습니다.

- 일반 pod 기준 중심: **[podLeft + podWidth×0.50, podTop + podHeight×0.80]**. 명판 폭은 podWidth×0.74. 명판 중심을 기준으로 translate(-50%,-50%)를 적용합니다.
- 관리자 명판 중심(월드 좌표): small=[805,358], medium=[798,324], large=[818,385]. 폭 240px. 내용은 Orchestrator입니다.
- 글꼴: 800 굵기 monospace, `clamp(12px,1.15vw,18px)`, line-height 1.35. 900px에서도 최소 12px, 550px 이하에서는 8px입니다. 짙은 갈색 글자와 밝은 1px 각인 그림자로 나무와 구별합니다.
- 이름 span은 한 줄·넘침 숨김·CSS 말줄임(…)이고, 전체 이름은 명판 title과 aria-label에 보존합니다. `setAgentName(0,'새 이름')`, 관리자일 때 `setAgentName('lead','Orchestrator')`로 동적 갱신합니다.
- 명판은 pod 위치에 고정되므로 인물이 방문 이동 중이어도 자기 책상의 이름이 유지됩니다. 기존 hover는 이름/provider 대신 작업 중·휴대폰 휴식·수면 중 상태만 표시합니다.

목업 이름(0~15):

```text
plugin#FDF9, scene#3C71, art#94A2, qa#0499,
review#A1C2, docs#7B10, infra#55E3, api#C0DE,
ui#5E19, perf#0F42, data#91AB, auth#3D7E,
ci#B8F0, search#64CA, mobile#E27D, ops#4A09
```

layout.json의 `ui.header`, `ui.bottomHud`, `ui.nameplates`, `ui.mockNames`에 같은 규칙을 기록했습니다.

### 작업 정보·명판 검증 결과

2026-11-07 headless Chrome에서 3/6/10/16명 각각 약 2.9초 재생 후 preview를 갱신했습니다. 900px 폭에서도 같은 네 인원을 2.6초 이상 재생 후 review/preview-{N}-900.png로 캡처하고 직접 확인했습니다. 모든 목업 이름이 잘림 없이 표시되고 상단 값·명판이 서로 겹치지 않습니다. 긴 임의의 workspace·에이전트 이름에서는 CSS 말줄임과 전체 값 title을 검사했습니다. 모든 실행에서 콘솔·런타임 오류 0건, 하단 통계 DOM 0개, 페이지 가로 넘침 0입니다.

원본 그림 136개 파일은 SHA-256 동일하며 기존 layout 필드는 그대로이고 ui 필드만 추가했습니다. 상세 결과는 validation.json의 headerAndNameplates에 있습니다.

| 캡처 | 해상도 | 용량 |
| --- | --- | --- |
| `preview-3.png` | 1536×1108 | 2,361,207 B |
| `preview-6.png` | 1536×1108 | 2,603,625 B |
| `preview-10.png` | 1536×1620 | 3,141,661 B |
| `preview-16.png` | 1536×1620 | 3,326,617 B |
