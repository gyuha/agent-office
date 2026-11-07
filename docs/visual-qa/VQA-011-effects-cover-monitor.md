# VQA-011 불꽃 오라와 Zzz 말풍선이 모니터를 덮고, orchestrator는 머리에 불붙은 것처럼 보임

- 심각도: 중간
- 추정 담당: scene (효과 위치·크기), art (flame_aura 형태)
- 상태: closed

## 증상
- flame_aura(`seat.x-108`, 폭 215)의 오른쪽 불꽃이 모니터 앞을 덮는다. plugin, infra(CRT)와 art, review에서 컴퓨터가 불타는 모양이 된다. 불꽃은 desk-back 다음, 액터 전에 그려지는데 모니터는 desk-back에 있어서 불꽃이 모니터 위로 올라온다.
- orchestrator는 몸이 크고 불꽃이 작아 불꽃이 머리카락 테두리에만 붙는다. 머리에 불이 붙은 것처럼 보인다.
- sleeping의 Zzz 말풍선(`a.x+48`)이 모든 책상에서 모니터 화면을 가린다.

## 재현 조건
- N=6 mixed `setTime(15000)` (stateSince = now-90s → 불꽃 표시)
- N=6 sleeping `setTime(5000)`
- N=16 mixed `setTime(15000)`

## 스크린샷
- shots/vqa011-flame-over-monitor.png
- shots/vqa011-orchestrator-flame-hair.png
- shots/vqa011-n6-sleeping-zzz.png

## 왜 어색한가
"열일" 오라가 사고(화재)처럼 보인다. Zzz가 모니터에 붙어 모니터가 말하는 것처럼 보인다.

## 기대 모습
불꽃은 캐릭터 뒤쪽 실루엣 안에 머물고 모니터와 겹치지 않는다. orchestrator에는 몸 크기에 맞춘 크기를 쓴다. Zzz는 머리 위 또는 왼쪽 위의 빈 공간에 둔다.

## 재확인 결과 (2026-11-07, 1차 재확인)

- N6 mixed `setTime(15000)`, N6 sleeping `setTime(5000)`, N6 working `setTime(61000~61625)`를 확인했다. 불꽃이 모니터와 명판을 덮지 않고, orchestrator 머리카락을 감싸지도 않는다. Zzz는 머리 왼쪽 위로 옮겨져 모니터를 가리지 않는다.
- 캡처: shots/recheck-1/r011-r014-n6-row1-nameplates.png, shots/recheck-1/r011-n6-sleeping-zzz.png, shots/recheck-1/r011-v019-orchestrator-lead-desk.png
- 판정: 원래 증상은 해결. closed. 그런데 불꽃 효과가 거의 보이지 않게 되었고, orchestrator에서는 주황 선이 키보드 위를 지나간다. 이 부분은 [VQA-019](VQA-019-flame-aura-invisible.md)로 적었다.
