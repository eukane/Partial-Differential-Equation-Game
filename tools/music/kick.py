"""킥 레이어 합성: out/<곡>.kicks.json 의 시각마다 단단한 전자 킥(피치가 떨어지는 사인 + 클릭)을 찍어 WAV 로.
사이드체인의 트리거로도 쓴다.   python3 kick.py <곡> <길이(초)>"""
import json
import sys
import wave

import numpy as np

SR = 44100
name, length = sys.argv[1], float(sys.argv[2])
kicks = json.load(open(f'out/{name}.kicks.json'))
t = np.arange(int(0.45 * SR)) / SR
freq = 50 + 140 * np.exp(-t / 0.025)
phase = 2 * np.pi * np.cumsum(freq) / SR
body = np.sin(phase) * np.exp(-t / 0.085)
click = np.random.default_rng(1).standard_normal(len(t)) * np.exp(-t / 0.002) * 0.35
one = np.tanh(1.6 * (body + click)) * 0.9
out = np.zeros(int(length * SR) + len(one))
for at, vel in kicks:
    i = int(at * SR)
    out[i:i + len(one)] += one * (vel / 127) ** 1.5
out = out[:int(length * SR)]
pcm = (np.clip(out, -1, 1) * 32767).astype('<i2')
with wave.open(f'out/{name}.kick.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(np.repeat(pcm, 2).tobytes())
