# Agent Office v8 — 이미지 생성 시안

Codex 내장 image_gen으로 글 프롬프트만 사용해 생성했습니다. 참조 이미지 입력, 코드 드로잉, 이미지 후처리는 사용하지 않았습니다. 1536×1024 PNG 원본 3장입니다. [로컬 갤러리](index.html).

정적 콘셉트이며 HUD 값은 목업입니다. 최종 원본을 직접 열어 주요 텍스트·얼굴·손을 점검했습니다. 큰 왜곡이나 깨진 주요 문구는 발견하지 못했습니다.

## A — 낮 스튜디오

- 파일: office-a.png
- 장점: 밝은 채광과 역할별 코너가 잘 읽힙니다.
- 약점: 가구와 인물이 밀집해 개별 캐릭터 분리에 수작업이 필요합니다.

### 프롬프트 원문

```text
Use case: stylized-concept. Asset: original pixel game office concept screenshot for an agent software development studio. Generate one landscape image, ideally 1536x1024. Bright warm authentic 16-bit pixel art, crisp intentional pixel clusters, three-quarter overhead view showing furniture tops and fronts. A dense cozy office full of desks, mixed CRT and LCD monitors, chairs, plants, whiteboard, bookshelves, sofa and a small rest bed. Exactly ten short plump human staff with original 2-to-3-head proportions: five typing at desks, two of those surrounded by animated-looking pixel flame auras to indicate intense focus; two sleeping, one slumped at a desk and one in bed with readable "Zzz"; two leaning in chairs looking at smartphones; one clearly distinguished orchestrator with white hair and glasses seated at a larger coordination desk. Warm expressive simple coherent faces, plausible compact pixel hands, no distorted anatomy. Above working staff small "+3" and "+10" popups and occasional short "Done!" and "PR up!" speech bubbles. Original upper and lower game HUD bars with clean readable English pixel lettering, exact text only: "DAY 07", "09:41", "ACTIVE 6/10", "DONE 128", "TOKENS 42.8k", "TESTS 98.6%", "ORCHESTRATOR", "+3", "+10", "Done!", "PR up!", "Zzz". Spread metrics with generous clear spacing, no additional pseudo-text; screens may contain abstract code lines. Design the character silhouettes, palette details, HUD arrangement and geometric metric icons from scratch. No logos, trademarks, currency signs, watermarks, imitation of any specific existing game, or reference images. Compose as a full game scene filling the frame, not a laptop mockup.
Variant A: sunny daytime single studio. Honey oak floor, pale pistachio walls, dusty blue chairs, apricot light, plum outlines. Broad rectangular room, staggered desk islands, large windows on back wall, raised manager nook in upper right, rest corner lower left. Natural light, welcoming busy mood. Upper HUD has the title-free date and clock at left and work metrics at right; bottom HUD groups tokens and test progress with original small square and ladder-shaped icons.
```

## B — 저녁 스튜디오

- 파일: office-b.png
- 장점: 불꽃과 노을 조명이 몰입 상태를 강조합니다.
- 약점: 따뜻한 색이 겹쳐 상태별 색 대비 보강이 필요합니다. 시간은 비교용 공통 목업 값입니다.

### 프롬프트 원문

```text
Use case: stylized-concept. Asset: original pixel game office concept screenshot for an agent software development studio. Generate one landscape image, ideally 1536x1024. Bright warm authentic 16-bit pixel art, crisp intentional pixel clusters, three-quarter overhead view showing furniture tops and fronts. A dense cozy office full of desks, mixed CRT and LCD monitors, chairs, plants, whiteboard, bookshelves, sofa and a small rest bed. Exactly ten short plump human staff with original 2-to-3-head proportions: five typing at desks, two of those surrounded by animated-looking pixel flame auras to indicate intense focus; two sleeping, one slumped at a desk and one in bed with readable "Zzz"; two leaning in chairs looking at smartphones; one clearly distinguished orchestrator with white hair and glasses seated at a larger coordination desk. Warm expressive simple coherent faces, plausible compact pixel hands, no distorted anatomy. Above working staff small "+3" and "+10" popups and occasional short "Done!" and "PR up!" speech bubbles. Original upper and lower game HUD bars with clean readable English pixel lettering, exact text only: "DAY 07", "09:41", "ACTIVE 6/10", "DONE 128", "TOKENS 42.8k", "TESTS 98.6%", "ORCHESTRATOR", "+3", "+10", "Done!", "PR up!", "Zzz". Spread metrics with generous clear spacing, no additional pseudo-text; screens may contain abstract code lines. Design the character silhouettes, palette details, HUD arrangement and geometric metric icons from scratch. No logos, trademarks, currency signs, watermarks, imitation of any specific existing game, or reference images. Compose as a full game scene filling the frame, not a laptop mockup.
Variant B: cozy late-afternoon studio. Muted lavender and warm walnut with amber sunset light, teal equipment, soft coral highlights. L-shaped cutaway room arranged around a central shared desk, manager at a large desk on the left rear, couch and bed in a right-side alcove. Warm sky visible through tall windows. Different furniture arrangement and character hairstyles from A. Upper HUD uses a centered clock block with activity on left and completed tasks on right; lower HUD uses two separated horizontal meters for tokens and test success.
```

## C — 두 칸 사무실

- 파일: office-c.png
- 장점: 개발실과 관리자·휴식 구역을 명료하게 분리합니다.
- 약점: 좁은 패널에서는 인물이 작아져 방 단위 확대나 탐색이 필요합니다.

### 프롬프트 원문

```text
Use case: stylized-concept. Asset: original pixel game office concept screenshot for an agent software development studio. Generate one landscape image, ideally 1536x1024. Bright warm authentic 16-bit pixel art, crisp intentional pixel clusters, three-quarter overhead view showing furniture tops and fronts. A dense cozy office full of desks, mixed CRT and LCD monitors, chairs, plants, whiteboard, bookshelves, sofa and a small rest bed. Exactly ten short plump human staff with original 2-to-3-head proportions: five typing at desks, two of those surrounded by animated-looking pixel flame auras to indicate intense focus; two sleeping, one slumped at a desk and one in bed with readable "Zzz"; two leaning in chairs looking at smartphones; one clearly distinguished orchestrator with white hair and glasses seated at a larger coordination desk. Warm expressive simple coherent faces, plausible compact pixel hands, no distorted anatomy. Above working staff small "+3" and "+10" popups and occasional short "Done!" and "PR up!" speech bubbles. Original upper and lower game HUD bars with clean readable English pixel lettering, exact text only: "DAY 07", "09:41", "ACTIVE 6/10", "DONE 128", "TOKENS 42.8k", "TESTS 98.6%", "ORCHESTRATOR", "+3", "+10", "Done!", "PR up!", "Zzz". Spread metrics with generous clear spacing, no additional pseudo-text; screens may contain abstract code lines. Design the character silhouettes, palette details, HUD arrangement and geometric metric icons from scratch. No logos, trademarks, currency signs, watermarks, imitation of any specific existing game, or reference images. Compose as a full game scene filling the frame, not a laptop mockup.
Variant C: wider connected two-room studio, daylight. Cream birch, sage and terracotta with navy outlines and pale aqua windows. Left room is a packed development bullpen; right room is a quiet lounge with sofa, small bed, plant shelves, and the larger orchestrator desk. Open doorway and a short hall connect both rooms. Ten characters distributed across both rooms. Two-room architecture is the dominant composition. Upper HUD is a slim date-and-activity strip, lower HUD is three broad legible statistic groups.
```

## 실제 플러그인 적용에 필요한 작업

- 배경·가구·캐릭터·이펙트·HUD를 별도 레이어 자산으로 제작해야 합니다.
- working / walking / sleeping / phone 상태별 스프라이트, 방향·전환 프레임, 기준점과 충돌 영역이 필요합니다.
- 불꽃·숫자·말풍선은 재사용 가능한 애니메이션으로 분리해야 합니다.
- provider 라벨과 상태·HUD 문자는 실제 UI로 렌더링하고 에이전트 데이터에 연결해야 합니다.
- 50% 축소에서 가독성·픽셀 스케일·가림 순서와 성능을 검증해야 합니다.
