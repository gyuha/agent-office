# Visual QA 리포트

visual-qa 역할이 사람의 눈으로 화면을 보고 찾은 어색한 장면을 기록한다. 코드와 에셋은 고치지 않는다. 수정 요청은 orchestrator가 담당 역할에게 전달한다.

## 1차 전수 점검 (2026-11-07)

- 대상: `client/scene/preview.html` (python http.server 8790), Playwright Chromium, DPR2, 480px와 410px
- 시나리오: solo, N=3, 6, 10, 16 × working / phone / away / sleeping / attention / mixed
- 방법: `setTime(ms, generatedAt+ms)`로 0.1~0.25초 간격 프레임을 고정해 캡처했다. away→working 복귀는 setTime이 현재 스냅샷 기준으로 처음부터 다시 재생하기 때문에 재현할 수 없어서, 라이브 루프(resume 후 상태 변경, 약 120ms 간격 캡처)로 확인했다.
- 실제 Paseo 패널: 캡처 당시 오른쪽 패널이 "에이전트 대시보드" 탭이었다. 지시대로 탭은 바꾸지 않아 실제 Office 패널은 이번 점검에 포함되지 않았다.
- 캡처는 `shots/`에 있다.

## 리포트 목록

| 번호 | 제목 | 심각도 | 담당 | 상태 |
|---|---|---|---|---|
| [VQA-001](VQA-001-working-visit-walk.md) | working 중 자리를 떠 "방문" 걷기, 도착 후 제자리걸음 (solo 포함) | 높음 | scene | closed |
| [VQA-002](VQA-002-member-path-through-desks.md) | 멤버 이동 경로가 다른 책상 앞판·명판을 관통 | 높음 | scene | closed |
| [VQA-003](VQA-003-orchestrator-walks-through-lead-desk.md) | orchestrator가 리드 책상을 관통해 출입 | 높음 | scene | closed |
| [VQA-004](VQA-004-manager-beanbag-overlaps-desk.md) | orchestrator 빈백이 첫 줄 오른쪽 책상 의자와 겹침 | 높음 | scene | closed |
| [VQA-005](VQA-005-empty-beanbags-always-visible.md) | 빈 빈백이 항상 보이고 세로로 겹쳐 쌓임 | 중간 | scene (+art) | deferred |
| [VQA-006](VQA-006-crossfade-ghost.md) | 전환 크로스페이드 반투명 고스트, 불꽃이 몸보다 먼저 보임 | 중간 | scene | closed |
| [VQA-007](VQA-007-beanbag-occludes-walker.md) | 빈백 도착 직전 빈백 뒤로 들어가 하반신이 가림 | 낮음 | scene | closed |
| [VQA-008](VQA-008-walkers-overlap-in-lane.md) | 여러 명이 왼쪽 레인에서 동시에 이동하며 서로 겹침 | 중간 | scene | closed |
| [VQA-009](VQA-009-walk-direction-flicker.md) | 레인 진입 시 걷는 방향이 잠깐 뒤집힘 | 중간 | scene | closed |
| [VQA-010](VQA-010-attention-mark.md) | 승인 대기 표시가 "!"가 아니고 머리에 묻히거나 몸과 떨어짐 | 중간 | art + scene | closed |
| [VQA-011](VQA-011-effects-cover-monitor.md) | 불꽃·Zzz가 모니터를 덮음, orchestrator 머리에 불 | 중간 | scene (+art) | closed |
| [VQA-012](VQA-012-scale-mismatch.md) | 인원수별 캐릭터 축척 불일치 (orchestrator, 빈백, 걷기) | 중간 | scene | closed |
| [VQA-013](VQA-013-art-residue.md) | orchestrator 주변 반투명 사각 경계, 배경 구석 잘린 가구 | 낮음 | art | closed |
| [VQA-014](VQA-014-provider-icon-fallback.md) | 명판 provider 아이콘 일부가 색 점으로 대체됨 | 낮음 | art | closed |
| [VQA-015](VQA-015-walk-foot-slide.md) | 걷기 속도가 보폭보다 빨라 미끄러짐 | 낮음 | scene (+art) | closed |
| [VQA-016](VQA-016-actor-vanishes-behind-desk.md) | 자리 출입 때 책상 뒤에서 캐릭터가 완전히 사라짐 | 중간 | scene | closed |
| [VQA-017](VQA-017-path-u-turn.md) | 빈백 왕복 시 아래로 내려갔다 되돌아오는 U턴 경로 | 중간 | scene | closed |
| [VQA-018](VQA-018-movement-queue-delay.md) | 이동 대기열 직렬화로 상태와 화면이 최대 약 39초 어긋남 (N16) | 높음 | scene | closed |
| [VQA-019](VQA-019-flame-aura-invisible.md) | 불꽃 오라가 거의 보이지 않고 orchestrator 키보드 위에 주황 선 | 중간 | scene (+art) | closed |
| [VQA-020](VQA-020-furniture-vs-person-scale.md) | 인물만 줄어 리드 가구·빈백이 인물보다 지나치게 큼 | 낮음 | scene (+art) | closed |
| [VQA-021](VQA-021-lead-nameplate-overflow.md) | N10/N16 리드 명판이 책상보다 넓어 밖으로 튀어나옴 | 중간 | scene | closed |
| [VQA-022](VQA-022-room-height-not-restored.md) | 방 높이가 보고값으로 복원되지 않아 빈 바닥이 큼 | 낮음 | scene | closed |
| [VQA-023](VQA-023-lead-plate-name-truncated.md) | 리드 명판 이름이 "Or…"까지 잘려 읽을 수 없음 | 낮음 | scene | closed |
| [VQA-024](VQA-024-bubble-covers-attention.md) | "PR up!"/"Done!" 말풍선이 승인 대기 "!"를 가림 | 중간 | scene | closed |
| [VQA-025](VQA-025-orchestrator-sinks-into-beanbag.md) | orchestrator가 측면으로 나온 직후 자기 빈백 뒤에 파묻힘 | 낮음 | scene | closed |
| [VQA-026](VQA-026-reversal-seated-pose-off-seat.md) | 이동 중 상태 반전 시 대기 동안 앉은 포즈로 책상 앞·빈백 옆 바닥에 떠 있음 | 중간 | scene | closed |
| [VQA-027](VQA-027-body-rises-from-desk-middle.md) | 캐릭터 몸이 책상 상판 한가운데에서 솟아오름 (사용자 피드백) | 높음 | art + scene | closed |
| [VQA-028](VQA-028-forearms-hidden-by-desktop.md) | 착석 인물의 팔뚝이 상판에 가려 손만 떠 있음 (사용자 피드백) | 높음 | scene (+art) | closed |
| [VQA-029](VQA-029-seated-actor-vertical-clip-edge.md) | 착석 인물 왼쪽이 세로 직선으로 잘림, 어깨 높이 가로 이음선 | 중간 | scene | closed |
| [VQA-030](VQA-030-bottom-row-too-close-to-floor-edge.md) | 하단 책상이 방 아래쪽 벽에 너무 붙음 (사용자 피드백) | 중간 | scene | closed |
| [VQA-031](VQA-031-large-room-missing-bottom-wall.md) | large 방(N7~16)에 아래쪽 벽선이 없어 바닥이 잘린 것처럼 보임 | 중간 | art + scene | closed |
| [VQA-032](VQA-032-large-room-bottom-margin-inconsistent.md) | large 방 마지막 행 아래 빈 바닥이 28~184px로 들쭉날쭉 | 중간 | scene | closed |
| [VQA-033](VQA-033-all-scope-masonry-layout.md) | 전체 화면 카드를 세로 한 열 대신 masonry로 배치 (사용자 요청) | 중간 | scene | closed |
| [VQA-034](VQA-034-masonry-reading-order-scatters-projects.md) | masonry에서 같은 프로젝트 카드가 흩어지고 읽는 순서가 어긋남 | 낮음 | scene | closed |
| [VQA-035](VQA-035-grid-card-nameplate-truncation.md) | 전체 화면 카드(376px)에서 N10/N16 명판 이름이 잘림 | 중간 | scene | closed |
| [VQA-036](VQA-036-grid-card-blank-on-scroll.md) | 스크롤로 들어오는 카드가 최대 약 87ms 빈 상태로 보임 | 중간 | scene | closed |
| [VQA-037](VQA-037-office-status-filter-bar.md) | 오피스 상태 필터 바 점검 (forge #1 S4) | - | scene | closed |
| [VQA-038](VQA-038-filter-entering-card-blank.md) | 필터 결과에 새로 들어오는 카드가 약 70~85ms 빈 카드로 보임 | 중간 | scene | closed |
| [VQA-039](VQA-039-narrow-scope-all-card-plates.md) | 전체 화면 폭 약 440px 이하에서 카드 378px, N16 명판 잘림 | 낮음 | scene | closed |
| [VQA-040](VQA-040-awaiting-question-pose.md) | 질문 대기 모션 점검 (forge #2 S4) | - | scene + art | closed |
| [VQA-041](VQA-041-question-bubble-covers-manager-plate.md) | 질문 대기 모션: 첫 줄 가운데 멤버 '?' 말풍선이 orchestrator 명판을 가림 (N4~6) | 중간 | scene | closed |
| [VQA-042](VQA-042-question-bubble-extra-glyph.md) | 질문 대기 모션: '?' 옆 노란 강조가 실제 크기에서 두 번째 글자처럼 보임 | 낮음 | art | closed |
| [VQA-043](VQA-043-shifted-question-bubble-ownership.md) | 질문 대기 모션: 명판을 피해 옮긴 '?' 말풍선이 orchestrator 책상에 붙어 주인을 헷갈림 | 중간 | scene | closed |
| [VQA-044](VQA-044-awaiting-pose-too-low.md) | 질문 대기 모션: 대기 자세가 책상 쪽으로 내려가 의자에 앉아 보이지 않음 (사용자 피드백, 1회 reopened) | 중간 | art + scene | closed |
| [VQA-045](VQA-045-sidebar-awaiting-badge-flow.md) | 사이드바 질문 대기 배지와 클릭 흐름 점검 (실제 Paseo 앱, 같은 params로 다시 누르는 경우는 범위 밖, 후속 작업) | 중간 | scene | closed |
| [VQA-046](VQA-046-sidebar-badge-brown-not-warning.md) | 사이드바 질문 대기 배지가 주황이 아니라 갈색·회갈색으로 깜빡이고 Observatory 배지보다 작음 | 중간 | scene | closed |

## 1차 재확인 (2026-11-07)

- 방법: 각 리포트의 재현 조건을 그대로 다시 캡처했다(480px와 410px, DPR2). 상태 전환은 새로 추가된 `preview.setTransition(from, to, ms)`로 시간을 고정해 250ms 간격으로 보고, 도착 구간은 83ms(12fps) 간격으로 봤다. 캡처는 `shots/recheck-1/`에 있다.
- 결과: closed 13건(001~004, 006, 008~015), reopened 1건(007), deferred 1건(005), 신규 5건(016~020)
- scene 보고 수치 확인: 480px 기준 방 높이 N6 489px, N16 662px(헤더 포함 캔버스 N6 980, N16 1324 device px, DPR2 = 490/662 CSS px. N6의 1px 차이는 스크린샷 반올림으로 본다)로 일치한다.
- 실제 Paseo 패널: 재확인 시점에도 오른쪽 패널이 "에이전트 대시보드" 탭이었다(orchestrator 대화에 "Agent Office 탭 전환이 실패"라는 기록이 있다). 지시대로 탭은 조작하지 않아 실제 Office 패널은 이번에도 확인하지 못했다. 캡처: `/tmp/vqa2/live.png`

## 2차 재확인 (2026-11-07)

- 방법: 각 리포트 재현 조건으로 다시 캡처했다. `setTransition`으로 solo, N3, N6, N10, N16 양방향 전환을 100ms 간격 0~9초 수치 추적했다(출발 지연, 순간이동, 레인 겹침, 이전 상태 자세 유지 시간). 도착과 출발 구간은 83ms(12fps)로 캡처했다. 캡처는 `shots/recheck-2/`에 있다.
- 결과: closed 6건(007, 016~020), reopened 1건(003, 회귀), 신규 2건(021, 022)
- 018 기준 측정: 출발 지연 최대 300ms, 이전 상태 자세 최대 400ms, 100ms당 최대 이동 22 logical px(순간이동 없음), 레인 근접(60 logical px 미만) 0건, 도착 완료 N6 4.7초, N16 5.3초(scene 보고 4.65초와 5.2초에 부합)
- 방 높이: scene 보고(N6 386px, N16 546px)와 달리 preview에서는 N6 489px, N16 660px로 측정됐다. 그래서 VQA-022로 적었다.
- 실제 Paseo 패널: 오른쪽 패널이 여전히 "에이전트 대시보드" 탭이라 확인하지 않았다(탭 조작 금지). 캡처: `/tmp/vqa3/live.png`

## 3차 재확인 (2026-11-07)

- 방법: 003, 021, 022 재현 조건으로 다시 캡처했다(orchestrator 전환은 83ms 간격). solo, N3, N6, N10, N16 양방향 전환 수치 추적을 다시 했다: 출발 지연 최대 300ms, 이전 상태 자세 최대 400ms, 100ms당 최대 이동 22 logical px, 레인 근접 0건, 도착 완료 N6 4.2초, N16 4.7초. 캡처는 `shots/recheck-3/`에 있다.
- 결과: closed 3건(003, 021, 022), 신규 3건(023, 024, 025). 열린 문제가 0건이 아니어서 전체 최종 훑기는 하지 않았다. 다만 N=1, 3, 6, 16 × 480px/410px × working, phone, sleeping, away, attention 정지 화면 40장은 미리 캡처해 봤다(`shots/recheck-3/r3-sweep-*.png`). 024 외에 새 어색함은 찾지 못했다.
- 실제 Paseo 패널: 오른쪽 패널이 계속 "에이전트 대시보드" 탭이라 확인하지 않았다(탭 조작 금지).

## 4차 재확인 (2026-11-07)

- 대상: 023, 024, 025와 qa 결함 4건(N4~6 manager 경로의 g1 책상 관통, N3 복귀 겹침, 이동 중 상태 반전 때 책상 관통, 액터 없는 hitTest 예외)
- 방법:
  - `setTransition`: N4, N5, N6 manager 양방향을 166ms 간격, 025는 83ms 간격으로 캡처했다. solo, N3, N6, N10, N16 양방향 수치 추적도 다시 했다.
  - 라이브 루프 반전 시나리오: N3, N4, N5, N6, N16에서 working→away→(0.5초)→working과 away→working→(0.5초)→away를 30ms 간격으로 추적했다. 순간이동, 다른 책상 관통(발이 다른 책상 몸통 안), 이동 중 근접(50×40 logical px)을 검사했다.
  - 정지 화면 전수 점검: N=1, 3, 6, 16 × 480px/410px × working, phone, sleeping, away, attention, 40장
  - hitTest: 빈 스냅샷과 상태 전환 중 캔버스 전체 격자 클릭
- 결과:
  - closed 3건(023, 024, 025)
  - qa 결함 4건 모두 재현되지 않음: manager 관통 0프레임, N3 겹침 0건, 반전 중 다른 책상 관통 0건, 클릭 예외와 콘솔 오류 0건
  - 수치: 출발 지연 최대 300ms, 이전 상태 자세 최대 400ms, 100ms당 최대 이동 22 logical px, 도착 완료 N3 5.8초, N6 4.2초, N16 4.7초
  - 신규 1건: 026. 반전 때 시차 대기 동안 좌석 밖에서 앉은 포즈가 그려진다.
- 결론: 열린 문제가 1건(026)이라 "열린 문제 0"으로 정리하지 않았다. 026이 닫히면 반전 시나리오만 다시 확인하면 된다.
- 실제 Paseo 패널: 탭 조작 금지로 확인하지 않았다.

## 5차 재확인: 열린 문제 0 (2026-11-07)

- 대상: VQA-026
- 방법: `setTransitionSequence`로 N3, N6, N16 × 양방향 × 반전 시점 200, 500, 1500ms(18조합)를 시간 고정 재생했다. 반전 후 0~7초를 100ms 간격으로 수치 추적하고, 대표 조합은 83ms 간격으로 캡처했다. 캡처는 `shots/recheck-5/`에 있다.
- 결과: 026 closed. 좌석 밖 정지 0ms, 순간이동 0건, 책상 관통 0건, 이동 중 근접 0건, 오류 0건
- 현재 상태: 열린 문제 0건(open/reopened 없음). 26건 중 closed 25건, deferred 1건(005, 사용자 결정으로 보류)
- 확인하지 못한 것: 실제 Paseo 패널. 매 회차 오른쪽 패널이 대시보드 탭이었고 탭 조작 금지라 preview 기준으로만 확인했다.

## 6차 재확인 (2026-11-07, 사용자 피드백 "몸이 책상 가운데에서 올라옴")

- 대상: VQA-027(신규 기록, seat를 상판 뒤 모서리로 이동, 몸통 → 상판 → 손 오버레이 순서)
- 방법:
  - 정지 화면: N=1, 3, 6, 16 × 480px/410px × working, phone, sleeping, attention(flame 포함) `setTime(20000)` 32장, 착석 인물은 확대해 확인
  - 출입 전환: `setTransition` N6 양방향 83ms 캡처. solo, N3, N6, N10, N16 양방향 수치 추적. `setTransitionSequence` N3/6/16 × 양방향 × 반전 200/500/1500ms
- 결과:
  - 027 closed: 몸통 위치가 상판 뒤 모서리로 바뀌었다.
  - 신규 028(높음, 사용자도 실제 패널에서 지적): 팔뚝 소실
  - 신규 029(중간): 세로 직선 잘림과 가로 이음선
  - 출입 경로, 빈백, 이펙트(Zzz, "!", 불꽃, 말풍선) 위치에는 새 어색함이 없다. 수치는 5차와 같다(출발 지연 최대 300ms, 순간이동·관통·겹침 0건, 반전 중 좌석 밖 정지 0ms).
- 캡처: `shots/recheck-6/`

## 매 회차 점검 항목

다음 항목을 모든 재확인에서 본다.
- 착석 위치: 몸통이 상판 한가운데에서 솟아오르지 않는지(VQA-027). 몸은 상판 뒤쪽 모서리에서 시작해야 한다.
- 착석 연결: 어깨에서 손까지 팔이 이어져 보이는지(VQA-028)
- 착석 윤곽: 인물이 직선으로 잘리거나 이음선이 생기지 않는지(VQA-029)
- 이동: 책상·명판 관통, 순간이동, 레인 겹침, 반전 중 좌석 밖 앉은 포즈가 없는지(VQA-002, 003, 008, 026)
- 이펙트: "!"가 가려지지 않는지, 불꽃·Zzz가 모니터를 덮지 않는지(VQA-010, 011, 024)
- 아래쪽 여백: 마지막 행 책상과 아래쪽 벽 사이 여백이 충분하고 인원 수와 관계없이 비슷한지, 아래쪽 벽선이 항상 보이는지(VQA-030, 031, 032). N=1, 3, 5, 6, 7, 10, 16에서 잰다.
- 전체 화면(scope all) masonry: 1200/1600/2000px에서 카드 겹침·간격·열 균형, 같은 프로젝트 카드 위치, 스크롤로 들어오는 카드의 빈 상태, 카드 최소 폭 410px에서 명판 잘림(VQA-033~036)
- 필터 바: 410/480/1200/1600px에서 필터별 결과와 개수, 선택 표시, 빈 결과, sticky 스크롤, 상태 변화 때 카드 출입(빈 카드, 순서)(VQA-037~039)
- 질문 대기 모션: 7명 × 3프레임 손·팔 잘림, '?' 말풍선 위치와 명판 겹침, 실제 크기 가독성, 대기↔타이핑 전환, 걷기 '!' 폴백(VQA-040~043)
- 질문 대기 앉은 자세: 대기 자세는 의자 좌석에 앉아 머리가 등받이 위로, 가슴이 상판 위로 보이는지. 7명 × 3프레임, 480/410px, 진입·해제 오르내림 포함(VQA-044). working과 높이를 맞추는 것은 기준이 아니다.

## 7차 재확인: 열린 문제 0 (2026-11-07)

- 대상: VQA-028(팔 오버레이), VQA-029(소스 클립 전체 셀, 의자 front 잔여 제거, 원본 해상도 합성)
- 방법: 매 회차 점검 항목 전체를 확인했다.
  - 정지 화면: N=1, 3, 6, 16 × 480px/410px × working, phone, sleeping, attention(flame 포함), 32장
  - 출입 전환: `setTransition` N6 양방향 83ms 캡처. solo, N3, N6, N16 양방향 수치 추적
  - 반전: `setTransitionSequence` N3/6/16 × 양방향 × 200/500/1500ms
  - 실제 Paseo 패널: 이번에는 오른쪽 패널이 Agent Office 탭이라 agent-desktop 스크린샷으로 처음 확인했다(탭 조작 없음).
- 결과:
  - 028, 029 closed
  - 점검 항목 전부 이상 없음: 착석 위치(027), 팔 연결(028), 윤곽(029), 이동(관통·순간이동·겹침 0건, 반전 중 좌석 밖 정지 0ms, 출발 지연 최대 300ms), 이펙트("!", Zzz, 불꽃, 말풍선)
  - 신규 없음
  - 실제 패널(N5 그룹, 빈백 2명 사용 중)에서도 preview와 같은 모습이었다.
- 현재 상태: 열린 문제 0건. 29건 중 closed 28건, deferred 1건(005)
- 캡처: `shots/recheck-7/`

## 8차 재확인 (2026-11-07, 사용자 피드백 "하단 책상이 바닥과 너무 가깝다")

- 대상: VQA-030(신규 기록). scene이 마지막 행 아래에 바닥 여백을 추가했다.
- 방법:
  - 멤버 수 1, 3, 4, 5, 6, 7, 8, 10, 12, 13, 16 × 480px/410px로 마지막 책상 아래부터 방 끝까지 거리를 `inspect()` 레이아웃으로 측정하고 캡처했다. preview 시나리오 목록에 5가 없어서 N5 등은 fixture 멤버를 잘라 `setSnapshot`으로 만들었다.
  - 매 회차 점검 항목: solo, N3, N6, N16 전환 수치 추적과 `setTransitionSequence` 반전 18조합
- 결과:
  - 030 closed: small·medium(N1~6)의 여백이 41~63 CSS px이고 벽선도 보인다. 방 높이는 N6 433px, N16 574px로 보고와 일치한다.
  - 신규 031: large 방에 아래쪽 벽선이 없다. orchestrator가 물은 N16 벽선 문제는 캡처가 잘린 것이 아니라 실제 캔버스와 에셋에 벽이 없는 것이다.
  - 신규 032: large 방 여백이 N7·N8 184px, N10·N12 94px, N13~16 33px(480px)로 들쭉날쭉하다.
  - 그 밖의 점검 항목은 이상 없음: 착석 위치, 팔, 윤곽, 이펙트, 이동(출발 지연 최대 300ms, 순간이동·관통·겹침 0건, 반전 중 좌석 밖 정지 0ms)
- 실제 Paseo 패널: 스크린샷 시점에 다른 워크스페이스(fix-drawer)의 "변경 사항" 탭이 열려 있어 확인하지 못했다(탭 조작 금지).
- 캡처: `shots/recheck-8/`

## 9차 재확인: 열린 문제 0 (2026-11-07)

- 대상: VQA-031(large 배경 걸레받이, 모든 방 크기에서 manifest bottomTrim 사용), VQA-032(일정한 하단 여백)
- 방법:
  - 아래쪽 여백과 벽선: N=1, 3, 5, 6, 7, 8, 10, 13, 16 × 480px/410px, `setTime(20000)`, 레이아웃 측정과 전체 캔버스 캡처
  - 매 회차 점검 항목: N6 착석 4상태 확대, solo/N3/N6/N16 전환 수치 추적, `setTransitionSequence` 반전 18조합
- 결과:
  - 031, 032 closed. 모든 방에 걸레받이가 있다. 여백은 small·medium 63px, large 51.3px(480px 기준, 걸레받이 포함)로 방 종류마다 일정하다.
  - 점검 항목 전부 이상 없음: 착석 위치, 팔, 윤곽, 이펙트("!", Zzz, 불꽃), 이동(출발 지연 최대 300ms, 순간이동·관통·겹침 0건, 반전 중 좌석 밖 정지 0ms), 아래쪽 여백
  - 신규 없음
- 실제 Paseo 패널: 다른 워크스페이스(fix-drawer)의 "변경 사항" 탭이 열려 있어 확인하지 않았다(탭 조작 금지).
- 현재 상태: 열린 문제 0건. 32건 중 closed 31건, deferred 1건(005)
- 캡처: `shots/recheck-9/`

## 10차 확인 (2026-11-07, 사용자 요청: 전체 화면 masonry 배치)

- 대상: VQA-033(신규 기록, scope all 카드 masonry 배치)
- 방법:
  - preview `#grid`(6개 프로젝트, 방 10개)를 1200, 1600, 2000px에서 `setTime(20000)`으로 고정하고 카드 사각형을 측정했다(겹침, 간격, 열 바닥).
  - 스크롤: DPR2 라이브 루프에서 60~120px 단위로 스크롤하며, 화면에 보이는 카드의 캔버스가 0×0인 시간을 rAF 단위로 측정했다.
  - 카드 안 방: 매 회차 점검 항목(착석, 팔, 윤곽, 이펙트, 여백·벽선)
- 결과:
  - 033 closed: 3/4/5열, 겹침 0, 간격 20px, 가로 스크롤 없음, 열 바닥 차이는 카드 하나 이내
  - 신규 034(낮음): 같은 프로젝트 카드가 흩어진다.
  - 신규 035(중간): 카드 폭 376px에서 N10/N16 명판이 잘린다.
  - 신규 036(중간): 스크롤로 들어오는 카드가 16~87ms 비어 있다.
- 실제 화면: 사이드바 Agent Office 전체 화면은 열려 있지 않았다. 오른쪽 패널(project 범위 Agent Office)만 열려 있어 masonry를 실제 화면으로는 확인하지 못했다(조작 금지).
- 캡처: `shots/recheck-10/`

## 11차 재확인: 열린 문제 0 (2026-11-07)

- 대상: VQA-034(프로젝트 블록 배치), 035(최소 카드 폭 410px), 036(1200px 앞에서 미리 그리기, 2400px 밖에서 해제)
- 방법:
  - preview `#grid`: 1200, 1600, 2000px와 경계 폭 860, 872, 1300px에서 카드 사각형 측정
  - 라이브 스크롤 빈 카드 측정(1200×600, 1600×700, 2000×800)과 카드별 스크린샷
  - 카드 안 방의 매 회차 점검 항목
- 결과:
  - 034, 035, 036 closed. 2/3/4열, 카드 폭 410~480px, 겹침 0, 간격 20px, 같은 프로젝트는 같은 열에 붙어 있다. 명판은 410px에서도 전체 표시되고, 스크롤 중 빈 카드는 0회다.
  - 카드 안 방: 착석, 팔, 윤곽, 이펙트, 여백·벽선 모두 이상 없음
  - 신규 없음
- 참고(사용자 화면 문제 아님): preview의 `setTime` 정지 모드에서 872px 폭 전체 페이지 캡처를 하면, Delta 그룹 카드 하나가 헤더만 있고 방이 비어 있었다(캔버스 크기는 있으나 그려지지 않음). 라이브 루프에서는 같은 카드가 정상으로 그려진다. 정지 상태에서 카드 크기가 바뀐 뒤 다시 그리지 않는 preview 도구 동작으로 보인다. QA 스냅샷 작성 시 주의가 필요하다(shots/recheck-11/note-preview-settime-872-card-blank.png).
- 실제 화면: agent-desktop 스크린샷이 "CoreGraphics returned no active displays" 오류로 두 번 실패해 확인하지 못했다(디스플레이 꺼짐 또는 잠금으로 추정).
- 현재 상태: 열린 문제 0건. 36건 중 closed 35건, deferred 1건(005)
- 캡처: `shots/recheck-11/`

## 12차 점검: 오피스 상태 필터 바 (2026-11-08, forge 작업 #1 S4)

- 대상: 새 기능인 오피스 상태 필터 바(VQA-037)
- 결과:
  - 037 closed: 개수·필터 결과, 바 가독성과 선택 표시, 줄바꿈과 잘림, 겹침, sticky, 빈 결과 모두 이상 없다.
  - qa의 "소수 픽셀 흐림"은 눈에 보이지 않는다. 소수 위치와 정수 위치의 화면 픽셀이 같았다. 정수로 맞추려고 transform을 쓰면 오히려 흐려진다.
  - 신규 038(중간): 필터 조건에 새로 들어오는 카드가 약 70~85ms 비어 보인다.
  - 신규 039(낮음): 전체 화면 폭 410px에서 카드가 378px로 줄어 N16 명판이 잘린다.
  - 카드 안 방의 점검 항목은 이상 없다.
- DoD 5번(열린 문제 없이 closed): 038, 039가 열려 있어 아직 충족되지 않았다.
- 실제 패널: 오른쪽 패널이 "에이전트 대시보드" 탭이라 확인하지 않았다(탭 조작 금지).
- 캡처: `shots/recheck-12/`

## 13차 재확인: 열린 문제 0 (2026-11-08, forge 작업 #1 S4)

- 대상: VQA-038(새로 들어오는 카드를 동기로 첫 그림), VQA-039(410px 이상에서 1열 카드 최소 410px)
- 결과:
  - 038 closed: 18회 측정 모두 빈 프레임 0. 캔버스 폭과 픽셀 내용 두 검사 모두 확인했다. 스크롤 빈 카드(036)도 0회
  - 039 closed: 410~442px에서 카드 410px, N16 명판 전체 표시
  - 매 회차 점검 항목 이상 없음: 필터 결과와 개수, 가로 스크롤 없음, 방 이동 수치(출발 지연 최대 300ms, 순간이동 0)
  - 신규 없음
- DoD 5번: 필터 바 점검 리포트 VQA-037~039가 모두 closed다. 열린 문제 0건으로 충족한다.
- 현재 상태: 39건 중 closed 38건, deferred 1건(005)

## 14차 점검: 질문 대기 모션 (2026-11-09, forge 작업 #2 S4)

- 대상: 새 기능인 질문 대기 모션(VQA-040)
- 방법: N=1, 3, 5, 6, 10, 16 × 480px/410px × 3프레임, 7명 외형. 진입·해제 전환과 걷기 폴백. 리뷰 합성 이미지
- 결과:
  - 040 closed: 팔 잘림 없음, orchestrator 첫 프레임 정상, 프레임 튐 없음, 불꽃 숨김과 복귀, 전환 하드 컷, '!' 폴백 정상
  - 신규 041(중간, scene): qa 보고 확인. N4~6에서 첫 줄 가운데 멤버의 '?'가 orchestrator 명판의 "at"을 거의 가린다. "살짝"보다 심하다.
  - 신규 042(낮음, art): 노란 강조 두 획이 실제 크기에서 두 번째 글자처럼 보인다.
- 실제 패널: "에이전트 대시보드" 탭이라 확인하지 않았다(탭 조작 금지).
- 캡처: `shots/recheck-14/`

## 15차 재확인: 질문 대기 모션 (2026-11-09, forge 작업 #2 S4)

- 대상: VQA-041(겹칠 때만 말풍선 옆으로 이동), VQA-042(노란 획 제거)
- 결과:
  - 041 closed: 명판 겹침 없음(N3/5/6/10/16 × 480/410px)
  - 042 closed: '?' 하나로 읽힌다.
  - 신규 043(중간, scene): 한 명만 질문 대기일 때 옮겨진 말풍선이 orchestrator 책상에 붙어 보여 "orchestrator가 질문 중"으로 읽힌다.
  - 040은 모션 점검으로 closed를 유지한다. 매 회차 점검 항목은 이상 없다.
- 캡처: `shots/recheck-15/`

## 16차 재확인: 질문 대기 모션 열린 문제 0 (2026-11-09, forge 작업 #2 S4)

- 대상: VQA-043. 말풍선을 옆으로 옮기던 방식을 없앴다. 이제 명판과 겹치면 꼬리를 머리 쪽으로 낮추고, 그래도 겹치면 0.85배, 0.7배로 줄인다.
- 결과:
  - 043 closed: N5·N6 × 480/410px에서 한 명만 대기일 때와 전원 대기일 때 모두, 말풍선이 해당 멤버 머리에 붙고 명판과 겹치지 않는다. 3프레임 동안 튐도 없다.
  - 040 closed: 질문 대기 모션 점검(VQA-040~043)에 열린 문제가 없다.
  - 매 회차 점검 항목 이상 없음
- 현재 상태: 열린 문제 0건. 43건 중 closed 42건, deferred 1건(005)
- 캡처: `shots/recheck-16/`

## 17차 재확인: 질문 대기 자세 높이 (2026-11-09, 사용자 피드백)

- 대상: VQA-044(신규 기록, 대기 자세가 너무 낮음). art가 awaiting 시트를 올렸고 scene이 재생성했다.
- 결과:
  - 044 closed: 7명 × 3프레임 × 480/410px에서 머리·어깨 높이가 working과 같다. 팔 잘림이 없고, 말풍선 규칙(041, 043)도 지켜진다.
  - 점검 항목에 '질문 대기 높이를 working과 맞춤'을 추가했다.
  - 신규 없음
- 현재 상태: 열린 문제 0건. 44건 중 closed 43건, deferred 1건(005)
- 캡처: `shots/recheck-17/`

## 18차 재확인: 질문 대기 앉은 자세 (2026-11-09, 사용자 피드백으로 VQA-044 다시 열림)

- 경위: 17차에 "working과 높이 맞춤"을 기준으로 닫았지만, 사용자가 "엉덩이가 의자에 앉은 느낌이 아니다"라고 다시 지적했다. 기준을 "의자 좌석에 앉아 머리가 등받이 위, 가슴이 상판 위"로 바꿨다.
- 결과:
  - 044 closed: 7명 × N1~16 × 480/410px × 3프레임 모두 등받이 앞에 똑바로 앉은 모습이다. 팔 잘림이 없고, 진입·해제 0.2초 오르내림이 단계적이다.
  - orchestrator 말풍선은 상단바에 닿지 않는다. N3에서는 화이트보드 아래쪽과 겹치지만 가독성에 문제가 없어 이슈로 보지 않았다.
- 현재 상태: 열린 문제 0건. 44건 중 closed 43건, deferred 1건(005)
- 캡처: `shots/recheck-18/`

## 19차 점검: 사이드바 질문 대기 배지 (2026-11-10, forge 작업 #3 S3)

- 대상: 사이드바 'Agent Office' 배지, 배지 클릭 시 Awaiting 화면, 손 든 캐릭터 클릭. 실제 Paseo 데스크톱 앱(밝은 테마)을 agent-desktop으로 봤다. preview와 하네스는 쓰지 않았다.
- 대기 상황: agent-office 워크스페이스에 Always Ask 모드 테스트 에이전트 6개(vqa19-probe-A~F, Haiku)를 만들어 권한 요청과 질문으로 대기를 만들었다. 확인 뒤 모두 아카이브했다.
- 결과:
  - 통과: 배지 위치(행 오른쪽, 겹침·잘림 없음), 숫자(대기 2 → "2", 1 → "1", 0 → 없음), 배지 있을 때 행 클릭 → Awaiting 눌림 + 대기 오피스만, 배지 없을 때 → All, 대기 해제 뒤 0.64초 안에 배지 사라짐
  - 캐릭터 클릭 → 해당 에이전트 탭이 열렸다[중간]. 사용자가 같은 시각 앱을 조작하고 있어, 클릭 3초 뒤 보인 다른 워크스페이스 화면의 원인은 가리지 못했다.
  - 신규 046(중간, scene): 배지가 Observatory 주황과 달리 짙은 갈색·회갈색으로 깜빡이고 더 작다.
  - 미확인: 화면이 열린 채 사용자가 필터를 바꾼 뒤 배지가 있는 상태로 행을 다시 누르는 경우(코드상 필터가 그대로 남을 수 있음), 어두운 테마
  - 045는 위 두 가지 때문에 open이다.
- 현재 상태: 열린 문제 2건(045, 046). 46건 중 closed 43건, open 2건, deferred 1건(005)
- 캡처: `shots/recheck-19/`
  - 전체 창 캡처(프로젝트 이름과 프롬프트가 보이는 것)는 공개 저장소에 올리지 않아 로컬에만 있다. 저장소에는 사이드바·배지 부분을 잘라낸 캡처만 있다.

## 20차 재확인: 사이드바 질문 대기 배지 열린 문제 0 (2026-11-10, forge 작업 #3 S3)

- 대상: VQA-046(배지 색·크기), VQA-045(점검 항목). scene이 배지를 고정 주황 #CB711C + 흰 숫자, 22×20 고정 크기, 불투명도 0.75~1 펄스로 바꿨다. 실제 Paseo 데스크톱(밝은 테마)에서 테스트 에이전트 2개(vqa20-probe-A·B)로 확인했고, 확인 뒤 아카이브했다.
- 결과:
  - 046 closed: Observatory 배지와 같은 프레임 14장에서 크기 22×20pt, 위치, 색상 계열(28° 대 29°)이 같다. 가장 흐린 단계도 연한 주황(채도 0.51)이라 비활성처럼 보이지 않는다. 가장 진한 단계가 Observatory보다 조금 어둡지만(ΔE 8.1) 문제로 보지 않았다.
  - 045 closed: 캐릭터 클릭 직후 16프레임(+0.08~8.08초) 모두 해당 에이전트 탭이고, 다른 화면이 끼지 않았다. 19차에 보인 다른 화면은 사용자 조작 때문으로 본다. '같은 params로 다시 누르는 경우'는 범위 밖(후속 작업)이고, 어두운 테마는 고정색이라 영향이 없다(코드 확인).
  - 신규 없음
- 참고: 점검 중 사용자가 probe 질문에 바로 답해서, 손 든 상태에서의 클릭은 19차 결과를 근거로 삼았다.
- 현재 상태: 열린 문제 0건. 46건 중 closed 45건, deferred 1건(005)
- 후속 작업: 배지가 남은 상태에서 같은 params로 사이드바 행을 다시 누를 때 사용자가 고른 필터가 남는지 확인(orchestrator 결정으로 이번 범위 밖)
- 캡처: `shots/recheck-20/`
  - 전체 창 캡처(프로젝트 이름과 프롬프트가 보이는 것)는 공개 저장소에 올리지 않아 로컬에만 있다. 저장소에는 사이드바·배지 부분을 잘라낸 캡처만 있다.

## 담당별 요약

- scene, art, plugin: 열린 문제 없음
- deferred: 005 (빈 빈백 상시 표시, 사용자 결정 대기)
- qa 회귀 테스트 필요: 001, 002, 003, 004, 010, 016, 017, 018, 021, 024, 026, 027, 028, 029, 030, 031, 035, 036, 038, 041, 043, 044, 046

## 문제 사이 관계

수정에서 생긴 부작용과 원래 리포트의 관계는 다음과 같다(모두 해결).
```
VQA-008 → 018 → 026 → 5차 해결
VQA-003 → 016 → 003 회귀 → 025 → 4차 해결
VQA-012 → 020 → 021 → 023 → 4차 해결
VQA-010 + 장식 말풍선 → 024 → 4차 해결
VQA-027 → 028, 029 → 7차 해결
VQA-030 → 031, 032 → 9차 해결
VQA-033 → 034, 035, 036 → 11차 해결
VQA-037 → 038, 039 → 13차 해결
VQA-040 질문 대기 모션 → 041, 042 → 043 → 16차 해결
VQA-044 대기 자세(사용자 피드백) → 17차 닫음 → 사용자 재지적으로 reopened → 18차 해결
VQA-045 사이드바 배지 점검 → 046 → 20차 해결
```
