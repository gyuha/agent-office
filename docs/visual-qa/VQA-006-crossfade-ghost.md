# VQA-006 상태 전환 크로스페이드에서 반투명 고스트가 보이고, 불꽃이 몸보다 먼저 나타남

- 심각도: 중간
- 추정 담당: scene (`draw.ts` occupant 크로스페이드, flame 표시 조건)
- 상태: closed

## 증상
- 걷기→착석(자리, 빈백) 전환에서 두 포즈를 각각 `1-mix`와 `mix` 알파로 겹쳐 그린다. 0.35초 동안 캐릭터가 반쯤 투명해지고 윤곽이 두 겹으로 번진다. 배경과 빈백 무늬가 몸을 통해 비친다.
- orchestrator가 리드 책상에 도착하는 프레임에서는 flame_aura가 이미 불투명하게 그려지는데, 몸은 아직 거의 투명하거나 머리만 보인다. "빈 의자가 불타는" 순간이 생긴다.

## 재현 조건
- N=6 away: `setTime(1000)`(plugin이 moss 빈백 도착), `setTime(1900)`(scene이 terracotta 빈백 도착)
- N=6 working visit 복귀: `setTime(36500)`(qa 자리 도착)
- 라이브 away→working 복귀 프레임 4~5 (orchestrator, plugin 자리)

흐름은 다음과 같다.
```
걷기 도착 → [0~0.35s: 걷기 포즈 α↓ + 착석 포즈 α↑ 동시 표시 = 고스트] → 착석
                     └ flame은 α=0.92로 즉시 표시
```

## 스크린샷
- shots/vqa006-n6-away-1000-arrival-ghost.png
- shots/vqa006-n6-away-1900-arrival-ghost.png
- shots/vqa006-n6-visit-return-crossfade.png (36500)
- shots/vqa003-vqa006-vqa007-return-frames0-5.png (프레임 4~5)

## 왜 어색한가
12fps 화면에서 3~4프레임 동안 유령처럼 보인다. 스타일이 딱딱한 픽셀풍이라 반투명 혼합이 특히 눈에 띈다.

## 기대 모습
포즈 전환은 프레임 단위로 바로 바꾸거나(하드 컷), 겹치지 않는 페이드(이전 포즈 α 1→0 후 새 포즈)로 한다. 효과(불꽃, +숫자, 말풍선)는 착석 포즈가 완전히 보인 뒤에 나타난다.

## 재확인 결과 (2026-11-07, 1차 재확인)

- 83ms(12fps) 간격 프레임을 확인했다: 빈백 도착(N6 working→away 5500~5917), orchestrator 도착(2083~2417), 책상 복귀(away→working 5500~5917). 포즈가 한 프레임 만에 바뀌는 하드 컷이고 반투명 겹침이 없다. 불꽃은 착석 뒤에만 그려진다.
- 캡처: shots/recheck-1/r006-n6-orchestrator-arrival-hardcut.png, shots/recheck-1/r006-v016-n6-plugin-desk-arrival.png
- 판정: 해결. closed
