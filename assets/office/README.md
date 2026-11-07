# Agent Office — 플러그인용 오피스 에셋

[manifest.json](manifest.json) · [GIF 검토 갤러리](review/index.html) · [전체 contact sheet](review/contact-sheet.png)

## 전달 상태

1단계 임시 프레임을 2단계 생성 시트로 교체했습니다. 직원 외형 6종과 흰 머리·안경 관리자 모두 working / phone / sleeping / away / walk_left / walk_right를 갖습니다. 사용자 추가 요청으로 관리자 away·좌우 걷기 키를 1단계 계약에 보강했습니다. 이후 manifest의 키·구조·프레임 크기·fps·loop·기준점·매핑은 그대로이며 sheets의 frames만 갱신했습니다(file 경로도 유지).

모든 그림은 v10 또는 Codex 내장 image_gen의 참조 생성 결과입니다. 모든 새 생성 호출에 office-c와 해당 v10 캐릭터/효과 PNG를 입력하고 transparent_background=true를 사용했습니다. 직접 그림을 그리거나 런타임 도형 효과를 만들지 않았습니다. GIF 직접 생성 기능을 사용한 것이 아니라, 한 이미지에 가로 연속 프레임을 생성하고 잘라 PNG/WebP 시트를 만들었습니다.

- 런타임: **1,575,544 B**, runtimeScale=.625, q85입니다.
- 애니메이션/정적 효과 시트: **49개, 165프레임**. 검토 GIF 49개와 전체 contact sheet PNG 1장.
- 원본 PNG: src/v10/(정적/기존 포즈), src/generated/(최종 참조 생성 원본 40장), src/sheets/(정렬된 PNG 시트).

## manifest와 로더 계약

manifest.json은 v10 layout.json의 기존 최상위 키를 모두 포함합니다: version, reference, processing, assets, frames, layout, lead, ui. sheets / actors / effects / stateContract / drawingOrder 등을 추가했습니다. 기존 layout·lead·ui의 논리 좌표, 명판과 상단바 규칙을 그대로 보존합니다. 원본 reference와 frames는 v10 제작 기록입니다. 실제 새 애니메이션은 반드시 actors→sheets로 읽으세요.

```js
const actor = manifest.actors['actor-0']; // actor-0..actor-5, orchestrator
const spec = manifest.sheets[actor.working];
// source rectangle = [frameIndex * spec.frameW, 0, spec.frameW, spec.frameH]
// draw anchor is [spec.anchor[0], spec.anchor[1]] in actual sheet pixels
```

sheets[id] = {file, frameW, frameH, frames, fps, loop, anchor:[x,y]}. 시트는 가로 한 줄이며 프레임을 넘겨 그립니다. 파일은 base64 또는 relative URL 어느 방식으로든 로드할 수 있습니다. manifest 갱신은 임시 파일에서 atomic replace하여 병렬 로더가 중간 JSON을 읽지 않게 합니다.

actors.actor-0~actor-5와 actors.orchestrator에는 모두 working | away | phone | sleeping, 보조 이동 키 walk_left | walk_right가 있습니다. needsAttention은 상태와 독립된 플래그로 effects.attention을 현재 상태 위에 표시합니다. bubble_done / bubble_prup은 정적 1프레임 말풍선이며 표시 수명은 scene에서 제어합니다. loop=false인 숫자 팝업도 수명이 끝나면 제거하세요.

## 크기와 기준점

- 캐릭터 시트: **프레임 160×216**, 발/힙 기준 **[80,205]**. v10 원본 논리 프레임 320×432, 기준 [160,410]의 정확히 절반입니다. 화면 actorHeight에 맞춰 그리면 기존 표시 크기를 유지합니다.
- 각 동작의 프레임은 한 생성 이미지의 동일 행에서 균등 셀로 추출합니다. 원본 간격이 균등하지 않은 세트는 src/frame-cuts.json의 투명 틈 경계를 우선합니다. 세트 전체에 공통 배율을 적용하고 각 프레임 발 밑을 y=205에 맞춥니다. 몸통 바운딩 박스를 중앙 정렬합니다. 잘린 얼굴·빈 프레임은 검사했습니다.
- walk_right는 같은 외형의 walk_left 각 프레임을 수평 반전했습니다. 헤어 가르마 등 비대칭도 반전되는 방식이며 사용자 허용 사항입니다.
- effects 프레임은 공통 crop 영역으로 정렬해 생성된 상하 이동을 보존합니다. pop_plus3/pop_plus10은 생성 그림의 형태·RGB를 그대로 두고 패킹 단계에서 alpha만 [1,1,0.7,0.35]로 정규화했습니다. 숫자나 말풍선을 코드로 그리지 않습니다.
- 정적 assets.size는 **원래 논리 좌표용 크기**입니다. runtimeSize는 실제 압축 WebP 크기, sourceFile은 원본 PNG입니다. drawImage를 논리 크기로 그리세요. runtimeSize로 월드 배치를 다시 계산하면 안 됩니다.
- 배경 런타임은 폭 960, 책상·HUD·소품은 주로 폭 256, 관리자 앞 가림은 최대 폭 320입니다. 기존 legacy 캐릭터 PNG는 폭 128, legacy 종합 시트는 폭 320입니다. 이 legacy actor assets는 호환/기록용이며 새 애니메이션에는 쓰지 않습니다.
- 압축은 원본 고해상도 그림을 Lanczos로 축소하고 alpha 포함 WebP로 저장했습니다. 원본 PNG는 무손실 복사로 보존했고 팔레트 양자화하지 않았습니다. **검토 GIF만 GIF 포맷 특성상 256색이며**, 런타임 WebP/PNG는 그 제한이 없습니다.

## 정적 조립과 배치

v10의 평평한 앞판·모니터 뒤판을 가진 책상 3종, 관리자 앞 가림, 작은/중간/큰 단일 방 배경을 그대로 사용합니다. 원본 정적 PNG 115개는 v10 parts와 바이트 단위로 같습니다.

- columns = N<=3 ? N : N<=6 ? 3 : 4; rows = ceil(N/columns), N=1..16.
- N<=6 월드 1536×1024, N>6 월드 1536×1536.
- N<=6 podWidth=310, podLeft=350+(i%columns)*380; N>6 podWidth=258, podLeft=340+(i%4)*286.
- podTop: N<=3은 610; N<=6은 450+floor(i/3)*275; 그 외 500+floor(i/4)*260.
- actorSeat=[podLeft+podWidth*0.27,podTop+podWidth*0.61]. 이름판은 [podLeft+podWidth*0.5,podTop+podHeight*0.8], 폭 podWidth*0.74. 글꼴·말줄임·상단 프로젝트/워크스페이스/에이전트 정보는 ui에 있습니다. 하단 HUD는 없습니다.
- 한 방 뒷벽 중앙의 큰 관리자 책상과 왼쪽 가장자리 휴식 코너를 유지합니다. away 그림은 소파 없이 캐릭터+컵만 포함하므로 기존 소파 위치에 올립니다.

그리기 순서는 drawingOrder에 있습니다: 배경 → 관리자 → 관리자 앞 가림 → 상체/손 clip → pod/보행자를 발 y로 정렬 → pod-back → flame_aura → actor → pod-front → 상체/손 clip → 말풍선/숫자/Zzz/attention → HTML 상단과 명판. 어떤 런타임 효과도 코드로 도형을 그릴 필요가 없습니다.

## 시트 목록

| ID | 프레임 크기 | 수 | fps | loop | 기준점 |
| --- | --- | ---: | ---: | --- | --- |
| `actor-0-working` | 160×216 | 4 | 8 | True | [80, 205] |
| `actor-0-phone` | 160×216 | 3 | 3 | True | [80, 205] |
| `actor-0-sleeping` | 160×216 | 3 | 1.5 | True | [80, 205] |
| `actor-0-walk_left` | 160×216 | 4 | 8 | True | [80, 205] |
| `actor-0-walk_right` | 160×216 | 4 | 8 | True | [80, 205] |
| `actor-0-away` | 160×216 | 3 | 2 | True | [80, 205] |
| `actor-1-working` | 160×216 | 4 | 8 | True | [80, 205] |
| `actor-1-phone` | 160×216 | 3 | 3 | True | [80, 205] |
| `actor-1-sleeping` | 160×216 | 3 | 1.5 | True | [80, 205] |
| `actor-1-walk_left` | 160×216 | 4 | 8 | True | [80, 205] |
| `actor-1-walk_right` | 160×216 | 4 | 8 | True | [80, 205] |
| `actor-1-away` | 160×216 | 3 | 2 | True | [80, 205] |
| `actor-2-working` | 160×216 | 4 | 8 | True | [80, 205] |
| `actor-2-phone` | 160×216 | 3 | 3 | True | [80, 205] |
| `actor-2-sleeping` | 160×216 | 3 | 1.5 | True | [80, 205] |
| `actor-2-walk_left` | 160×216 | 4 | 8 | True | [80, 205] |
| `actor-2-walk_right` | 160×216 | 4 | 8 | True | [80, 205] |
| `actor-2-away` | 160×216 | 3 | 2 | True | [80, 205] |
| `actor-3-working` | 160×216 | 4 | 8 | True | [80, 205] |
| `actor-3-phone` | 160×216 | 3 | 3 | True | [80, 205] |
| `actor-3-sleeping` | 160×216 | 3 | 1.5 | True | [80, 205] |
| `actor-3-walk_left` | 160×216 | 4 | 8 | True | [80, 205] |
| `actor-3-walk_right` | 160×216 | 4 | 8 | True | [80, 205] |
| `actor-3-away` | 160×216 | 3 | 2 | True | [80, 205] |
| `actor-4-working` | 160×216 | 4 | 8 | True | [80, 205] |
| `actor-4-phone` | 160×216 | 3 | 3 | True | [80, 205] |
| `actor-4-sleeping` | 160×216 | 3 | 1.5 | True | [80, 205] |
| `actor-4-walk_left` | 160×216 | 4 | 8 | True | [80, 205] |
| `actor-4-walk_right` | 160×216 | 4 | 8 | True | [80, 205] |
| `actor-4-away` | 160×216 | 3 | 2 | True | [80, 205] |
| `actor-5-working` | 160×216 | 4 | 8 | True | [80, 205] |
| `actor-5-phone` | 160×216 | 3 | 3 | True | [80, 205] |
| `actor-5-sleeping` | 160×216 | 3 | 1.5 | True | [80, 205] |
| `actor-5-walk_left` | 160×216 | 4 | 8 | True | [80, 205] |
| `actor-5-walk_right` | 160×216 | 4 | 8 | True | [80, 205] |
| `actor-5-away` | 160×216 | 3 | 2 | True | [80, 205] |
| `orchestrator-working` | 160×216 | 4 | 8 | True | [80, 205] |
| `orchestrator-phone` | 160×216 | 2 | 3 | True | [80, 205] |
| `orchestrator-sleeping` | 160×216 | 2 | 1.5 | True | [80, 205] |
| `flame_aura` | 128×160 | 4 | 8 | True | [64, 144] |
| `pop_plus3` | 96×80 | 4 | 4 | False | [48, 72] |
| `pop_plus10` | 96×80 | 4 | 4 | False | [48, 72] |
| `bubble_done` | 128×96 | 1 | 1 | False | [64, 90] |
| `bubble_prup` | 128×96 | 1 | 1 | False | [64, 90] |
| `zzz` | 96×80 | 3 | 2 | True | [48, 72] |
| `attention` | 80×96 | 3 | 3 | True | [40, 88] |
| `orchestrator-away` | 160×216 | 3 | 2 | True | [80, 205] |
| `orchestrator-walk_left` | 160×216 | 4 | 8 | True | [80, 205] |
| `orchestrator-walk_right` | 160×216 | 4 | 8 | True | [80, 205] |

## 검토·한계

49개 GIF를 review/에 두었습니다. 검토를 위해 GIF는 전부 반복 재생하며 실제 런타임의 반복 여부는 manifest.loop를 따릅니다. contact-sheet.png는 각 시트의 모든 프레임을 나란히 표시합니다.

얼굴·복장·헤드폰·비니·안경의 정체성은 세트 내에서 유지됩니다. 다만 actor-1-away, actor-4-away, orchestrator-away는 컵을 들 때 표정과 고개 위치 변화가 타이핑보다 크고, actor-2-sleeping과 orchestrator-sleeping은 호흡 전환에서 머리 크기가 미세하게 달라 보입니다. 기준선은 정렬했으나 생성 일러스트의 내부 변형까지 완전히 없애지는 못했습니다. 외형이 다른 인물로 바뀌거나 프레임이 잘리는 세트는 발견하지 못했습니다. 숫자 팝업의 초기 생성에 흰 안개가 섞여 재생성했고 최종본만 사용합니다. 선택 항목 sparkle은 넣지 않았습니다.

패키지 검증: 모든 파일 참조 존재, 49시트 크기 일치, 알파 포함, 빈/완전 정지 애니메이션 없음, 49 GIF 디코딩, 모든 actor 6상태 매핑, 1단계 계약 안정성, 5MB 예산 통과. 상세는 validation.json입니다. 실제 client/scene 적용과 이벤트 연결은 scene 역할이 담당하며 여기서는 해당 코드를 수정하지 않았습니다.

재생성/패킹 도구는 build_bundle.py(1단계 초기화)와 pack_animations.py(보존된 생성 원본을 정렬·압축)입니다. 이미 생성 원본을 보존했으므로 패킹을 위해 image_gen을 다시 호출할 필요가 없습니다. 전체 재패킹 순서는 build_bundle.py 후 pack_animations.py입니다. build_bundle.py만 실행하면 임시 1프레임 상태가 되므로 주의하세요.

## 생성 프롬프트 원문

모든 실제 입력 참조와 최종 프롬프트는 src/generation-jobs.json에도 있습니다. 아래 각 항목의 첫 참조는 office-c, 둘째 참조는 해당 캐릭터/효과의 v10 PNG입니다. 내장 image_gen의 transparent_background=true로 생성했습니다. GIF 또는 동영상 모델을 사용하지 않았습니다.

### actor-0-working

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-0-working-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 4 identical-sized columns in ONE row. Seated at the same office chair position facing three-quarter toward the viewer and slightly right, typing on an INVISIBLE keyboard in front. FOUR consecutive loop frames: left fingers down/right fingers up; neutral; right fingers down/left up; neutral. Only fingers, wrists and tiny shoulder motion change. Preserve head, hips, feet positions and calm focused expression. No keyboard or chair drawing.
```

### actor-0-phone

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-0-phone-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 3 identical-sized columns in ONE row. THREE loop frames reclining slightly in an INVISIBLE chair, looking down at the same smartphone held near chest. Small scrolling thumb movement and slight breathing. Hips and feet stay planted. No furniture. Smartphone is the only prop.
```

### actor-0-sleeping

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-0-sleeping-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 3 identical-sized columns in ONE row. THREE loop frames sleeping slumped forward onto folded arms on an INVISIBLE tabletop, eyes closed. Frame1 low breath, frame2 gently inhaling chest/shoulders, frame3 returning. Same sleepy head and folded hand position, minimal 1-2 pixel breathing motion. Keep hips and feet aligned. No table, chair, Zzz letters, icons or effects.
```

### actor-0-walk_left

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-0-walking-left-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 4 identical-sized columns in ONE row. FOUR consecutive side-view walking LEFT frames completing a leg cycle: left leg forward/contact, passing, right leg forward/contact, passing. Face and body point LEFT in every frame, arms counter-swing, same hip and head size, feet on a common baseline. Character alone. No ground or speed marks.
```

### actor-0-away

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-0-phone-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 3 identical-sized columns in ONE row. THREE loop frames seated relaxed at the rest-area sofa position, gentle coffee break. Lean back slightly, hold the SAME small plain ceramic mug near lap/chest, sip a little then relax. Same hip/foot position across frames. The sofa is INVISIBLE: do not draw sofa or any furniture. No phone. Mug is the only prop.
```

### actor-1-working

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-1-working-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 4 identical-sized columns in ONE row. Seated at the same office chair position facing three-quarter toward the viewer and slightly right, typing on an INVISIBLE keyboard in front. FOUR consecutive loop frames: left fingers down/right fingers up; neutral; right fingers down/left up; neutral. Only fingers, wrists and tiny shoulder motion change. Preserve head, hips, feet positions and calm focused expression. No keyboard or chair drawing.
```

### actor-1-phone

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-1-phone-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 3 identical-sized columns in ONE row. THREE loop frames reclining slightly in an INVISIBLE chair, looking down at the same smartphone held near chest. Small scrolling thumb movement and slight breathing. Hips and feet stay planted. No furniture. Smartphone is the only prop.
```

### actor-1-sleeping

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-1-sleeping-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 3 identical-sized columns in ONE row. THREE loop frames sleeping slumped forward onto folded arms on an INVISIBLE tabletop, eyes closed. Frame1 low breath, frame2 gently inhaling chest/shoulders, frame3 returning. Same sleepy head and folded hand position, minimal 1-2 pixel breathing motion. Keep hips and feet aligned. No table, chair, Zzz letters, icons or effects.
```

### actor-1-walk_left

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-1-walking-left-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 4 identical-sized columns in ONE row. FOUR consecutive side-view walking LEFT frames completing a leg cycle: left leg forward/contact, passing, right leg forward/contact, passing. Face and body point LEFT in every frame, arms counter-swing, same hip and head size, feet on a common baseline. Character alone. No ground or speed marks.
```

### actor-1-away

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-1-phone-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 3 identical-sized columns in ONE row. THREE loop frames seated relaxed at the rest-area sofa position, gentle coffee break. Lean back slightly, hold the SAME small plain ceramic mug near lap/chest, sip a little then relax. Same hip/foot position across frames. The sofa is INVISIBLE: do not draw sofa or any furniture. No phone. Mug is the only prop.
```

### actor-2-working

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-2-working-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 4 identical-sized columns in ONE row. Seated at the same office chair position facing three-quarter toward the viewer and slightly right, typing on an INVISIBLE keyboard in front. FOUR consecutive loop frames: left fingers down/right fingers up; neutral; right fingers down/left up; neutral. Only fingers, wrists and tiny shoulder motion change. Preserve head, hips, feet positions and calm focused expression. No keyboard or chair drawing.
```

### actor-2-phone

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-2-phone-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 3 identical-sized columns in ONE row. THREE loop frames reclining slightly in an INVISIBLE chair, looking down at the same smartphone held near chest. Small scrolling thumb movement and slight breathing. Hips and feet stay planted. No furniture. Smartphone is the only prop.
```

### actor-2-sleeping

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-2-sleeping-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 3 identical-sized columns in ONE row. THREE loop frames sleeping slumped forward onto folded arms on an INVISIBLE tabletop, eyes closed. Frame1 low breath, frame2 gently inhaling chest/shoulders, frame3 returning. Same sleepy head and folded hand position, minimal 1-2 pixel breathing motion. Keep hips and feet aligned. No table, chair, Zzz letters, icons or effects.
```

### actor-2-walk_left

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-2-walking-left-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 4 identical-sized columns in ONE row. FOUR consecutive side-view walking LEFT frames completing a leg cycle: left leg forward/contact, passing, right leg forward/contact, passing. Face and body point LEFT in every frame, arms counter-swing, same hip and head size, feet on a common baseline. Character alone. No ground or speed marks.
```

### actor-2-away

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-2-phone-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 3 identical-sized columns in ONE row. THREE loop frames seated relaxed at the rest-area sofa position, gentle coffee break. Lean back slightly, hold the SAME small plain ceramic mug near lap/chest, sip a little then relax. Same hip/foot position across frames. The sofa is INVISIBLE: do not draw sofa or any furniture. No phone. Mug is the only prop.
```

### actor-3-working

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-3-working-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 4 identical-sized columns in ONE row. Seated at the same office chair position facing three-quarter toward the viewer and slightly right, typing on an INVISIBLE keyboard in front. FOUR consecutive loop frames: left fingers down/right fingers up; neutral; right fingers down/left up; neutral. Only fingers, wrists and tiny shoulder motion change. Preserve head, hips, feet positions and calm focused expression. No keyboard or chair drawing.
```

### actor-3-phone

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-3-phone-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 3 identical-sized columns in ONE row. THREE loop frames reclining slightly in an INVISIBLE chair, looking down at the same smartphone held near chest. Small scrolling thumb movement and slight breathing. Hips and feet stay planted. No furniture. Smartphone is the only prop.
```

### actor-3-sleeping

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-3-sleeping-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 3 identical-sized columns in ONE row. THREE loop frames sleeping slumped forward onto folded arms on an INVISIBLE tabletop, eyes closed. Frame1 low breath, frame2 gently inhaling chest/shoulders, frame3 returning. Same sleepy head and folded hand position, minimal 1-2 pixel breathing motion. Keep hips and feet aligned. No table, chair, Zzz letters, icons or effects.
```

### actor-3-walk_left

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-3-walking-left-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 4 identical-sized columns in ONE row. FOUR consecutive side-view walking LEFT frames completing a leg cycle: left leg forward/contact, passing, right leg forward/contact, passing. Face and body point LEFT in every frame, arms counter-swing, same hip and head size, feet on a common baseline. Character alone. No ground or speed marks.
```

### actor-3-away

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-3-phone-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 3 identical-sized columns in ONE row. THREE loop frames seated relaxed at the rest-area sofa position, gentle coffee break. Lean back slightly, hold the SAME small plain ceramic mug near lap/chest, sip a little then relax. Same hip/foot position across frames. The sofa is INVISIBLE: do not draw sofa or any furniture. No phone. Mug is the only prop.
```

### actor-4-working

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-4-working-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 4 identical-sized columns in ONE row. Seated at the same office chair position facing three-quarter toward the viewer and slightly right, typing on an INVISIBLE keyboard in front. FOUR consecutive loop frames: left fingers down/right fingers up; neutral; right fingers down/left up; neutral. Only fingers, wrists and tiny shoulder motion change. Preserve head, hips, feet positions and calm focused expression. No keyboard or chair drawing.
```

### actor-4-phone

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-4-phone-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 3 identical-sized columns in ONE row. THREE loop frames reclining slightly in an INVISIBLE chair, looking down at the same smartphone held near chest. Small scrolling thumb movement and slight breathing. Hips and feet stay planted. No furniture. Smartphone is the only prop.
```

### actor-4-sleeping

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-4-sleeping-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 3 identical-sized columns in ONE row. THREE loop frames sleeping slumped forward onto folded arms on an INVISIBLE tabletop, eyes closed. Frame1 low breath, frame2 gently inhaling chest/shoulders, frame3 returning. Same sleepy head and folded hand position, minimal 1-2 pixel breathing motion. Keep hips and feet aligned. No table, chair, Zzz letters, icons or effects.
```

### actor-4-walk_left

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-4-walking-left-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 4 identical-sized columns in ONE row. FOUR consecutive side-view walking LEFT frames completing a leg cycle: left leg forward/contact, passing, right leg forward/contact, passing. Face and body point LEFT in every frame, arms counter-swing, same hip and head size, feet on a common baseline. Character alone. No ground or speed marks.
```

### actor-4-away

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-4-phone-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 3 identical-sized columns in ONE row. THREE loop frames seated relaxed at the rest-area sofa position, gentle coffee break. Lean back slightly, hold the SAME small plain ceramic mug near lap/chest, sip a little then relax. Same hip/foot position across frames. The sofa is INVISIBLE: do not draw sofa or any furniture. No phone. Mug is the only prop.
```

### actor-5-working

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-5-working-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 4 identical-sized columns in ONE row. Seated at the same office chair position facing three-quarter toward the viewer and slightly right, typing on an INVISIBLE keyboard in front. FOUR consecutive loop frames: left fingers down/right fingers up; neutral; right fingers down/left up; neutral. Only fingers, wrists and tiny shoulder motion change. Preserve head, hips, feet positions and calm focused expression. No keyboard or chair drawing.
```

### actor-5-phone

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-5-phone-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 3 identical-sized columns in ONE row. THREE loop frames reclining slightly in an INVISIBLE chair, looking down at the same smartphone held near chest. Small scrolling thumb movement and slight breathing. Hips and feet stay planted. No furniture. Smartphone is the only prop.
```

### actor-5-sleeping

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-5-sleeping-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 3 identical-sized columns in ONE row. THREE loop frames sleeping slumped forward onto folded arms on an INVISIBLE tabletop, eyes closed. Frame1 low breath, frame2 gently inhaling chest/shoulders, frame3 returning. Same sleepy head and folded hand position, minimal 1-2 pixel breathing motion. Keep hips and feet aligned. No table, chair, Zzz letters, icons or effects.
```

### actor-5-walk_left

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-5-walking-left-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 4 identical-sized columns in ONE row. FOUR consecutive side-view walking LEFT frames completing a leg cycle: left leg forward/contact, passing, right leg forward/contact, passing. Face and body point LEFT in every frame, arms counter-swing, same hip and head size, feet on a common baseline. Character alone. No ground or speed marks.
```

### actor-5-away

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-5-phone-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 3 identical-sized columns in ONE row. THREE loop frames seated relaxed at the rest-area sofa position, gentle coffee break. Lean back slightly, hold the SAME small plain ceramic mug near lap/chest, sip a little then relax. Same hip/foot position across frames. The sofa is INVISIBLE: do not draw sofa or any furniture. No phone. Mug is the only prop.
```

### orchestrator-working

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-lead-working-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 4 identical-sized columns in ONE row. This person is the white-haired, rectangular-glasses orchestrator in the exact navy vest/white shirt from image 2. Seated at the same office chair position facing three-quarter toward the viewer and slightly right, typing on an INVISIBLE keyboard in front. FOUR consecutive loop frames: left fingers down/right fingers up; neutral; right fingers down/left up; neutral. Only fingers, wrists and tiny shoulder motion change. Preserve head, hips, feet positions and calm focused expression. No keyboard or chair drawing.
```

### orchestrator-phone

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-lead-phone-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 2 identical-sized columns in ONE row. This person is the white-haired, rectangular-glasses orchestrator in the exact navy vest/white shirt from image 2. TWO loop frames reclining slightly in an INVISIBLE chair, looking down at the same smartphone held near chest. Small scrolling thumb movement and slight breathing. Hips and feet stay planted. No furniture. Smartphone is the only prop.
```

### orchestrator-sleeping

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-lead-sleeping-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 2 identical-sized columns in ONE row. This person is the white-haired, rectangular-glasses orchestrator in the exact navy vest/white shirt from image 2. TWO loop frames sleeping slumped forward onto folded arms on an INVISIBLE tabletop, eyes closed. Frame1 low breath, frame2 gently inhaling chest/shoulders, frame3 returning. Same sleepy head and folded hand position, minimal 1-2 pixel breathing motion. Keep hips and feet aligned. No table, chair, Zzz letters, icons or effects.
```

### flame_aura

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/flame-0.png`

```text
Image 1 is our own original office art style; image 2 is the exact existing effect design. Create an original animation of image 2 with identical shape, line weight, colors and warm detailed high-resolution pixel illustration. True transparent background. ONE horizontal row, exactly 4 equal columns, no grid lines/labels, ample transparent padding, never cross cell boundaries. No palette reduction, no named game or trademark. Four frames of the SAME hollow U-shaped orange-yellow pixel flame aura flickering around an INVISIBLE person. Flame tips shift through a smooth loop. The central character-shaped opening stays transparent. No character, text, ground or shadow.
```

### pop_plus3

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/points-3.png`

```text
Image 1 is our own office art direction. Image 2 is the exact balloon design to animate. Generate a clean transparent RGBA horizontal sprite row with EXACTLY FOUR equal cells. Same cream balloon with dark navy outline and green exact text '+3' repeated in four frames. Preserve its size, shape, lettering and colors IDENTICALLY in every frame. Frame 1 lower, frame 2 5px higher, frame 3 10px higher, frame 4 15px higher. The ONLY fade is actual object alpha: frames 1/2 fully opaque, frame 3 70% opacity, frame 4 35% opacity. Every pixel outside the balloon must have ZERO alpha. CRITICAL: NO glow, haze, clouds, fog, halo, white wash, gray wash, painted transparency, floor, shadows, background or checkerboard artwork. Never brighten colors or draw white behind a balloon to fake fading. Do not enlarge or distort the balloon. Four separate isolated identical balloons in ONE row, no overlap, generous transparent gutters. Match the exact high-resolution pixel illustration of image 2. No added symbols, no labels.
```

### pop_plus10

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/points-10.png`

```text
Image 1 is our own office art direction. Image 2 is the exact balloon design to animate. Generate a clean transparent RGBA horizontal sprite row with EXACTLY FOUR equal cells. Same cream balloon with dark navy outline and green exact text '+10' repeated in four frames. Preserve its size, shape, lettering and colors IDENTICALLY in every frame. Frame 1 lower, frame 2 5px higher, frame 3 10px higher, frame 4 15px higher. The ONLY fade is actual object alpha: frames 1/2 fully opaque, frame 3 70% opacity, frame 4 35% opacity. Every pixel outside the balloon must have ZERO alpha. CRITICAL: NO glow, haze, clouds, fog, halo, white wash, gray wash, painted transparency, floor, shadows, background or checkerboard artwork. Never brighten colors or draw white behind a balloon to fake fading. Do not enlarge or distort the balloon. Four separate isolated identical balloons in ONE row, no overlap, generous transparent gutters. Match the exact high-resolution pixel illustration of image 2. No added symbols, no labels.
```

### zzz

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/zzz.png`

```text
Image 1 is our own original office art style; image 2 is the exact existing effect design. Create an original animation of image 2 with identical shape, line weight, colors and warm detailed high-resolution pixel illustration. True transparent background. ONE horizontal row, exactly 3 equal columns, no grid lines/labels, ample transparent padding, never cross cell boundaries. No palette reduction, no named game or trademark. Three frames of the SAME cream sleep speech balloon containing exact dark text 'Zzz', matching image 2, gently bobbing and breathing through a small 3px loop. No character or furniture.
```

### attention

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/emphasis.png`

```text
Image 1 is our own original office art style; image 2 is the exact existing effect design. Create an original animation of image 2 with identical shape, line weight, colors and warm detailed high-resolution pixel illustration. True transparent background. ONE horizontal row, exactly 3 equal columns, no grid lines/labels, ample transparent padding, never cross cell boundaries. No palette reduction, no named game or trademark. Three loop frames of the SAME yellow exclamation emphasis '!' symbol cluster matching image 2, with orange edges, subtly growing/settling/bobbing above an invisible head. No character, speech balloon, furniture or text besides '!'. Keep positions and shape consistent.
```

### orchestrator-away

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-lead-phone-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 3 identical-sized columns in ONE row. THREE loop frames seated relaxed at the rest-area sofa position, gentle coffee break. Lean back slightly, hold the SAME small plain ceramic mug near lap/chest, sip a little then relax. Same hip/foot position across frames. The sofa is INVISIBLE: do not draw sofa or any furniture. No phone. Mug is the only prop. Identity must be the EXACT white-haired orchestrator, rectangular black glasses, navy vest, white shirt and tie of image 2; keep glasses and outfit in every frame.
```

### orchestrator-walk_left

참조: `/Users/gyuha/workspace/agent-office/assets/mockups/v8/office-c.png`, `/Users/gyuha/workspace/agent-office/assets/mockups/v10/parts/actor-lead-walking-left-0.png`

```text
Use image 1 as the art-direction reference, our own office illustration. Image 2 is the EXACT character identity and outfit reference, also our own generated artwork. Match image 2's face, hairstyle, accessories, clothing colors, outline weight and warm high-resolution pixel-illustration detail. Do not redesign, simplify, quantize the palette or change identity. All frames must show one identical person with stable scale, torso/hip position and foot baseline. True transparent RGBA background. No room, floor, chair, desk, monitor, labels, borders, grid lines, text or extra people. Isolated character only; props limited to the action named below. Make ONE horizontal row of equally spaced animation frames, never multiple rows, all full body, no overlapping cells, generous transparent gutter and padding. Camera stays fixed. No trademarks or named game references. Canvas landscape, ideally 1536x768. Exactly 4 identical-sized columns in ONE row. FOUR consecutive side-view walking LEFT frames completing a leg cycle: left leg forward/contact, passing, right leg forward/contact, passing. Face and body point LEFT in every frame, arms counter-swing, same hip and head size, feet on a common baseline. Character alone. No ground or speed marks. Identity must be the EXACT white-haired orchestrator, rectangular black glasses, navy vest, white shirt and tie of image 2; keep glasses and outfit in every frame.
```

## 이웃 프레임 조각 수정

actor-1-away index 1 오른쪽에 다음 인물의 얼굴 조각이 들어온 결함을 수정했습니다. 생성 원본의 3명 간격이 완전히 균등하지 않았기 때문입니다. 원본 PNG를 다시 그리지 않고 세로 투명 틈에서 절단하도록 src/frame-cuts.json을 추가했습니다. actor-1-away 경계는 [0,590,1148,1774], actor-1-sleeping은 [0,597,1167,1774]입니다. sleeping은 절단 메타데이터만 보강되었고 최종 이미지 바이트는 동일합니다.

전체 49시트·165프레임에 대해 좌우 가장자리 알파, 주 인물과 떨어진 가장자리 연결 성분, 원본 절단선의 알파 교차를 자동 검사했습니다. 이웃 조각 0건, 선택한 절단선 교차 0건입니다. bubble_done/prup의 단일 말풍선 외곽선이 이미지 가장자리에 닿는 것은 의도된 테두리이며 이웃 조각이 아닙니다. 검사기는 audit_edges.py, 결과는 edge-audit.json입니다.

actor-1-away PNG/WebP/GIF 및 contact-sheet.png를 갱신했습니다. 다른 런타임 시트 48개와 manifest.json은 수정 전후 바이트가 동일합니다. 프레임 크기·개수·기준점·매핑·fps는 바뀌지 않았습니다.


## 이전 800 CSS px 런타임 축소 (폐기된 설정)

최상위 `runtimeScale: 0.5`를 추가했습니다. 기존 논리 좌표, assets.size, frameW/frameH, anchor, 프레임 수, 매핑은 유지합니다. 시트의 실제 셀은 논리 셀의 정확히 절반(캐릭터 80×108)입니다. 각 프레임을 PNG 마스터에서 개별 Lanczos 축소한 뒤 이어 붙여 이웃 셀 필터 누출을 방지합니다. 소스 PNG는 전부 변경하지 않았습니다.

홀수 크기의 정적 부품 17개는 오른쪽/아래에 투명 1 논리 px를 패딩했습니다. `runtimePaddedLogicalSize`에 패딩 후 논리 크기를, `runtimeSize`에 실제 픽셀 크기를 기록했습니다. 렌더러는 해당 파일을 paddedLogicalSize로 그리거나, 원래 size×runtimeScale 크기만큼 소스 영역을 잘라 기존 size로 그리면 됩니다. 패딩을 제외한 원래 그림 좌표는 바뀌지 않습니다. 애니메이션 프레임은 이미 모두 짝수여서 패딩이 없습니다.

WebP method=4, alpha_quality=80입니다. 1MB 한도 때문에 호환용 static-actor-*는 quality=0, 그 외 배경·부품·현행 시트는 quality=3을 사용했습니다. 최종 164파일 994,288 B입니다. 낮은 품질로 미세한 질감과 색 경계는 부드러워졌지만, 런타임 크기의 얼굴 눈·안경·헤드폰, 책상 가림막 테두리는 구분됩니다. 명판 문자는 별도 텍스트이므로 이미지 압축의 영향을 받지 않습니다. 원본 해상도와 같은 세부 묘사를 보장하지는 않습니다.

review GIF와 contact-sheet는 원본 대신 **최종 런타임 WebP**에서 다시 만들었습니다. 49시트·165프레임의 치수, 프레임 수, 알파/빈 프레임, 이웃 조각, 전체 상태 매핑과 소스 PNG 해시 검사를 통과했습니다. 재현: `python3 assets/office/export_half.py` 후 `python3 assets/office/validate_half.py`. 기존 pack_animations.py로 원본 시트를 재생성하면 마지막에 export_half.py를 다시 실행해야 합니다. 크기/품질 결과는 compression-report.json, 검사 결과는 validation.json 및 edge-audit.json에 있습니다.


## 현재 런타임: 480 CSS px × DPR 2

`runtimeScale: 0.625`입니다. 1536 논리 px가 실제 960px가 되어 최대 표시 폭에서 업스케일하지 않습니다. PNG 마스터에서 직접 Lanczos 축소하며 이전 0.5 WebP는 입력으로 사용하지 않습니다. WebP quality=85, alpha_quality=100, method=6을 적용했습니다. 효과/말풍선은 동일 원본의 lossless 결과가 더 작을 때 lossless를 선택합니다. 용량 제한에 맞춰 품질을 낮추지 않습니다.

논리 좌표·프레임 크기·기준점·프레임 수·매핑은 유지합니다. 5/8배에서 정확히 정수가 되도록 정적 모듈은 오른쪽/아래 투명 패딩으로 논리 크기를 8의 배수로 올렸습니다. `runtimePaddedLogicalSize`와 `runtimeSize`를 참조하십시오. 모든 시트 셀은 이미 8의 배수여서 패딩 없이 정확히 변환됩니다(캐릭터 160×216 → 100×135). 각 셀을 따로 리샘플링한 후 합쳐 경계 필터 누출을 방지합니다.

`client/scene/generate-office.cjs` 필터에 포함되는 background- / lead-front- / pod- / hud-panel 및 모든 sheets만 runtime에 남깁니다. 나머지 1단계 호환용 static-actor-* (개별 프레임과 합본), static-flame-*, static-emphasis, static-points-*, static-bubble-*, static-zzz, static-icon-*는 제외했습니다. 완전한 제거 파일 목록은 compression-report.json의 removed입니다. 해당 비임베드 assets 항목은 `runtimeExcluded: true`로 표시하고 file은 보존된 sourceFile PNG를 가리킵니다. src PNG는 바뀌지 않았습니다.

현재 내보내기는 export_runtime.py, 검사는 validate_half.py입니다. 이전 export_half.py는 과거 재현용이며 현재 납품에 실행하지 않습니다. 비교 이미지는 review/quality-compare.png입니다. 두 패널 모두 전체 방 960px 표시 배율에서 동일 논리 영역을 잘라 나란히 배치했습니다. 명판 글자는 런타임 텍스트이므로 비교 이미지에는 합성하지 않았습니다. GIF/contact-sheet는 최종 WebP에서 갱신합니다.

현재 총용량과 임베드 대상 합계는 모두 **1,317,636 B**입니다. 비임베드 런타임 파일 102개를 제거했습니다. 비교에서 새 결과는 눈·입·키보드·나뭇결과 책상 윤곽의 번짐이 크게 줄었습니다. lossless 후보도 비교했으나 이번 효과 7종은 모두 quality=85 결과가 더 작아 손실 WebP를 유지했습니다.


## 책상 레이어 / 빈백 착석 수정

기존 pod-0/1/2-back/front 및 lead-front-small/medium/large 키는 유지하면서 그림을 교체했습니다. 새 assets 키는 lead-back-small/medium/large 및 beanbag-{moss,terracotta,navy,mustard}-{back,front}입니다. 최상위 pods, leadDesks, beanbags, restLayout을 추가했습니다. runtimeScale=0.625, q85/alpha100/method6 유지입니다.

책상 생성 원본 한 장을 같은 좌표계로 잘라 앞뒤 두 레이어로 분리했습니다. back+front 합성은 분할 직전 생성 그림과 동일합니다. 좌우 끝 소품과 앞판·상판 앞 모서리는 front에, 의자/모니터와 상판 뒷부분은 back에 들어갑니다. 좌측 가운데를 비워 작업/수면 팔과 머그컵·책이 겹치지 않습니다. 의자는 back에 포함되어 따로 중복해서 그리지 않습니다. 그림을 직접 다시 그리거나 색 수를 줄이지 않았으며, 생성 투명 영역의 alpha<16 잡음만 제거했습니다.

pods[id]의 size 기준으로 모든 좌표는 논리 px입니다. seat는 프레임 anchor를 놓을 위치이고 actorHeight=320입니다. actorAnchor=[80,205]는 원래 160×216 셀 좌표입니다. 실제 배치식은 actor 왼쪽위 = desk 왼쪽위 + seat + [0,stateYOffset] - actorAnchor × (actorHeight/216)입니다. podWidth로 모듈을 줄이면 이 전체 결과도 podWidth/size[0]로 같이 줄이세요. working/phone yOffset=-45, sleeping=-15입니다. actorClip은 프레임이 책상 아래로 새지 않게 하는 책상 좌표 기준 클립 사각형입니다. actorClip으로 캐릭터만 자른 뒤 front를 덮으세요. 320은 자산 논리 배치 크기이며 world px와 섞지 않습니다.

leadDesks[kind]에도 동일한 seat/actorHeight/actorAnchor/actorStateYOffset/actorClip이 있습니다. sourceBox는 배경 원본 좌표에서 레이어를 놓는 사각형입니다. 큰 배경은 1254×1254 원본 좌표를 월드에 맞게 비례 변환해야 합니다. 기존 배경에 박혀 있던 책상을 제거한 생성 이미지를 만들고 책상 영역 사각형만 원본에 붙여 기존 방의 나머지 픽셀을 유지했습니다. 원래 src/v10 파일은 보존했습니다. 새 background와 lead-back/actor/lead-front를 반드시 함께 사용하세요.

빈백은 같은 시점 4색, 논리 240×192입니다. seat=[120,132]는 캐릭터 골반을 놓는 지점이며 away 프레임의 골반 anchor=[80,150], actorHeight=216입니다. 식은 위와 동일하며 기존 시트 바닥 anchor 대신 이 모듈별 골반 anchor를 사용합니다. front는 아래쪽 부드러운 테두리로 다리 일부를 가립니다. restLayout은 2열·280×240 간격, 1슬롯당 1명이며 관리자도 같은 슬롯 풀을 사용합니다. 침대/커피 테이블 위나 점유된 슬롯을 재사용하면 안 됩니다. 슬롯이 부족하면 빈 바닥 쪽에 행을 추가하세요.

그리기 순서: chair(이미 back에 포함) → desk back → actor → desk front → nameplate. 휴식은 beanbag back → away actor → beanbag front입니다. 기존 scene 임베더의 필터에는 lead-back-와 beanbag-도 포함되어야 합니다(이 작업은 assets 밖 코드를 수정하지 않음). 새 메타데이터를 적용하지 않고 예전 seat/clip을 쓰면 착석 결함이 남습니다.

검토: review/desk-compose.png는 3 pod × 6명 × working/phone/sleeping=54개와 관리자 3배경 × 3포즈=9개, review/beanbag-compose.png는 4색 × 관리자 포함 7명=28개입니다. 캐릭터 시트 자체는 변경하지 않았습니다. sleeping은 같은 수면 포즈를 쓰되 기준점과 앞판 클립으로 팔/머리가 상판에 놓이도록 맞췄습니다. 재현은 build_layers.py, 프롬프트 원문과 참조 경로는 src/layer-generation.json입니다.

레이어 수정 후 런타임은 1,317,636 → **1,306,476 B** (−11,160 B)입니다. 생성 배경은 책상 제거 사각형 안에서만 사용했고 나머지 원래 방 픽셀은 보존했습니다. lead-room-compose.png에서 3종 배경과 관리자 착석을 확인했습니다. 현재 build_layers.py를 실행하면 최종 레이어와 합성 검토물을 재생성합니다. export_runtime.py만 실행할 경우 최종 레이어 분할 뒤 추가 검토가 필요하므로 build_layers.py를 마지막에 실행하세요.


## 키보드 / 손 정렬 보강 (현재)

pod-0/1/2-back 및 lead-back-small/medium/large에 office-c와 기존 pod를 참조해 새로 생성한 키보드+마우스를 합성했습니다. 생성 원본은 src/generated/keyboard-mouse.png이며 직접 그린 도형은 없습니다. keyboard.rect/keycapRect/mouseRect는 모듈 논리 좌표입니다. back → hands actor → front 순서여서 손은 키 위에 놓입니다. 머그컵·책·화분은 기존 양 끝 자리를 유지합니다.

각 pods 및 leadDesks에 actorOffsets[actorId].working=[dx,dy]를 추가했습니다. 기존 seat/actorAnchor/actorHeight와 actorStateYOffset을 계산한 뒤 이 모듈 좌표 오프셋을 더하세요. 네 working 프레임 모두 같은 오프셋을 적용하므로 프레임마다 몸이 흔들리지 않습니다. 손 중심 측정값은 최상위 keyboardAlignment.handCentersIn160x216Frames입니다. 팜의 평균 위치를 [100,137]로 정렬하고 키 면의 중심은 [seat.x+30, frontOcclusionY−17]로 맞췄습니다. 키보드는 고정된 back 레이어 이미지이므로 별도의 키보드 draw나 asset 로딩은 필요 없습니다.

actorSourceClip.working=[0,0,160,145], sleeping=[0,0,160,138]은 **원본 160×216 프레임 기준**입니다. 시트의 해당 프레임을 먼저 이 영역으로 마스킹하되, 캔버스 크기와 anchor를 바꾸지 말고 그리세요. runtimeScale 0.625의 소스 픽셀 사각형에는 이 값을 0.625배 적용합니다. 기존 actorClip은 최종 모듈 좌표에서 따로 적용합니다. 이 클립은 낮춰 앉는 포즈의 허벅지가 상판 위에 올라오는 것을 막습니다. sleeping yOffset은 −38로 올려 팔/머리가 키보드 뒤쪽에 놓이며, phone 포즈와 시트는 변경하지 않았습니다.

관리자 back/front 모듈은 맨 위에 투명 논리 64px를 추가했습니다. sourceBox.top을 64px 올리고 seat.y, frontOcclusionY, nameplate.y도 64px 이동하여 월드 좌표의 책상 위치는 유지합니다. 큰 머리가 모듈 바깥으로 잘리지 않게 하기 위한 여백입니다. 기존 lead front 키도 같은 새 sourceBox를 사용해야 합니다.

review/desk-compose.png: 3 pod × 6명 × (working 4프레임 + phone + sleeping)=108개 및 3 manager 변형 × 6포즈=18개, 총126개입니다. 확대 확인용으로 desk-compose-pod0/1/2.png와 desk-compose-manager.png도 저장했습니다. 프레임별 몸 오프셋은 사용하지 않았고 상태별/외형별 고정 오프셋만 적용했습니다. scene에서 actorOffsets와 actorSourceClip을 적용해야 동일한 결과가 나옵니다.

키보드 수정 후 총용량: 1,306,476 → 1,311,546 B (+5,070 B). 추가 프롬프트 원문은 src/keyboard-generation.json입니다. review/typing-hands-detail.png는 pod0의 6명×4프레임 손 부분 확대입니다.


## 현재 휴식 배치: 구성원 하단 띠 / 관리자 전용 빈백

새 assets 키는 rug-lounge-short(800×256), rug-lounge-medium(1080×256), rug-lounge-long(1360×256)입니다. 생성한 러그 한 장에서 세 길이 변형으로 내보냈습니다. 3조각 반복 방식이 아니므로 변형을 선택한 뒤 가로로 다시 늘리지 않습니다. runtimeScale=0.625이므로 실제 WebP는 각각 500×160, 675×160, 850×160입니다. q85/alpha100/method6을 유지합니다. scene의 임베드 필터에 rug-lounge-를 추가해야 합니다. 생성 프롬프트 원문은 src/lounge-generation.json입니다.

빈백 240×192와 seat=[120,132], away actorHeight=216, actorAnchor=[80,150] 비율을 직접 재검토해 유지했습니다. 빈백 back은 전체 빈백을 포함하고 front는 앞쪽 테두리를 중복해 덮습니다. back/front 리샘플링 경계의 투명 틈을 방지하면서 다리를 가립니다.

restLayout 기존 필드는 삭제하지 않았으며 새 memberLounge, managerSlot이 우선입니다. 이전 2열/행 추가 규칙은 폐기합니다. 모든 구성원 슬롯은 빈백의 왼쪽 위 좌표와 골반 seat 좌표를 함께 제공합니다.

- memberLounge 원점: 방 논리 좌표 [0, deskGridBottom+48]. deskGridBottom은 모든 pod의 top+그려지는 height 중 최댓값이며 효과·보행자는 제외합니다. 기존 소파/침대는 장식으로 남습니다.
- 띠 높이 stripHeight=320. 책상 격자 끝부터 필요한 높이는 gap48+strip320=368. 최종 roomHeight=max(baseRoomHeight,deskGridBottom+368)입니다.
- 1536 논리 폭 기준 러그: long, 위치 [88,32], 크기1360×256.
- 빈백 왼쪽 위(띠 기준): [228,56], [508,56], [788,56], [1068,56]. 각각 moss/terracotta/navy/mustard. 골반 seat는 [348,188], [628,188], [908,188], [1188,188]. 가로 stride280=빈백240+틈40, 최대4명입니다.
- 좁은 논리 방: width≥1456은 long/4석, ≥1176은 medium/3석, ≥896은 short/2석. 첫 슬롯x=(roomWidth−(count×240+(count−1)×40))/2, rugX=(roomWidth−rugWidth)/2, 슬롯y=56. 그보다 좁으면 short/2석 전체 그룹을 (roomWidth−96)/800 배율로 함께 축소합니다. 1536 논리 좌표를 CSS로 줄이는 일반 패널은 논리 폭1536을 그대로 사용하므로 4석을 유지합니다.
- managerSlot은 구성원 띠와 독립된 navy 전용1석입니다. 원점은 lead sourceBox의 왼쪽 위(배경 원본 좌표)이며 책상과 같은 월드 변환을 적용합니다. 빈백topLeft=[leadWidth+24,leadHeight−104]. small=[544,246], medium=[522,234], large=[477,209]. seat는 각각 [664,378], [642,366], [597,341]. lead의 실제 책상 앞판 오른쪽에 gap24를 두고 옆으로 놓습니다.
- 구성원 슬롯이 차면 자기 책상에서 phone/sleeping으로 쉽니다. 슬롯 추가·공유·바닥 착석은 하지 않습니다. 관리자도 전용자리가 막히면 자기 책상으로 돌아갑니다.

review/lounge-compose.png에서 러그 위 구성원4명과 책상 옆 관리자1명을 최종 WebP로 합성해 확인했습니다. 빈백/러그 겹침이나 슬롯 공유가 없습니다. 재생성 순서: build_layers.py → build_lounge.py → validate_half.py. assets 밖 scene 코드는 수정하지 않았습니다.

휴식 띠 추가 후 런타임 총용량 1,438,076 B입니다.


## 현재 빈백 방향: 사용자 정정 반영, 오른쪽 앞 60도

새 생성은 왼쪽 앞 시점으로 수행했고, 사용자 정정에 따라 **각 빈백과 각 away 프레임을 수평 반전**했습니다. 런타임 이미지는 이미 반전되어 있으므로 scene에서 다시 flip하지 않습니다. 시트 열 순서는 유지합니다. 원본 생성 PNG는 src/generated/*-left60.png에, 최종 반전된 마스터는 src/sheets/*-away.png에 있습니다. 생성 프롬프트와 참조 기록은 src/rotated-lounge-generation.json입니다.

기존 beanbag-{moss,terracotta,navy,mustard}-{back,front}와 actor-0..5-away/orchestrator-away 키를 그대로 사용합니다. away 시트는 각3프레임이며 frameW=160/frameH=216, fps/loop/anchor는 기존 계약 그대로입니다. 각 인물의 프레임은 같은 생성 이미지 한 줄에서 자르고 같은 배율·발 기준으로 정렬했습니다. 다른 상태 시트는 변경하지 않았습니다. runtimeScale=.625/q85/alpha100/method6 유지입니다.

빈백 size=[240,200], seat=[102,132], actorHeight=256, actorAnchor=[48,166]입니다. actorAnchor는 휴식 프레임 골반이며 시트의 기본 발 anchor와 다릅니다. actor 좌상단=빈백 좌상단+seat−actorAnchor×(256/216). 기본 sheet.anchor를 이 자리의 골반 정렬에 쓰면 안 됩니다. back은 빈백 전체, front는 왼쪽 뒤 볼스터 사각형 [0,105,50,95]만 포함합니다. 오른쪽 앞쪽 x≥50에는 front 픽셀이 없으므로 무릎/신발을 가리지 않습니다. 의상/헤드폰/컵도 함께 반전했으며 글자 로고가 없어 거울상 텍스트 문제는 없습니다.

구성원 띠 원점과 크기는 기존 [0,deskGridBottom+48], 높이320을 유지합니다. 1536 폭에서 빈백topLeft=[216,56],[504,56],[792,56],[1080,56], stride288=240+48, max4입니다. 반전 후 골반 seat는 [318,188],[606,188],[894,188],[1182,188]입니다. 좁은 방 첫x=(roomWidth−(count×240+(count−1)×48))/2로 갱신했습니다. 만석이면 자기 책상에서 쉽니다.

관리자 전용 navy topLeft=[leadWidth+32,leadHeight−100]입니다. lead sourceBox 좌상단 기준 small=[552,250], medium=[530,238], large=[485,213]. 골반 seat는 각각 [654,382],[632,370],[587,345]입니다. 배경 원본 좌표에서 책상과 동일한 월드 변환을 적용합니다. 구성원 슬롯 풀과 독립입니다.

걷기→착석: 이동은 walking sheet.anchor(발)로 seat+[0,64]에 도착합니다. 짧게 crossfade하며 away는 이 모듈의 골반 actorAnchor를 seat에 맞춥니다. 두 프레임의 서로 다른 anchor 좌표를 직접 보간하지 않습니다. 도착·착석 기준은 restLayout.memberLounge.arrivalAnchor입니다.

review/lounge-compose.png에 4색×7명과 실제4석 띠, lounge-frames.png에 7명×3프레임을 합성했습니다. 얼굴·컵·헤드폰과 다리 전체가 자연스럽게 보이는지 직접 확인했습니다. GIF와 전체 contact-sheet도 갱신했습니다. 재생성 순서: build_layers.py → build_lounge.py → build_rotated_lounge.py → refresh_reviews.py → validate_half.py. 이 순서를 끝까지 실행해야 최종 오른쪽 방향이 유지됩니다.

오른쪽 방향 최종 런타임 총용량은 1,407,596 B (이전 1,438,076 B 대비 −30,480 B)입니다. 49시트·165프레임 검사 통과, 시트 frameW/H·기본 anchor·fps·loop는 유지했습니다. 원본 변경은 승인된 away PNG 마스터7개이며 그 외 기존 소스 해시 검사는 통과했습니다.


## 현재 휴식 구역: 방 왼쪽 빈 바닥 (하단 띠 폐기)

background-small/medium/large의 키와 논리 크기를 유지하고 왼쪽 바닥 가구만 제거했습니다. 원래 src/modules 배경은 background-before-left-*.png로 보존했습니다. 기존 배경과 office-c를 참조해 편집 생성했으며, 소파·침대·탁자·러그·램프·낮은 수납장·바닥 화분이 있던 지정 영역만 합성했습니다. 창문·블라인드·화이트보드·책장·액자·매달린 화분 등과 중앙/오른쪽은 유지합니다. 편집 마스크 밖 픽셀은 원본과 같습니다. 생성 프롬프트는 src/left-lounge-generation.json, 범위는 left-lounge-report.json입니다. runtime은 같은 파일 경로로 q85/alpha100/method6, scale=.625로 다시 내보냈습니다. static-background 별칭 파일이 있으면 같은 결과로 갱신하도록 빌더에 포함했습니다(현재 런타임에는 별도 static-background 파일 없음).

restLayout.memberLounge.enabled=false / deprecated=true, addedRoomHeight=0, stripHeight=0입니다. rug-lounge-* 키는 남겨두되 enabled=false이며 그리지 않습니다. 기존 하단 띠 좌표는 과거 호환용이며 사용하지 않습니다. 현재 규칙은 restLayout.leftLounge가 우선합니다. roomHeightPolicy='base canvas only': small/medium 1536×1024, large1536×1536이며 높이를 추가하지 않습니다. managerSlot은 이번 수정에서 변경하지 않았습니다.

leftLounge.origin은 **방 좌상단 기준 월드 논리 px**입니다. large 배경의 1254×1254 원본 좌표를 그대로 쓰면 안 됩니다. 먼저 배경을1536×1536으로 맞추고 아래 좌표를 사용하세요. 빈백240×200, 골반seatInBeanbag=[102,132], away actorHeight256/actorAnchor=[48,166]는 유지합니다.

| 방 | 최대 슬롯 | 빈백 topLeft | 캐릭터 골반 seat |
|---|---:|---|---|
| small | 2 | [36,420], [36,700] | [138,552], [138,832] |
| medium | 2 | [36,400], [36,670] | [138,532], [138,802] |
| large | 4 | [36,440], [36,700], [36,960], [36,1220] | [138,572], [138,832], [138,1092], [138,1352] |

walkingCorridorX=[284,340], walkingCenterX=312입니다. 빈백 오른쪽 경계276과 첫 pod 왼쪽340/350 사이의 발 중심 경로로 예약합니다. 가구를 놓지 않으며, 보행자의 전신 폭에 대한 충돌체가 아니라 발 중심 경로입니다. 슬롯 도착 시 걷기→away 골반 기준 전환은 기존 arrivalAnchor 규칙을 사용합니다. 만석이면 자기 자리 phone/sleeping으로 쉬며, 추가 행/방 높이 확장/바닥 착석을 하지 않습니다.

review/left-lounge-compose.png는 세 방 크기의 빈 배경+왼쪽 빈백/away+기존 격자의 책상+관리자 책상 합성입니다. 각 방 원본 크기 검토용 left-lounge-small/medium/large.png도 있습니다. 슬롯 간 겹침, desk 격자와의 겹침, 삭제한 가구 잔여물을 직접 확인했습니다. 기존 빈백 방향은 오른쪽 앞 그대로입니다. 재생성 파이프라인은 이전 단계들 후 build_left_lounge.py를 마지막에 실행하세요. assets 밖 scene은 수정하지 않았습니다.

왼쪽 휴식 구역 수정 후 런타임은 1,407,596 → 1,351,350 B입니다.


## 현재 좌석 밀도: 세로180px, 하단20px 겹침 허용

기존 약260~280px 간격을 **180px**로 줄였습니다. 빈백 높이200이므로 아래 빈백이 위 빈백 하단20px를 살짝 덮습니다. x=36과 통로[284,340], 중심312는 유지합니다. 골반seat=topLeft+[102,132]입니다.

| 방 | 최대 좌석 | topLeft (방 월드 논리 좌표) |
|---|---:|---|
| small | 3 | [36,400], [36,580], [36,760] |
| medium | 3 | [36,390], [36,570], [36,750] |
| large | 6 | [36,400], [36,580], [36,760], [36,940], [36,1120], [36,1300] |

restLayout.leftLounge.slotStride=[0,180], verticalOverlap=20입니다. **빈백back→캐릭터→빈백front를 한 그룹**으로 묶어 slot.topLeft.y 오름차순으로 그립니다. 모든 back을 먼저 그리고 모든 actor를 나중에 그리면 의도한 깊이 순서가 깨질 수 있습니다. 앞/뒤 그룹이 겹치는 영역은 빈백 하단으로 제한되며 얼굴과 컵은 위쪽에 있어 가려지지 않습니다. managerSlot과 방 높이는 변경하지 않았습니다. 최대좌석은 비운 바닥과 원래 방 경계 안에서 계산했습니다. 만석이면 자기 자리에서 쉽니다.

review/left-lounge-compose.png와 크기별 원본 검토 이미지를 모든 좌석이 찬 상태로 갱신하고 얼굴·컵·책상/통로 간격을 직접 확인했습니다. 이미지 재생성은 없으며 배경·시트 런타임 바이트는 그대로입니다.


## Visual QA 010/011/013/014/015 반영

- VQA-010: attention 시트(80×96,3프레임,anchor[40,88])를 명확한 노란 느낌표 ! 말풍선으로 교체했습니다. 키는 유지합니다. effectPlacement.attention에 현재 그려진 포즈의 머리 위10px/아래중앙anchor 계약을 추가했습니다. 착석점에서 키를 빼는 기존 위치 계산은 scene에서 바꿔야 합니다.
- VQA-011: flame_aura(128×160,4프레임,anchor[64,144])를 머리 위 고리 대신 좁은 몸 양옆 리본 형태로 교체했습니다. 실제 그림은 셀 안72×106 이하로 축소하여 폭이 줄었습니다. effectPlacement.flame_aura는 몸통 기준·캐릭터폭0.6 이하·모니터 영역 제외 클립을 명시합니다. desk-back에 모니터가 포함되어 있으므로 효과를 그 뒤/앞에 놓는 순서만으로 모든 겹침을 막을 수 없습니다. scene의 몸통 위치/클립 적용이 필요합니다. Zzz는 에셋을 변경하지 않았고 effectPlacement.zzz에 머리 왼쪽 위 배치 조건만 적었습니다.
- VQA-013: lead-back/front-small/medium/large를 투명 여백과 키보드 배치를 맞춰 정리한 생성 이미지에서 다시 분리하고, alpha<16 잔여를 제거했습니다. 기존 sourceBox·크기·seat는 유지합니다. 대형 배경 오른쪽 아래 원본[1000,1030,1254,1254] 사각형만 생성된 빈 바닥으로 교체했습니다. 나머지 배경은 유지했습니다. review/lead-residue-after.png와 vqa-corner-after.png에서 확인할 수 있습니다. 투명 RGBA를 RGB로 바로 변환하면 alpha0의 숨은 RGB가 보이므로 알파 확인은 반드시 바닥에 합성한 결과로 해야 합니다.
- VQA-014: assets/reference/provider-icons에는 claude/codex/antigravity/copilot/muse/opencode 6종만 존재하고 gemini가 없습니다. scene/generate-office.cjs는 이6종만 하드코딩해 임베드하며 draw.ts는 sprites['provider-icon-'+provider]가 없으면 원을 그립니다. 따라서 gemini 누락과 임베더/렌더러 fallback이 함께 원인입니다. 원본 파일은 수정하지 않았습니다. 여섯 원본을 office 안으로 복사해 provider-icon-* assets로 추가하고 중립 provider-icon-default를 생성했습니다. providerIcons는 6종→해당 키, gemini/orchestrator/default→provider-icon-default 매핑입니다. scene은 providerIcons를 조회하고 기본 아이콘으로 fallback해야 합니다. 임베더에 provider-icon- 허용이 필요하며 office 내 아이콘은64논리/40실제이므로 runtimeScale=.625를 사용합니다. 현재 office-assets.ts의 provider-icon-*는 무조건 scale1이라는 예외도 manifest scale을 따르도록 바꿔야 합니다. 외부 reference 아이콘64px를 직접 쓰는 기존 경로만 scale1입니다. gemini 로고를 새로 그리거나 다른 브랜드 로고로 대체하지 않았습니다.
- VQA-015: 모든14개 walk 시트에 locomotion={cycleDistance:128,referenceActorHeight:216,stepsPerCycle:2,cycleSeconds:0.5,speedAtReferenceHeight:256,speedFormula:...}를 추가했습니다. 거리·속도는 논리 px/초입니다. 표시높이200이면 약237px/s입니다. 시각적 보폭 추정치이며 측정한 루트모션 데이터가 아닙니다. 원래 프레임과 fps는 유지합니다. scene이 이 정보로 경로 진행과 애니메이션 위상을 동기화해야 합니다.

새 최상위 키는 effectPlacement, providerIcons입니다. 기존 시트 id/frameW/H/frames/fps/anchor는 유지하며, walk 시트에 locomotion만 추가했습니다. assets 새 키는 provider-icon-{claude,codex,antigravity,copilot,muse,opencode,default}입니다. 변경 시트 GIF와 전체 contact-sheet를 재생성했습니다. 생성 프롬프트 원문은 src/vqa-generation.json입니다. 재현은 fix_vqa_art.py → refresh_reviews.py → validate_half.py를 기존 빌드 단계 마지막에 실행합니다. assets 밖 scene/VQA 문서는 수정하지 않았습니다.


## VQA-019: 보이는 어깨 불꽃 / VQA-020: 가구 비례 계약

flame_aura의 id/128×160/4프레임/8fps/anchor[64,144]는 유지하고, 가는 리본을 굵은 노란 심지의 어깨 뒤 불꽃으로 교체했습니다. 최대 inkBounds=[2,8,126,108], 하단[0,109,128,160]은 비웁니다. effectPlacement.flame_aura는 이전 설정을 대체합니다.

- 현재 포즈의 **160×216 원본 프레임 좌상단** 기준 anchorInActorFrame=[44,166]. sheetAnchor=[64,144].
- actorScale=현재 그리는 전체 인물 프레임 높이/216. 효과 크기=[128,160]×actorScale.
- 효과 좌상단=인물 프레임 좌상단+([44,166]−[64,144])×actorScale. 따라서 그림은 인물 프레임 기준 대략x−18..106,y30..130에 있어 손·키보드(약y137)보다 위에 머뭅니다. 프레임 투명 여백을 빼고 보이는 몸만의 bbox를 이 공식에 넣으면 안 됩니다.
- 불꽃 뒤→인물1회. 모니터/키보드/명판 영역만 제외하고 **인물 불투명 실루엣 내부로 불꽃을 교집합 클립하지 않습니다**. 기존 몸통 재그리기와 과도한 클립을 유지하면 새 자산도 다시 가려집니다. 현재 불꽃은 몸 왼쪽 뒤로 치우쳐 모니터 쪽 폭을 줄였습니다.
- review/flame-on-off.png는 7명×4프레임의 동일 배율 켜짐/꺼짐 비교, flame-on-off-detail.png는 확대입니다. 로컬 단순 합성에서 960/1536 배율 환산시 인물당 변경 픽셀556~1144(device px 추정)로 확인했습니다. 실제 scene의 클립을 적용한 패널 측정값은 아니므로 QA에서 새 위치 계약 적용 후 회귀 확인해야 합니다. GIF와 contact sheet도 갱신했습니다. 프롬프트는 src/vqa019-generation.json입니다.

새 최상위 furnitureProportions는 전체 프레임 표시 높이 H 대비 비례입니다. **머리 높이·상체 클립 높이와 혼용하지 마세요.** 각 pods/leadDesks/beanbags에 referenceActorFrameHeight와 moduleScaleFormula도 추가했습니다.

| 모듈 | 기준 인물 프레임H | 폭/H | 높이/H·추가 기준 |
|---|---:|---|---|
| 일반 pod |320|1.4844~1.5063|키보드 폭/H=.46875, 높이/H=.09375|
| lead small / medium / large |320|1.625 / 1.55625 / 1.415625|의자 등받이 대략 폭/H=.44, 높이/H=.34; 키보드 폭/H=.46875|
| 빈백 |256|.9375|높이/H=.78125, 좌면/H=[.3984375,.515625]|

moduleScale=목표 인물 전체 프레임H/referenceActorFrameHeight입니다. **가구 크기·seat·키보드 사각형·actor 오프셋·actorHeight를 전부 같은 moduleScale로 변환**합니다. lead sourceBox는 배치 기준이고, 이것을 강제로 채우려고 가구만 원래 크기로 유지하면 안 됩니다. 인물 키를 줄이면 lead 세트도 seat 피벗 기준으로 줄입니다.

예: 빈백에서 인물H=200이면 빈백187.5×156.25, 인물H=160이면 빈백150×125입니다. 멤버 desk 인물H=200이면 pod폭 약297~301, 키보드폭93.75입니다. lead small 인물H=200이면 책상폭325, 키보드폭93.75입니다.

away 그림의 실제 불투명 몸 높이는 전체 프레임의 .667~.759입니다. 기준H256에서 몸 높이170.67~194.37이고 빈백 높이200/몸 높이=1.029~1.172입니다. furnitureProportions.awayPoseMetrics에 외형별 bbox를 기록했습니다. 정한 허용비율 .9~1.25 안에 있으므로 **빈백 원본 크기는 변경하지 않았습니다**. review/proportion-guide.png에서 H256/200/160을 가구와 함께 축소한 합성을 확인했습니다. QA의 과대 빈백은 가구와 인물의 독립 축소를 해결해야 합니다.

재현: 기존 빌드 마지막에 vqa020_proportions.py → vqa019_flame.py → refresh_reviews.py → validate_half.py를 실행합니다. scene 코드는 이 작업에서 수정하지 않았습니다. runtimeScale .625, q85/alpha100/method6 유지입니다.


## 현재 착석: 몸은 상판 뒤 끝 / 손만 상판 위

상판 앞 모서리가 아니라 **뒤 모서리 tableRearY**를 몸통 가림선으로 바꿨습니다. pod-back/front 3종과 lead-back/front 3종을 같은 생성 원본에서 다시 분리하고, 키보드/마우스를 뒤 모서리 바로 앞으로 옮겼습니다. 상판 전체는 front에 포함되어 몸통 앞을 가립니다. 기존 이미지 생성 원본을 재조립했으며 인물 시트 원본과 방/빈백 배치는 바꾸지 않았습니다.

| 모듈 | 새 seat | tableRearY | 키보드 rect |
|---|---|---:|---|
| pod0 |[177,157]|157|[152,163,130,26]|
| pod1 |[176,159]|159|[151,165,130,26]|
| pod2 |[178,159]|159|[153,165,130,26]|
| lead small |[234,187]|187|[209,193,130,26]|
| lead medium |[224,182]|182|[199,188,130,26]|
| lead large |[204,171]|171|[179,177,130,26]|

여기서 seat는 **몸통이 뒤 모서리에 닿는 지점**입니다. 각 모듈 actorAnchor=[80,125]로 바꿨습니다(160×216 프레임 기준). 원래 시트의 발 anchor[80,205]는 그대로이며 착석에서 그대로 쓰면 안 됩니다. actorHeight는 기존320입니다. origin = seat−actorAnchor×(320/216)+actorStateYOffset+actorOffsets. 모든 값을 기존 moduleScale로 함께 줄입니다. working yOffset0, phone−8, sleeping+30입니다. working actor별 오프셋은 손 중심을 [100,137]로 정렬한 값이며 4프레임 공통으로 유지합니다.

actorClip=[0,−80,moduleWidth,tableRearY+1]은 **몸통 패스에만** 적용합니다. actorSourceClip은 working[0,0,160,145], phone[0,0,160,152], sleeping[0,0,160,138]입니다. 몸통은 뒤 모서리에서 가려지고 넓은 상판이 앞에 보입니다. 위쪽−80 여백은 뒤로 이동한 머리를 자르지 않기 위한 것입니다.

새 **필수 그리기 순서**: desk back → actor BODY(뒤 모서리 클립) → desk front(전체 상판·키보드 포함) → actorOverlay(손/폰/수면 머리·팔만) → 명판. 몸통 전체를 front 다음에 다시 그리면 결함이 재발합니다.

workingHandOverlays[actorId]에 hands-actor-0/1/2/3/4/5-working, hands-orchestrator-working 7개 시트를 추가했습니다. 각160×216/4프레임/8fps, 원본 working과 프레임 번호·배율·위치가 정확히 같습니다. 기존 생성 픽셀에서 손 피부와 주변2px 테두리를 알파 추출한 것이며 다시 그리지 않았습니다. actorOverlay.working.preferSheet=true이고 sheetByActor 매핑을 사용하세요. **손 시트도 몸통과 같은 origin과 actorOffsets로** 놓습니다. rect fallback은 소매 사각 잘림이 보일 수 있으므로 이 시트가 우선입니다. sheet 기본 anchor가 발 기준이어도 목적지 원점은 모듈 actorAnchor[80,125]로 구한 원점과 같아야 합니다.

phone과 sleeping은 actorOverlay의 sourceRects를 같은 프레임·같은 origin으로 front 뒤에 그립니다. sourceRects는160×216 셀 좌표이고 런타임 crop에는0.625를 곱합니다. 이 패스에는 몸통 actorClip을 재사용하지 않고 actorOverlay.clipInModule=[0,tableRearY−12,width,tableRearY+65]를 적용합니다. phone은 손/휴대폰만, sleeping은 머리와 팔만 상판 뒤쪽에 놓습니다. 키보드.layer는front-tabletop-before-hands이며 back 위에 키보드를 별도로 중복해서 그리지 않습니다.

review/desk-compose.png는 작업84개+phone/sleeping42개 총126개를 새 규칙으로 합성했습니다. typing-hands-detail.png는6명×4프레임 확대입니다. body 중앙이 상판 중간에서 솟는 조합이 없고, 소품과 키보드가 겹치지 않는지 확인했습니다. 렌더러가 rearSeatContract, actorOverlay, workingHandOverlays를 적용해야 같은 결과가 나옵니다. 원본 상태 시트49개는 유지하고 손 오버레이7개가 추가되어 총56시트193프레임입니다. runtimeScale .625, q85/alpha100/method6 유지입니다. 재현은 기존 빌드 마지막에 fix_rear_seats.py → refresh_reviews.py → validate_half.py를 실행합니다.


## VQA-028/029: 팔·소매 전체 오버레이 / 왼쪽 의자 가림 제거 (현재)

새 최상위 **armOverlays[actorId][working|phone|sleeping]**가 정식 매핑입니다. 원본160×216 프레임의 RGBA에서 어깨 아래~팔꿈치~손끝의 소매·팔을 다각형 알파 마스크로 잘랐습니다. working은 양팔·소매와 몸통 접합부만, phone은 두 팔·소매·폰, sleeping은 머리·팔·소매를 포함합니다. 배·무릎·다리는 제외했습니다. 피부색만 추출하던 옛 방식은 사용하지 않습니다. 원본 위치·프레임 번호·배율을 유지하며 원본 캐릭터 시트를 다시 그리거나 패킹 크기를 바꾸지 않았습니다. 마스크 좌표/출처는 src/arm-overlay-masks.json입니다.

호환 workingHandOverlays와 기존 hands-*-working 7개 시트 id는 유지하지만 내용은 이제 소매와 팔뚝까지 포함합니다. 새 시트는 arms-{actor-0..5,orchestrator}-{phone,sleeping} 14개입니다. 각 원본 상태 시트와 프레임 수/fps/loop/anchor가 같으며 frameW/H=160×216, 런타임셀100×135입니다. 새 armOverlayContract는 **원본 몸통과 같은 destination origin, actorOffsets, 배율, 애니메이션 위상**을 사용하도록 명시합니다. 오버레이 anchor를 별도로 계산하면 안 됩니다.

각 pods/leadDesks.actorOverlay는 세 상태 모두 preferSheet=true와 sheetByActor를 제공합니다. 기존 scene actorOverlay 코드도 이 매핑을 따르면 새 팔 시트를 쓸 수 있습니다. 새 그리기 순서: **몸통 → 상판 → armOverlays(팔·소매·폰·머리) → 명판**. 오버레이를 몸통의 뒤 모서리 클립으로 자르면 팔이 다시 사라집니다. actorOverlay.clipInModule은[-256,−256,width+256,tableRearY+90]으로 어깨와 머리까지 충분히 넓혔습니다.

actorSourceClip의 working/phone/sleeping은 전부 **[0,0,160,216]**입니다. 셀 내부의 인물 윤곽을 자르지 않습니다. 기존 이웃 프레임 조각은 이전 안전 절단으로 제거되었고 전체 검사에서 잔여 조각이 없어 추가 셀 확장은 필요하지 않았습니다. body actorClip도[-256,−256,width+256,tableRearY+2]로 좌우·위를 넓혔으며 아래쪽 상판 가림선만 유지합니다.

세로 절단의 실제 주요 원인은 front가 좌측 책/머그컵 영역뿐 아니라 **의자 왼쪽 윗부분까지 직사각형으로 복사**해 머리카락/포니테일 위에 그려지는 것이었습니다. 이제 상판 뒤 모서리 위의 왼쪽 의자는 전부 back에만 있습니다. front는 tableRearY 아래 전체 상판과 오른쪽 앞 소품만 포함합니다. frontLayerContract.noLeftChairAboveRear=true이며 이 구역 알파가0인지 자동 확인합니다. 책·머그컵과 인물은 위치상 겹치지 않습니다.

desk back은 전체 가구 그림을 유지하고 front가 같은 상판을 덮습니다. 이 방식과 몸통 클립의2px 겹침으로 별도 리샘플링 경계의 투명 틈을 막습니다. 가구의 불투명 내부(alpha≥240)는255로 정규화하고 극저알파<16 잔여만 지웠으며 RGB/팔레트는 유지했습니다. 원본이 없는 그림을 코드로 만들지 않았습니다.

review/desk-compose.png는 기존126개 조합, typing-hands-detail.png는 손만이 아니라 어깨~손 전체6명×4프레임 확대입니다. 크기별 pod/manager 검토 이미지도 갱신해 팔 연결, 포니테일/후드/수면 머리 외곽, 상판 이음선을 직접 확인했습니다. 총70시트233프레임이며 상태별 팔 오버레이 GIF와 contact sheet를 갱신했습니다. 재현은 기존 빌드 마지막에 fix_arm_overlays.py → refresh_reviews.py → validate_half.py입니다. runtimeScale .625, q85/alpha100/method6 유지, assets 밖은 수정하지 않았습니다.


## VQA-031: large 아래쪽 걸레받이

background-large(runtime/background-large.webp,785×785)의 맨 아래에 small/medium과 같은 진한 갈색 벽선·금색 윗테두리·짙은 하단선을 추가했습니다. office-c/현재large/medium을 참조해 생성한 벽선만 잘라 원화 마지막20행(y1234..1254)에 합성했습니다. y<1234의 모든 픽셀은 원본과 동일합니다. 기존 source는 src/modules/background-large-before-vqa031.png로 보존했으며 생성 프롬프트는 src/vqa031-generation.json입니다. 별도 static-background-large 별칭 파일이 있으면 함께 갱신합니다(현재 별칭 없음).

assets.background-small/medium/large 모두 같은 **bottomTrim** 형식을 추가했습니다. height=24/destinationHeight=24는 방 월드 논리px, anchor=bottom입니다. small/medium sourceRect=[0,1000,1536,24], large sourceRect=[0,1234,1254,20]이며 sourceRect는 원본 PNG 좌표의[x,y,width,height]입니다. large runtimeRect=[0,771.25,783.75,12.5]는 .625배 실제 WebP 좌표이며 투명 패딩을 제외합니다. 소수점 crop은 허용하고 반올림해 다른 행을 포함시키지 마세요.

새 최상위 backgroundTrim={wallHeight:400,bottomTrimHeight:24,...}도 추가했습니다. sourceRect를 sceneY+sceneHeight−24부터 높이24로 그려 방 끝에 붙이고 중간 바닥만 늘립니다. 현재 scene의 하드코딩된24px trim도 새 벽선을 샘플링하므로 호환됩니다. 방 높이·가구·캐릭터는 변경하지 않았습니다. review/vqa031-bottom-trim.png에서 세 배경 하단을 비교했고, review/background-large-bottom.png는 최종 런타임 아래80px입니다. 재현은 기존 빌드 마지막에 fix_bottom_trim.py → validate_half.py입니다. runtimeScale .625, q85/alpha100/method6, runtime785×785 유지입니다.
