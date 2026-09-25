# 배경음악

`tools/music/compose.py`(오케스트라 록)와 `tools/music/swing.py`(일렉트로스윙, `swing-*.mp3`)로 작곡한 오리지널 곡을 FluidSynth 와 FluidR3_GM 사운드폰트로 렌더링했습니다.
다시 만들려면 `tools/music/render.sh` (필요: fluidsynth, fluid-soundfont-gm, ffmpeg, `pip install mido`).

- 곡: 이 저장소의 오리지널 (게임과 같은 라이선스)
- 악기 소리: FluidR3_GM.sf2 — Copyright (c) Frank Wen, MIT License
- 반복 구간(초)은 `loops.json` 과 `js/music.js` 의 LOOPS 에 있습니다.
