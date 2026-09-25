"""미분 배틀 배경음악 작곡 스크립트 (오리지널 곡)

MIDI 를 만들고 FluidSynth + FluidR3_GM 사운드폰트(MIT)로 실제 악기 소리를 입혀 렌더링한다.
    python3 tools/music/compose.py            # tools/music/out/*.mid 생성
    tools/music/render.sh                     # → audio/*.mp3

곡
    battle  : D단조 138bpm. 도입 4마디 → A(호른 선율, 현악 스타카토, 피아노) → B(트럼펫·트롬본 선율, 합창, 팀파니, 심벌)
              재생은 도입부터, 반복은 두 번째 A 부터 (loop 정보는 LOOPS 에)
    pinch   : 156bpm 위기 테마. 트레몰로 현악 + 팀파니 연타 + 금관 스탭 → 트럼펫 고음 선율. 두 바퀴 렌더링해 두 번째 바퀴를 반복
    victory : 승리 팡파르
"""
import json
import os

import mido

PPQ = 480
T16 = PPQ // 4
OUT = os.path.join(os.path.dirname(__file__), 'out')

QUAL = {'m': [0, 3, 7], 'M': [0, 4, 7], '7': [0, 4, 7, 10]}
ROOT = {'C': 36, 'D': 38, 'Eb': 39, 'E': 40, 'F': 41, 'G': 43, 'A': 45, 'Bb': 46}


def chord(name):
    """'Dm' → (근음 MIDI(C2~B2), 구성음 간격)"""
    q = 'M'
    if name.endswith('m'):
        q, name = 'm', name[:-1]
    elif name.endswith('7'):
        q, name = '7', name[:-1]
    return ROOT[name], QUAL[q]


# 채널: (GM 프로그램, 볼륨, 팬, 리버브)
CH = {
    'tpt':   (0, 56, 112, 72, 70),   # 트럼펫
    'tbn':   (1, 57, 96, 56, 70),    # 트롬본
    'horn':  (2, 60, 100, 48, 80),   # 호른
    'stac':  (3, 48, 84, 36, 55),    # 현악 (짧게 끊어서)
    'pad':   (4, 49, 72, 90, 90),    # 현악 (길게)
    'bass':  (5, 43, 100, 64, 50),   # 콘트라베이스
    'cello': (6, 42, 88, 76, 55),    # 첼로
    'piano': (7, 0, 84, 64, 45),     # 피아노
    'choir': (8, 52, 78, 64, 100),   # 합창
    'drums': (9, 0, 92, 64, 40),     # 드럼 (GM 10번 채널)
    'trem':  (10, 44, 88, 40, 70),   # 트레몰로 현악
    'timp':  (11, 47, 116, 64, 70),  # 팀파니
    'hit':   (12, 55, 64, 64, 80),   # 오케스트라 히트
    'brass': (13, 61, 92, 80, 70),   # 금관 섹션
    'vln':   (14, 40, 80, 30, 70),   # 바이올린 (고음 이중)
}
KICK, SNARE, HAT, CRASH, RIDE, TOM_L, TOM_H = 36, 38, 42, 49, 51, 43, 50
ACC = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0]  # 3+3+2 강세


class Song:
    def __init__(self, bpm):
        self.bpm = bpm
        self.ev = []  # (tick, 순서, msg)

    def n(self, ch, at16, midi, len16, vel):
        c = CH[ch][0]
        t0 = int(round(at16 * T16))
        t1 = t0 + max(1, int(round(len16 * T16)) - 8)
        vel = max(1, min(127, int(vel)))
        self.ev.append((t0, 1, mido.Message('note_on', channel=c, note=int(midi), velocity=vel)))
        self.ev.append((t1, 0, mido.Message('note_off', channel=c, note=int(midi), velocity=0)))

    def cc(self, ch, at16, ctl, val):
        self.ev.append((int(round(at16 * T16)), 0, mido.Message('control_change', channel=CH[ch][0], control=ctl, value=int(val))))

    def ramp(self, ch, at16, len16, v0, v1, ctl=11):
        steps = max(1, int(len16))
        for i in range(steps + 1):
            self.cc(ch, at16 + len16 * i / steps, ctl, v0 + (v1 - v0) * i / steps)

    def save(self, name):
        mid = mido.MidiFile(type=0, ticks_per_beat=PPQ)
        tr = mido.MidiTrack()
        mid.tracks.append(tr)
        tr.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(self.bpm), time=0))
        for key, (c, prog, vol, pan, rev) in CH.items():
            if c != 9:
                tr.append(mido.Message('program_change', channel=c, program=prog, time=0))
            for ctl, val in ((7, vol), (10, pan), (91, rev), (93, 20), (11, 127)):
                tr.append(mido.Message('control_change', channel=c, control=ctl, value=val, time=0))
        last = 0
        for t, _, m in sorted(self.ev, key=lambda e: (e[0], e[1])):
            tr.append(m.copy(time=t - last))
            last = t
        end = max(t for t, _, _ in self.ev) + PPQ * 8  # 잔향 여유
        tr.append(mido.MetaMessage('end_of_track', time=end - last))
        os.makedirs(OUT, exist_ok=True)
        mid.save(os.path.join(OUT, name + '.mid'))

    def sec(self, bars):
        return bars * 4 * 60 / self.bpm


def tones(name, octave=4):
    r, q = chord(name)
    base = r + 12 * (octave - 2)
    return [base + i for i in q]


# ---------------------------------------------------------------- battle
BATTLE_PROG = ['Dm', 'Bb', 'C', 'A', 'Dm', 'Bb', 'Gm', 'A']
# [시작 16분음표, 음, 길이]
HORN_MEL = [
    [(0, 62, 8), (8, 65, 4), (12, 69, 4)],
    [(0, 70, 12), (12, 69, 2), (14, 67, 2)],
    [(0, 67, 8), (8, 64, 4), (12, 67, 4)],
    [(0, 69, 12), (12, 73, 4)],
    [(0, 74, 8), (8, 72, 4), (12, 69, 4)],
    [(0, 70, 6), (6, 69, 2), (8, 65, 8)],
    [(0, 67, 6), (6, 70, 2), (8, 74, 4), (12, 72, 4)],
    [(0, 73, 16)],
]
TPT_MEL = [
    [(0, 69, 6), (6, 74, 2), (8, 72, 4), (12, 74, 4)],
    [(0, 77, 6), (6, 76, 2), (8, 74, 4), (12, 72, 4)],
    [(0, 72, 6), (6, 74, 2), (8, 76, 4), (12, 79, 4)],
    [(0, 76, 10), (10, 74, 2), (12, 73, 4)],
    [(0, 74, 6), (6, 77, 2), (8, 81, 6), (14, 79, 2)],
    [(0, 77, 4), (4, 74, 4), (8, 82, 8)],
    [(0, 79, 6), (6, 77, 2), (8, 76, 4), (12, 74, 4)],
    [(0, 73, 4), (4, 76, 4), (8, 81, 8)],
]
OSTINATO = [0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2, 0, 1, 2, 1]


def battle():
    s = Song(138)
    bar = 0

    def ostinato(b, name, vel, up=0):
        tn = tones(name, 4)
        for i in range(16):
            m = tn[OSTINATO[i]] + (12 if ACC[i] else 0) + up
            s.n('stac', b * 16 + i, m, 1, vel + (18 if ACC[i] else 0))

    def piano_arp(b, name, vel):
        r, _ = chord(name)
        tn = tones(name, 4)
        s.n('piano', b * 16, r + 12, 8, vel)
        s.n('piano', b * 16 + 8, r + 12, 8, vel - 10)
        pat = [tn[0], tn[2], tn[0] + 12, tn[1] + 12, tn[0] + 12, tn[2], tn[1], tn[2]]
        for i, m in enumerate(pat):
            s.n('piano', b * 16 + i * 2, m, 2, vel - (0 if i % 2 == 0 else 12))

    def bass8(b, name, vel, acc=False):
        r, _ = chord(name)
        for i in range(16):
            hit = ACC[i] if acc else i % 2 == 0
            if not hit:
                continue
            m = r + (12 if (i % 4 == 2 or i == 11) else 0)
            s.n('bass', b * 16 + i, m, 2 if not acc else 3, vel)
            s.n('cello', b * 16 + i, m + 12, 2 if not acc else 3, vel - 10)

    # 도입 4마디: 피아노 → 현악 → 팀파니 크레셴도 + 금관 스웰
    intro = ['Dm', 'Dm', 'Bb', 'A']
    for i, c in enumerate(intro):
        b = bar + i
        piano_arp(b, c, 88)
        if i >= 1:
            ostinato(b, c, 60 + i * 8)
        r, _ = chord(c)
        s.n('bass', b * 16, r, 16, 80)
        s.n('timp', b * 16, r + 12 if r < 43 else r, 2, 90)
    b = bar + 3
    s.ramp('brass', b * 16, 16, 30, 127)
    for m in tones('A', 3):
        s.n('brass', b * 16, m, 16, 110)
    for i in range(8, 16):
        s.n('drums', b * 16 + i, SNARE, 1, 50 + i * 5)
        s.n('timp', b * 16 + i, 45, 1, 60 + i * 4)
    bar += 4

    def section_a(b0, first):
        for i, c in enumerate(BATTLE_PROG):
            b = b0 + i
            ostinato(b, c, 66)
            piano_arp(b, c, 72)
            bass8(b, c, 92)
            for st, m, ln in HORN_MEL[i]:
                s.n('horn', b * 16 + st, m, ln, 100)
                s.n('pad', b * 16 + st, m + 12, ln, 62)
            for q in range(4):
                s.n('drums', b * 16 + q * 4, KICK if q % 2 == 0 else SNARE, 1, 96 if q % 2 == 0 else 84)
                s.n('drums', b * 16 + q * 4 + 2, HAT, 1, 60)
            if i % 2 == 0:
                s.n('timp', b * 16, chord(c)[0] + (12 if chord(c)[0] < 41 else 0), 2, 96)
            if i == 0:
                s.n('drums', b * 16, CRASH, 8, 80 if first else 70)
        # 8마디째: B 로 넘어가는 스네어·팀파니 롤
        b = b0 + 7
        for i in range(8, 16):
            s.n('drums', b * 16 + i, SNARE, 1, 60 + i * 4)
            s.n('timp', b * 16 + i, 45, 1, 70 + i * 3)
        s.ramp('brass', b * 16 + 8, 8, 40, 127)
        for m in tones('A', 3):
            s.n('brass', b * 16 + 8, m, 8, 105)

    def section_b(b0):
        for i, c in enumerate(BATTLE_PROG):
            b = b0 + i
            r, _ = chord(c)
            ostinato(b, c, 74, up=12 if i >= 4 else 0)
            bass8(b, c, 104, acc=True)
            # 트럼펫 선율 + 트롬본 옥타브 아래, 바이올린 옥타브 위
            for st, m, ln in TPT_MEL[i]:
                s.n('tpt', b * 16 + st, m, ln, 118)
                s.n('tbn', b * 16 + st, m - 12, ln, 104)
                s.n('vln', b * 16 + st, m + 12, ln, 78)
            # 호른은 화음, 합창은 길게
            tn = tones(c, 4)
            for m in tn:
                s.n('horn', b * 16, m - 12 if m > 64 else m, 16, 84)
                s.n('choir', b * 16, m + (12 if m < 62 else 0), 16, 86)
            # 피아노·금관 섹션: 3+3+2 스탭
            for k in range(16):
                if ACC[k]:
                    for m in tones(c, 3):
                        s.n('piano', b * 16 + k, m + 12, 1, 92)
                    if i in (3, 7):
                        for m in tones(c, 3):
                            s.n('brass', b * 16 + k, m, 1.5, 104)
                    s.n('drums', b * 16 + k, KICK, 1, 104)
                    if k < 8:
                        s.n('timp', b * 16 + k, r + (12 if r < 41 else 0), 1, 100)
            for k in (4, 12):
                s.n('drums', b * 16 + k, SNARE, 1, 104)
            for k in range(1, 16, 2):
                s.n('drums', b * 16 + k, HAT, 1, 56)
            if i in (0, 4):
                s.n('drums', b * 16, CRASH, 8, 104)
                s.n('hit', b * 16, tn[0] + 12, 2, 96)
        b = b0 + 7
        for k, t in ((12, TOM_H), (13, TOM_H), (14, TOM_L), (15, TOM_L)):
            s.n('drums', b * 16 + k, t, 1, 100)

    loop_start = bar + 8 + 8
    section_a(bar, True); bar += 8
    section_b(bar); bar += 8
    section_a(bar, False); bar += 8
    section_b(bar); bar += 8
    # 반복 지점 뒤로 한 마디: 다시 A 첫 박으로 넘어가는 소리를 잔향과 함께 담는다
    for m in tones('Dm', 4):
        s.n('stac', bar * 16, m, 1, 90)
    s.n('drums', bar * 16, CRASH, 8, 80)
    s.n('bass', bar * 16, 38, 2, 90)
    s.save('battle')
    return {'loopStart': s.sec(loop_start), 'loopEnd': s.sec(bar)}


# ---------------------------------------------------------------- pinch
PINCH_PROG = ['Dm', 'Bb', 'Eb', 'A', 'Gm', 'Dm', 'Eb', 'A7']
PINCH_MEL = [
    [(0, 74, 3), (3, 77, 3), (6, 81, 10)],
    [(0, 82, 3), (3, 81, 3), (6, 77, 6), (12, 74, 4)],
    [(0, 79, 3), (3, 82, 3), (6, 87, 10)],
    [(0, 85, 6), (6, 81, 6), (12, 76, 4)],
    [(0, 79, 3), (3, 82, 3), (6, 86, 10)],
    [(0, 86, 3), (3, 84, 3), (6, 81, 6), (12, 77, 4)],
    [(0, 79, 4), (4, 82, 4), (8, 87, 8)],
    [(0, 85, 4), (4, 88, 4), (8, 81, 8)],
]


def pinch():
    s = Song(156)
    bar = 0

    def half(b0, melody):
        for i, c in enumerate(PINCH_PROG):
            b = b0 + i
            r, _ = chord(c)
            tn = tones(c, 4)
            for m in tn:
                s.n('trem', b * 16, m, 16, 92)
                s.n('choir', b * 16, m + 12, 16, 80 if melody else 70)
            for k in range(0, 16, 2):
                m = r + (12 if k % 8 == 6 else 0)
                s.n('bass', b * 16 + k, m, 2, 104)
                s.n('cello', b * 16 + k, m + 12, 2, 92)
            for k in range(0, 16, 4):
                s.n('timp', b * 16 + k, r + (12 if r < 41 else 0), 2, 104)
                s.n('drums', b * 16 + k, KICK, 1, 108)
            for k in (4, 12):
                s.n('drums', b * 16 + k, SNARE, 1, 108)
            s.n('drums', b * 16 + 14, SNARE, 1, 60)
            for k in range(1, 16, 2):
                s.n('drums', b * 16 + k, HAT, 1, 58)
            if i in (3, 7):
                for k in range(12, 16):
                    s.n('timp', b * 16 + k, r + (12 if r < 41 else 0), 1, 90 + (k - 12) * 8)
                    s.n('drums', b * 16 + k, SNARE, 1, 80 + (k - 12) * 10)
            if i in (0, 4):
                s.n('drums', b * 16, CRASH, 8, 108)
                s.n('hit', b * 16, tn[0] + 12, 2, 104)
            if not melody:
                for k in (0, 3, 6, 10):
                    for m in tones(c, 3):
                        s.n('brass', b * 16 + k, m, 2, 108)
                    s.n('piano', b * 16 + k, r + 12, 2, 96)
            else:
                for st, m, ln in PINCH_MEL[i]:
                    s.n('tpt', b * 16 + st, m, ln, 120)
                    s.n('tbn', b * 16 + st, m - 12, ln, 104)
                    s.n('vln', b * 16 + st, m + 12, ln, 70)
                for k in range(16):
                    s.n('stac', b * 16 + k, (tn[0] + 12) if k % 2 == 0 else tn[2], 1, 70 + (16 if k % 4 == 0 else 0))
                for k in (0, 10):
                    for m in tones(c, 3):
                        s.n('horn', b * 16 + k, m, 3, 96)

    for _ in range(2):
        half(bar, False); bar += 8
        half(bar, True); bar += 8
    for m in tones('Dm', 4):
        s.n('trem', bar * 16, m, 4, 90)
    s.n('drums', bar * 16, CRASH, 8, 100)
    s.n('bass', bar * 16, 38, 2, 100)
    s.save('pinch')
    return {'loopStart': s.sec(16), 'loopEnd': s.sec(32)}


# ---------------------------------------------------------------- victory
def victory():
    s = Song(116)
    # 셋잇단 픽업 → B♭ → C → D장조
    for k, t in enumerate((0, 4 / 3, 8 / 3)):
        s.n('tpt', t, 74, 1.2, 110)
        s.n('tbn', t, 62, 1.2, 96)
        s.n('drums', t, SNARE, 1, 80 + k * 10)
    hits = [(4, 'Bb', 6), (10, 'C', 6), (16, 'D', 24)]
    for at, c, ln in hits:
        r, _ = chord(c)
        tn = tones(c, 4)
        for m in tn:
            s.n('tpt', at, m + 12 if m < 66 else m, ln, 118)
            s.n('tbn', at, m - 12, ln, 104)
            s.n('horn', at, m, ln, 104)
            s.n('brass', at, m - 12, ln, 104)
            s.n('pad', at, m + 12, ln, 84)
        s.n('bass', at, r, ln, 110)
        s.n('timp', at, r + (12 if r < 41 else 0), 2, 118)
        s.n('drums', at, CRASH if c == 'D' else KICK, 8, 110)
    s.n('tpt', 16, 78, 24, 122)  # 맨 위 F#
    for m in (62, 66, 69, 74):
        s.n('choir', 16, m, 24, 96)
    for k in range(10):
        s.n('timp', 20 + k, 50, 1, 70 + k * 4)
    s.n('timp', 32, 38 + 12, 4, 124)
    s.n('drums', 32, CRASH, 8, 120)
    s.n('hit', 32, 62, 4, 110)
    s.save('victory')
    return {}


if __name__ == '__main__':
    loops = {'battle': battle(), 'pinch': pinch(), 'victory': victory()}
    with open(os.path.join(OUT, 'loops.json'), 'w') as f:
        json.dump(loops, f, indent=2)
    print(json.dumps(loops, indent=2))
