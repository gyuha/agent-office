# Agent Office — 플러그인용 오피스 에셋

[manifest.json](manifest.json) · [GIF 검토 갤러리](review/index.html) · [전체 contact sheet](review/contact-sheet.png)

## 전달 상태

1단계 임시 프레임을 2단계 생성 시트로 교체했습니다. 직원 외형 6종과 흰 머리·안경 관리자 모두 working / phone / sleeping / away / walk_left / walk_right를 갖습니다. 사용자 추가 요청으로 관리자 away·좌우 걷기 키를 1단계 계약에 보강했습니다. 이후 manifest의 키·구조·프레임 크기·fps·loop·기준점·매핑은 그대로이며 sheets의 frames만 갱신했습니다(file 경로도 유지).

모든 그림은 v10 또는 Codex 내장 image_gen의 참조 생성 결과입니다. 모든 새 생성 호출에 office-c와 해당 v10 캐릭터/효과 PNG를 입력하고 transparent_background=true를 사용했습니다. 직접 그림을 그리거나 런타임 도형 효과를 만들지 않았습니다. GIF 직접 생성 기능을 사용한 것이 아니라, 한 이미지에 가로 연속 프레임을 생성하고 잘라 PNG/WebP 시트를 만들었습니다.

- 런타임: **3,199,304 B**, WebP 164개(정적 115 + 시트 49), 5,000,000 B 이하.
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
