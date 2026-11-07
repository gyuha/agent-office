# VQA-034 masonry에서 같은 프로젝트 카드가 다른 열로 흩어지고, 눈으로 읽는 순서가 정렬 순서와 다름

- 심각도: 낮음
- 추정 담당: scene (`mount-scene.ts` 최단 열 배치)
- 상태: closed

## 증상
카드는 프로젝트 이름순(DOM 순서)으로 최단 열에 하나씩 놓인다. 프로젝트마다 그룹 방과 solo 방의 높이가 달라서, 같은 프로젝트의 두 카드가 서로 다른 열·행으로 떨어지고 그 사이에 다른 프로젝트 카드가 끼어든다.
- 1200px 2행(왼쪽→오른쪽): Cedar(그룹) | Beacon(solo) | Cedar(solo). Beacon 그룹은 오른쪽 열 맨 위에 있다.
- 2000px 2행: Delta(solo) | Cedar(solo) | Ember | Delta(그룹, 4열) …. Delta 두 카드가 1열과 4열로 떨어져 있다.

## 재현 조건
- preview `#grid`, 1200/1600/2000px, `setTime(20000)`

## 스크린샷
- shots/recheck-10/r10-grid-1200.png
- shots/recheck-10/r10-grid-2000.png

## 왜 어색한가
사용자가 "내 프로젝트 사무실"을 찾을 때 이름순으로 훑어도 순서가 맞지 않는다. 같은 프로젝트가 한눈에 묶여 보이지 않는다.

## 기대 모습
프로젝트 단위로 카드를 묶거나(예: 프로젝트 카드 안에 방을 세로로 쌓은 뒤 그 묶음을 masonry 배치), 적어도 같은 프로젝트의 카드는 같은 열에 이어 놓는다.

## 재확인 결과 (2026-11-07, 11차 재확인)

- preview `#grid`, 1200/1600/2000px에서 확인했다. 프로젝트 블록 단위로 배치되어, 같은 프로젝트의 그룹 방과 solo 방이 항상 같은 열에 위아래로 붙어 있다(Atlas, Beacon, Cedar, Delta, Ember, Forge 모두). 왼쪽 위에서 시작해 프로젝트 이름순으로 열을 채워, 눈으로 읽는 순서와 정렬 순서가 맞는다.
- 캡처: shots/recheck-11/r11-grid-1200.png, shots/recheck-11/r11-grid-1600.png, shots/recheck-11/r11-grid-2000.png
- 판정: 해결. closed
