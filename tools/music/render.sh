#!/bin/sh
# MIDI → WAV (FluidSynth, FluidR3_GM) → MP3.  apt: fluidsynth fluid-soundfont-gm ffmpeg
set -e
cd "$(dirname "$0")"
SF=${SF:-/usr/share/sounds/sf2/FluidR3_GM.sf2}
python3 compose.py > /dev/null
mkdir -p ../../audio
for n in battle pinch victory; do
  fluidsynth -ni -q -g 0.35 -r 44100 \
    -o synth.reverb.room-size=0.75 -o synth.reverb.damp=0.35 -o synth.reverb.width=0.9 -o synth.reverb.level=0.8 \
    -o synth.chorus.active=0 \
    -F out/$n.wav "$SF" out/$n.mid
  # 최대 음량을 -1dB 로 맞추고 128kbps MP3 로
  peak=$(ffmpeg -hide_banner -i out/$n.wav -af volumedetect -f null - 2>&1 | sed -n 's/.*max_volume: \(-*[0-9.]*\) dB/\1/p')
  gain=$(python3 -c "print(-1 - float('$peak'))")
  ffmpeg -hide_banner -loglevel error -y -i out/$n.wav -af "volume=${gain}dB" -codec:a libmp3lame -b:a 128k ../../audio/$n.mp3
  echo "$n peak ${peak}dB → gain ${gain}dB"
done
cp out/loops.json ../../audio/loops.json
