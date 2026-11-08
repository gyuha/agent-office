# VQA-037 오피스 상태 필터 바 점검 (forge 작업 #1, S4)

- 심각도: 해당 없음 (기능 점검 기록)
- 추정 담당: scene
- 상태: closed (바·필터·빈 결과·sticky는 이상 없음. 남은 문제는 VQA-038, 039)
- 기준: `.forge/plan.md` DoD 5번

## 점검 대상
장면 위 sticky 바에 'All N', 'Working N', 'Awaiting N', 'Idle N' 버튼이 있고, 판정은 오피스 단위다. 맞는 오피스가 없으면 "No offices match"를 보여 준다.

## 방법
- preview `#filters`(scope all, 프로젝트 3개, 오피스 6개)와 `#filters-panel`(scope project)을 410, 480, 1200, 1600px, DPR2로 열었다. `preview.setFilter`로 네 필터를 바꾸며 DOM 사각형, `inspect()`의 filter/counts/empty를 측정하고 전체 페이지를 캡처했다.
- 빈 결과: 모든 needsAttention을 끈 스냅샷에서 Awaiting을 선택했다.
- 상태 변화: Working 필터에서 오피스 하나를 working으로 바꿔 넣고, 다른 하나는 sleeping으로 바꿔 빼며 rAF마다 카드 목록과 캔버스를 기록했다.
- sticky: 1200px에서 스크롤 0, 30, 200, 450px을 캡처했다.

## 결과

| 항목 | 결과 |
|---|---|
| 개수 | All 6 · Working 3 · Awaiting 2 · Idle 2. 카드 수와 일치하고 Working과 Awaiting은 겹칠 수 있다(Atlas, Beacon). |
| 필터 결과 | 4개 필터 × 4개 폭 × 2개 화면 모두 해당 오피스만 남는다. 빈 프로젝트는 숨겨진다. |
| 바 가독성 | 13px 굵은 고정폭 글자. 남색 바탕에 크림색 글자, 선택한 버튼은 크림색 채움에 남색 글자로 반전된다. 410px에서도 한 줄이고 버튼 글자 잘림이 없다(scrollWidth = clientWidth). 1200px 이상에서는 150px 버튼 4개가 가운데 정렬된다. |
| 상단바와 masonry 겹침 | 바 높이 50.59px, 첫 카드 위쪽 66.59px(바 + 16px 여백). 바와 카드, 카드끼리 겹침 0, 가로 스크롤 없음 |
| sticky 스크롤 | 바가 불투명하고 아래 테두리가 있어, 카드가 바 아래로 깔끔하게 들어간다. 카드 헤더가 반만 가려지는 순간도 어색하지 않다. |
| 빈 결과 | 바 아래 가운데에 "No offices match"(16px, 진한 갈색). 카드 없음. 410px과 1200px 모두 정상 |
| 카드 출입 순서 | 들어오고 빠지는 반영은 다음 그리기(약 2~10 rAF) 안에 끝난다. DOM 순서(프로젝트 이름순)도 유지된다. masonry 특성상 뒤 카드는 다른 열로 옮겨 갈 수 있다(예: Beacon이 들어오자 Cedar가 오른쪽 열에서 왼쪽 아래로 이동). 애니메이션 없는 재배치이며, 순서 규칙에 맞아 문제로 보지 않았다. |
| 카드 안 방 | 착석, 팔, 윤곽, 이펙트, 여백·벽선 정상. 이동 수치 정상(출발 지연 최대 300ms, 순간이동 0) |

## qa 보고 "바 높이 소수(50.59px) 때문에 카드가 소수 픽셀 위치에 놓여 흐려짐" 판단
**눈에 보이는 문제가 아니다** [높음, Chromium 기준].
- 첫 카드 캔버스의 y는 66.594 CSS px다. 컨테이너에 0.40625px을 더해 정수(67)로 맞춘 화면과 비교했다. 화면 픽셀과 캔버스 원본 픽셀의 평균 차이가 DPR1과 DPR2 모두 소수 위치일 때와 완전히 같았다(28.99 / 28.91, 비교 시점 프레임 차이 포함). Chromium이 캔버스를 장치 픽셀에 맞춰 그리므로 흐림이 생기지 않는다.
- 반대로 `transform: translateY`로 맞추면 합성 레이어 재샘플링 때문에 오히려 흐려졌다({S}/r12-037-fractional-vs-transform.png, 오른쪽). 고칠 때 transform을 쓰면 안 된다.
- Paseo 데스크톱의 렌더러가 Chromium 계열이 아니라면 결과가 다를 수 있다 [중간]. 실제 패널로 확인하지 못했다.

## 캡처
- shots/recheck-12/r12-037-filters-1200-all-working-awaiting-idle.png, shots/recheck-12/r12-037-filters-410-sheet.png, shots/recheck-12/r12-037-filters-410-card.png
- shots/recheck-12/r12-037-bar-410-1200-zoom.png, shots/recheck-12/r12-037-empty-1200-410.png, shots/recheck-12/r12-037-sticky-scroll-1200.png
- shots/recheck-12/r12-037-filters-panel-480-working.png

## 판정
필터 바 자체는 closed. DoD 5번은 VQA-038, 039가 닫혀야 충족된다.
