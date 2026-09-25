#!/bin/sh
# MIDI → WAV (FluidSynth, FluidR3_GM) → MP3.  apt: fluidsynth fluid-soundfont-gm ffmpeg
set -e
cd "$(dirname "$0")"
SF=${SF:-/usr/share/sounds/sf2/FluidR3_GM.sf2}
python3 compose.py > /dev/null
mkdir -p ../../audio
render() {
  fluidsynth -ni -q -g 0.35 -r 44100 -O float \
    -o synth.reverb.room-size=0.75 -o synth.reverb.damp=0.35 -o synth.reverb.width=0.9 -o synth.reverb.level=0.8 \
    -o synth.chorus.active=0 \
    -F "$2" "$SF" "$1"
}
for n in battle pinch victory swing-battle swing-pinch swing-victory swing2-battle; do
  if [ -f out/$n.music.mid ]; then
    # 스템 믹스: 음악·드럼을 따로 렌더 → 합성 킥 레이어 → 킥이 칠 때마다 음악이 눌렸다 올라오는 사이드체인 펌핑
    render out/$n.music.mid out/$n.music.wav
    render out/$n.drums.mid out/$n.drums.wav
    dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 out/$n.music.wav)
    python3 kick.py $n "$dur"
    ffmpeg -hide_banner -loglevel error -y -i out/$n.music.wav -i out/$n.drums.wav -i out/$n.kick.wav -filter_complex \
      "[2:a]asplit=2[k1][k2];[0:a][k1]sidechaincompress=threshold=0.3:ratio=4:attack=2:release=140:makeup=1[duck];[1:a]treble=g=8:f=6500[dr];[duck][dr][k2]amix=inputs=3:normalize=0:weights=1 1 0.45:duration=first" \
      -c:a pcm_f32le out/$n.wav
  else
    render out/$n.mid out/$n.wav
  fi
  # 최대 음량을 -1dB 로 맞추고 128kbps MP3 로
  # 일렉트로스윙은 킥·베이스를 두껍게 (저음 선반 EQ)
  eq=anull
  # + 리미터로 꽉 찬 음압 (레퍼런스처럼 드롭 내내 에너지가 유지되게)
  case $n in swing*) eq="volume=-6dB,alimiter=level_in=2:limit=0.5:attack=3:release=60:level=0" ;; esac
  ffmpeg -hide_banner -loglevel error -y -i out/$n.wav -af "$eq" -c:a pcm_f32le out/$n.eq.wav && mv out/$n.eq.wav out/$n.wav
  peak=$(ffmpeg -hide_banner -i out/$n.wav -af volumedetect -f null - 2>&1 | sed -n 's/.*max_volume: \(-*[0-9.]*\) dB/\1/p')
  # 최대 음량 -1dB, 단 곡끼리 크기가 비슷하도록 통합 음량은 -13 LUFS 를 넘지 않게
  lufs=$(ffmpeg -hide_banner -i out/$n.wav -af ebur128 -f null - 2>&1 | sed -n 's/^ *I: *\(-*[0-9.]*\) LUFS/\1/p' | tail -1)
  gain=$(python3 -c "print(round(min(-1 - float('$peak'), -13 - float('$lufs')), 2))")
  ffmpeg -hide_banner -loglevel error -y -i out/$n.wav -af "volume=${gain}dB" -codec:a libmp3lame -b:a 128k ../../audio/$n.mp3
  echo "$n peak ${peak}dB, ${lufs} LUFS → gain ${gain}dB"
done
cp out/loops.json ../../audio/loops.json
