"""미분 배틀 배경음악 — 일렉트로스윙 버전 (오리지널 곡)

    python3 tools/music/swing.py   # tools/music/out/swing-*.mid 생성 (render.sh 가 같이 부른다)

재즈 쪽: 약음기 트럼펫·알토 색소폰·클라리넷·트롬본·금관 섹션, 집시 재즈식 '라 퐁프' 기타, 콘트라베이스, 피아노
전자 쪽: 4박 킥 + 박수 + 오프비트 오픈 하이햇, 오프비트 신스 베이스, 사이드체인처럼 숨 쉬는 신스 패드, 톱니파 리드
8분음표는 셋잇단 2:1 로 스윙한다.

구성 (레퍼런스처럼 8마디 단위, 각 구간 마지막 마디는 킥·베이스가 빠지는 '스톱' → 다음 첫 박에 '팡')
    battle : 도입 4(금관 콜 & 리스폰스) · 빌드업 4 → [드롭 8 · 색소폰 솔로 8 · 브레이크다운 4(+빌드) · 최고조 드롭 8] 반복
    pinch  : 예비 1 → [긴장 8 · 선율 8] 반복
"""
import json
import os

from compose import OUT, Song

# 이 곡들에서만 쓰는 16채널 전부: (채널, GM 프로그램, 볼륨, 팬, 리버브)
SWING = {
    'mute':  (0, 59, 104, 70, 55),   # 약음기 트럼펫
    'tbn':   (1, 57, 92, 50, 55),    # 트롬본
    'sax':   (2, 65, 100, 82, 55),   # 알토 색소폰
    'clar':  (3, 71, 84, 40, 60),    # 클라리넷
    'spad':  (4, 89, 66, 64, 80),    # 신스 패드 (따뜻한)
    'upright': (5, 32, 104, 64, 25),  # 콘트라베이스
    'sbass': (6, 39, 116, 64, 10),    # 신스 베이스
    'piano': (7, 0, 84, 76, 45),     # 피아노
    'brass': (8, 61, 98, 64, 60),    # 금관 섹션
    'drums': (9, 0, 104, 64, 25),
    'pompe': (10, 25, 80, 44, 35),   # 어쿠스틱 기타 (라 퐁프)
    'lead':  (11, 81, 70, 90, 55),   # 톱니파 리드
    'tpt':   (12, 56, 108, 64, 60),  # 트럼펫 (열린 소리)
    'boom':  (13, 118, 116, 64, 60),  # 신스 드럼 (드롭의 '쿵')
    'riser': (14, 119, 96, 64, 40),   # 리버스 심벌 (드롭 직전 '쏴아')
    'hit':   (15, 55, 60, 64, 70),   # 오케스트라 히트
}
KICK, CLAP, SNARE, CHAT, OHAT, CRASH, RIDE, CHINA, SPLASH = 36, 39, 38, 42, 46, 49, 51, 52, 55
TOM_L, TOM_M, TOM_H = 41, 45, 48

QUAL = {'m6': [0, 3, 7, 9], '7': [0, 4, 7, 10], 'm7b5': [0, 3, 6, 10], 'M6': [0, 4, 7, 9], 'm7': [0, 3, 7, 10], 'm': [0, 3, 7]}
ROOT = {'C': 36, 'D': 38, 'Eb': 39, 'E': 40, 'F': 41, 'G': 43, 'A': 45, 'Bb': 46, 'B': 47}


def chord(name):
    for q in ('m7b5', 'm6', 'M6', 'm7', '7', 'm'):
        if name.endswith(q):
            return ROOT[name[:-len(q)]], QUAL[q]
    return ROOT[name], [0, 4, 7]


def tones(name, octave=4):
    r, q = chord(name)
    return [r + 12 * (octave - 2) + i for i in q]


def e8(e):
    """8분음표 번호(마디 안 0~7) → 16분음표 위치 (스윙: 뒷박은 셋잇단 2/3 지점)"""
    return (e // 2) * 4 + (0 if e % 2 == 0 else 8 / 3)


def play_line(s, ch, b, line, vel, shift=0):
    """line: [(8분음표 위치, 음, 8분음표 길이)]"""
    for e, m, ln in line:
        start, end = e8(e), e8(e + ln)  # 다음 마디로 넘어가도 그대로 계산된다
        s.n(ch, b * 16 + start, m + shift, max(1.2, end - start), vel)


def bar_chords(spec):
    """'Dm6' 또는 'Em7b5 A7' (반 마디씩)"""
    parts = spec.split()
    return [(0, parts[0])] if len(parts) == 1 else [(0, parts[0]), (8, parts[1])]


def rhythm(s, b, spec, sec, kick=True, stop=False, hats=True):
    """sec: 0 도입(드럼 없음) · 1 본편 · 2 드롭
    stop: 3·4박에서 킥·베이스·하이햇을 빼고 기타 한 방만 (다음 마디 '팡' 을 위한 숨 고르기)"""
    chords = bar_chords(spec)
    for beat in range(4):
        at = b * 16 + beat * 4
        if stop and beat >= 2:
            if beat == 2:
                for m in tones(chords[-1][1], 3)[1:]:
                    s.n('pompe', at, m + 12, 0.9, 96)
            continue
        name = [c for st, c in chords if st <= beat * 4][-1]
        r, _ = chord(name)
        tn = tones(name, 3)
        # 라 퐁프: 매 박 짧게, 2·4박 강하게
        for m in tn[1:]:
            s.n('pompe', at, m + 12, 0.9, 84 if beat % 2 else 64)
        if beat % 2:
            for m in tn[1:]:
                s.n('pompe', at + 8 / 3, m + 12, 0.6, 40)
        # 콘트라베이스 워킹: 근음 · 5음 · 옥타브 · 다음 코드로 반음 접근
        walk = [r, r + 7, r + 12, r + 11 if beat == 3 else r + 7]
        s.n('upright', at, walk[beat] - 12 if walk[beat] > 50 else walk[beat], 3.2, 100)
        if sec >= 1:
            # 오프비트 신스 베이스 (킥 사이를 채워 '쿵짝' 탄력)
            s.n('sbass', at + 2, r, 1.6, 96 if sec == 2 else 80)
        if sec >= 1 and kick:
            s.n('drums', at, KICK, 1, 120)
            if hats:
                s.n('drums', at + 2, OHAT, 1, 72 if sec == 1 else 86)
                s.n('drums', at, CHAT, 1, 50)
                s.n('drums', at + 8 / 3, CHAT, 1, 44)
            if beat % 2:
                s.n('drums', at, CLAP, 1, 100)
                if sec == 2:
                    s.n('drums', at, SNARE, 1, 70)
        # 패드: 박마다 숨 쉬는 사이드체인 느낌
        if sec == 2:
            s.ramp('spad', b * 16 + beat * 4, 2, 30, 118)


def pad_and_piano(s, b, spec, sec):
    for st, name in bar_chords(spec):
        ln = 16 - st if len(bar_chords(spec)) == 1 else 8
        if sec == 2:
            for m in tones(name, 4):
                s.n('spad', b * 16 + st, m, ln, 80)
        # 피아노: 2박·4박 뒷박에 찍는 스윙 컴핑
        for off in (4 + 8 / 3, 12 + 8 / 3):
            if st <= off < st + ln:
                for m in tones(name, 4):
                    s.n('piano', b * 16 + off, m, 1.3, 78 if sec else 66)


def charleston(s, b, spec, vel):
    """찰스턴 리듬(1박, 2박 뒷박) 금관 스탭"""
    name = bar_chords(spec)[0][1]
    for e in (0, 3):
        for m in tones(name, 4):
            s.n('brass', b * 16 + e8(e), m, 1.4, vel)


# ---------------------------------------------------------------- swing-battle
# m6 화음·클라리넷 독주는 '마법학교' 같은 기묘한 느낌이 나서, m7 화음 + 금관·색소폰 블루스 리프로 신나게
PROG = ['Dm7', 'Dm7', 'Gm7', 'A7', 'Dm7', 'Bb7', 'Gm7 A7', 'Dm7 A7']
# 드롭 리프: 같은 음을 두 번 '빠빰' 찍고 튀어 오르는 스윙 샤우트 (D 블루스 스케일)
RIFF = [
    [(0, 81, 1), (1, 81, 1), (2, 77, 1), (3, 81, 2), (5, 84, 1), (6, 81, 2)],
    [(0, 79, 1), (1, 77, 1), (2, 74, 1), (3, 77, 2), (5, 74, 1), (6, 72, 1), (7, 74, 1)],
    [(0, 82, 1), (1, 82, 1), (2, 79, 1), (3, 82, 2), (5, 86, 1), (6, 82, 2)],
    [(0, 85, 1), (1, 84, 1), (2, 81, 1), (3, 79, 1), (4, 76, 2), (6, 73, 2)],
    [(0, 81, 1), (1, 81, 1), (2, 77, 1), (3, 81, 2), (5, 84, 1), (6, 81, 2)],
    [(0, 86, 1), (1, 86, 1), (2, 82, 1), (3, 86, 2), (5, 89, 1), (6, 86, 2)],
    [(0, 82, 1), (1, 79, 1), (2, 77, 1), (3, 74, 1), (4, 85, 1), (5, 81, 1), (6, 79, 1), (7, 76, 1)],
    [(0, 74, 3)],
]


def call(root):
    """블루스 '콜' 리프: 근음 → 단3 → 4 → #4 → 5 → 단3 → 근음"""
    r = 62 + (root - 62) % 12
    return [(0, r, 1), (1, r + 3, 1), (2, r + 5, 1), (3, r + 6, 1), (4, r + 7, 2), (6, r + 3, 1), (7, r, 1)]


def answer(s, b, spec, vel):
    """금관 '대답': 찰스턴 스탭 + 다음 마디로 끌어 올리는 픽업"""
    charleston(s, b, spec, vel)
    r, _ = chord(bar_chords(spec)[-1][1])
    play_line(s, 'brass', b, [(5, r + 24, 1), (6, r + 26, 1), (7, r + 27, 1)], vel - 6)


def groove_extras(s, b, i, shaker=True, claps=True):
    """셰이커(스윙 8분) · 2·4박 박수"""
    if shaker:
        for e in range(8):
            s.n('drums', b * 16 + e8(e), 70, 0.8, 58 + (16 if e % 2 == 0 else 0))
    if claps:
        for q in (4, 12):
            s.n('drums', b * 16 + q, CLAP, 1, 92)


def slam(s, b, name, big=False):
    """드롭 첫 박의 '팡': 킥 + 크래시·차이나 + 오케스트라 히트 + 신스 드럼 + 금관 스포르찬도 + 긴 저음"""
    at = b * 16
    s.n('drums', at, KICK, 1, 127)
    s.n('drums', at, CRASH, 12, 127)
    s.n('drums', at, CHINA if big else SPLASH, 8, 112)
    s.n('boom', at, 36, 8, 110)
    r, _ = chord(name)
    for m in tones(name, 4)[:3]:
        s.n('hit', at, m + 12, 2, 108)
        s.n('brass', at, m, 3, 116)
    s.n('sbass', at, r, 6, 120)
    s.n('tbn', at, r + 12, 4, 112)
    if big:
        s.n('tpt', at, tones(name, 5)[2], 4, 120)


def build_up(s, b, pickup=True):
    """스톱 마디 위에 리버스 심벌 + 가속하는 스네어 롤 + 금관 픽업"""
    s.n('riser', b * 16, 60, 16, 120)
    for k in range(6):  # 앞 반 마디: 8분 셋잇단
        s.n('drums', b * 16 + k * 4 / 3, SNARE, 1, 50 + k * 6)
    for k in range(8):  # 뒤 반 마디: 16분 → 마지막 16분은 비움
        if k < 7:
            s.n('drums', b * 16 + 8 + k, SNARE if k < 4 else (TOM_H, TOM_M, TOM_L)[min(2, k - 4)], 1, 86 + k * 5)
    if pickup:
        play_line(s, 'brass', b, [(5, 69, 1), (6, 72, 1), (7, 73, 1)], 118)
        play_line(s, 'sax', b, [(5, 81, 1), (6, 84, 1), (7, 85, 1)], 110)


def run16(s, ch, b, st16, notes, vel):
    """16분음표로 몰아치는 런 (스윙 없이 곧게)"""
    for k, m in enumerate(notes):
        s.n(ch, b * 16 + st16 + k, m, 1, vel + (8 if k % 4 == 0 else 0))


# 색소폰 솔로: (8분음표 선율) + [(16분음표 시작, 런)]
SOLO = [
    ([(0, 69, 1), (1, 74, 1), (2, 77, 1), (3, 81, 1), (4, 83, 2), (6, 81, 1), (7, 77, 1)], []),
    ([(4, 86, 3), (7, 85, 1)], [(0, [76, 77, 79, 81, 82, 81, 80, 81])]),
    ([(0, 86, 1), (1, 82, 1), (2, 79, 1), (3, 76, 1), (4, 78, 1), (5, 79, 1), (6, 82, 1), (7, 86, 1)], []),
    ([(0, 85, 2), (2, 82, 1), (3, 81, 1), (4, 79, 1), (5, 76, 1), (6, 73, 1), (7, 76, 1)], []),
    ([(0, 74, 1), (1, 77, 1), (2, 81, 1), (3, 86, 2), (5, 88, 1), (6, 86, 2)], []),
    ([(4, 82, 2), (6, 84, 1), (7, 86, 1)], [(0, [86, 84, 82, 80, 77, 74, 77, 80])]),
    ([(0, 88, 1), (1, 86, 1), (2, 82, 1), (3, 79, 1), (4, 85, 1), (5, 82, 1), (6, 79, 1), (7, 76, 1)], []),
    ([(0, 86, 3)], [(6, [81, 83, 85, 86])]),
]


def swing_battle():
    s = Song(140, SWING)
    bar = 0
    # 도입 4마디: 킥·신스 베이스는 아껴 두고, 금관·색소폰 콜 & 리스폰스 + 박수·셰이커로 처음부터 들썩이게
    for i, c in enumerate(PROG[:4]):
        b = bar + i
        rhythm(s, b, c, 0)
        pad_and_piano(s, b, c, 1)
        groove_extras(s, b, i)
        r, _ = chord(bar_chords(c)[0][1])
        if i % 2 == 0:
            play_line(s, 'sax', b, call(r), 104)
            play_line(s, 'mute', b, call(r), 96, 12)
        else:
            answer(s, b, c, 104)
        s.n('tbn', b * 16, r + 12, 3, 92)
        for q in range(4):
            s.n('drums', b * 16 + q * 4 + 2, OHAT, 1, 54)
    s.n('drums', 0, CRASH, 12, 96)
    run16(s, 'piano', 0, 0, [62, 65, 69, 72, 74, 77, 81, 84], 84)
    bar += 4
    # 빌드업 4마디: 4박 킥 + 오프비트 하이햇 + 신스 베이스, 트럼펫·색소폰 콜이 마디마다, 마지막은 스톱 + 라이저
    for i, c in enumerate(PROG[4:]):
        b = bar + i
        last = i == 3
        rhythm(s, b, c, 1, stop=last)
        pad_and_piano(s, b, c, 1)
        groove_extras(s, b, i, claps=not last)
        r, _ = chord(bar_chords(c)[0][1])
        line = call(r) if not last else call(r)[:2]
        play_line(s, 'tpt', b, line, 100)
        play_line(s, 'sax', b, line, 96, -12)
        if i % 2 == 1 and not last:
            charleston(s, b, c, 100)
        for m in tones(bar_chords(c)[0][1], 4):
            s.n('spad', b * 16, m, 16 if not last else 8, 70)
    s.n('drums', bar * 16, CRASH, 8, 100)
    build_up(s, bar + 3)
    bar += 4
    loop_start = bar

    def drop(b0, big):
        for i, c in enumerate(PROG):
            b = b0 + i
            last = i == 7
            rhythm(s, b, c, 2, stop=last)
            pad_and_piano(s, b, c, 2)
            play_line(s, 'sax', b, RIFF[i], 116)
            play_line(s, 'tpt', b, RIFF[i], 106 if big else 98, 12 if big and i in (0, 4) else 0)
            play_line(s, 'lead', b, RIFF[i], 76, 12 if (big or i % 2) else 0)
            play_line(s, 'tbn', b, [(e, m - 12, ln) for e, m, ln in RIFF[i]], 92)
            if not last:
                charleston(s, b, c, 110 if big else 102)
                groove_extras(s, b, i, claps=False)
            if big and not last:
                for q in range(4):
                    s.n('drums', b * 16 + q * 4, CLAP, 1, 98)
            if i == 4:
                s.n('drums', b * 16, CRASH, 8, 112)
                s.n('hit', b * 16, tones(c, 4)[0] + 12, 2, 110)
        slam(s, b0, PROG[0], big)
        build_up(s, b0 + 7)

    def solo(b0):
        for i, c in enumerate(PROG):
            b = b0 + i
            last = i == 7
            rhythm(s, b, c, 2, stop=last)
            pad_and_piano(s, b, c, 2)
            line, runs = SOLO[i]
            play_line(s, 'sax', b, line, 120)
            for st, notes in runs:
                run16(s, 'sax', b, st, notes, 112)
            if not last:
                # 금관이 뒤에서 '빠밤' 찍어 주고 셰이커로 들썩
                charleston(s, b, c, 96)
                groove_extras(s, b, i, claps=False)
            if i % 4 == 0:
                s.n('drums', b * 16, CRASH, 8, 100)
        slam(s, b0, PROG[0])
        s.n('riser', (b0 + 7) * 16, 60, 16, 110)
        for k in range(8, 15):
            s.n('drums', (b0 + 7) * 16 + k, SNARE, 1, 80 + k * 3)

    def breakdown(b0):
        # 킥·하이햇을 빼고 박수·셰이커·금관 콜로 → 3마디째 킥 복귀 → 4마디째 스톱 + 빌드업
        for i, c in enumerate(PROG[:4]):
            b = b0 + i
            last = i == 3
            rhythm(s, b, c, 1, kick=(i == 2), hats=False, stop=last)
            pad_and_piano(s, b, c, 1)
            groove_extras(s, b, i, claps=not last)
            r, _ = chord(bar_chords(c)[0][1])
            if i % 2 == 0:
                play_line(s, 'mute', b, call(r), 100, 12)
                play_line(s, 'sax', b, call(r), 92)
            elif not last:
                answer(s, b, c, 100)
            for m in tones(bar_chords(c)[0][1], 4):
                s.n('spad', b * 16, m, 16, 70)
        s.n('drums', b0 * 16, CRASH, 12, 90)
        build_up(s, b0 + 3)

    drop(bar, False); bar += 8
    solo(bar); bar += 8
    breakdown(bar); bar += 4
    drop(bar, True); bar += 8
    loop_end = bar
    # 반복 지점 뒤: 첫 드롭의 '팡' 을 한 번 더 (잔향용)
    rhythm(s, bar, PROG[0], 2)
    slam(s, bar, PROG[0])
    s.save('swing-battle')
    return {'loopStart': s.sec(loop_start), 'loopEnd': s.sec(loop_end)}


# ---------------------------------------------------------------- swing-pinch
PPROG = ['Dm7', 'Eb7', 'Dm7', 'A7', 'Gm7', 'Dm7', 'Eb7', 'A7']
PMEL = [
    [(0, 81, 1), (1, 80, 1), (2, 81, 1), (3, 84, 1), (4, 81, 2), (6, 77, 2)],
    [(0, 79, 1), (1, 82, 1), (2, 85, 1), (3, 82, 1), (4, 79, 2), (6, 77, 2)],
    [(0, 77, 1), (1, 81, 1), (2, 86, 2), (4, 83, 1), (5, 81, 1), (6, 77, 2)],
    [(0, 76, 1), (1, 79, 1), (2, 81, 1), (3, 85, 3), (6, 81, 2)],
    [(0, 79, 1), (1, 82, 1), (2, 86, 1), (3, 88, 1), (4, 86, 2), (6, 82, 2)],
    [(0, 81, 1), (1, 77, 1), (2, 74, 1), (3, 77, 1), (4, 81, 2), (6, 86, 2)],
    [(0, 85, 1), (1, 82, 1), (2, 79, 1), (3, 75, 1), (4, 79, 1), (5, 82, 1), (6, 85, 2)],
    [(0, 85, 2), (2, 81, 2), (4, 76, 2), (6, 73, 2)],
]


def swing_pinch():
    s = Song(164, SWING)
    # 예비 1마디: 스톱 + 빌드업 → 반복 구간 첫 박이 '팡'
    rhythm(s, 0, 'A7', 2, stop=True)
    build_up(s, 0)
    bar = 1

    def half(b0, melody):
        for i, c in enumerate(PPROG):
            b = b0 + i
            last = i == 7
            rhythm(s, b, c, 2, stop=last)
            pad_and_piano(s, b, c, 2)
            # 약음기 트럼펫이 셋잇단으로 코드를 빠르게 오르내린다 + 셰이커
            tn = tones(c, 5)
            run = tn + [tn[0] + 12] + tn[::-1]
            for k in range(6 if last else 12):
                s.n('mute', b * 16 + k * 4 / 3, run[k % len(run)] - 12, 1.2, 80 + (12 if k % 3 == 0 else 0))
            if not last:
                groove_extras(s, b, i, claps=False)
            if i == 4:
                s.n('drums', b * 16, CRASH, 8, 112)
                s.n('hit', b * 16, tones(c, 4)[0] + 12, 2, 108)
            if not melody:
                charleston(s, b, c, 114)
                for e in (0, 3):
                    s.n('lead', b * 16 + e8(e), tones(c, 5)[0], 1.2, 84)
            else:
                line = PMEL[i] if not last else PMEL[i][:2]
                play_line(s, 'tpt', b, line, 118)
                play_line(s, 'sax', b, line, 104, -12)
                play_line(s, 'lead', b, line, 76)
                charleston(s, b, c, 100)
                for q in range(4):
                    s.n('drums', b * 16 + q * 4, CLAP, 1, 92)
        slam(s, b0, PPROG[0], melody)
        build_up(s, b0 + 7)

    half(bar, False); bar += 8
    half(bar, True); bar += 8
    rhythm(s, bar, PPROG[0], 2)
    slam(s, bar, PPROG[0])
    s.save('swing-pinch')
    return {'loopStart': s.sec(1), 'loopEnd': s.sec(17)}


# ---------------------------------------------------------------- swing-victory
def swing_victory():
    s = Song(140, SWING)
    # 금관 쇼트 → D장6 화음으로 '짜잔' + 드럼 필
    hits = [(0, 'Gm6'), (8 / 3, 'A7'), (6, 'A7')]
    for at, c in hits:
        for m in tones(c, 4):
            s.n('brass', at, m, 1.5, 110)
            s.n('sax', at, m + 12, 1.5, 96)
        s.n('drums', at, KICK, 1, 110)
        s.n('drums', at, CLAP, 1, 100)
    for k in range(6):
        s.n('drums', 8 + k * 4 / 3, SNARE, 1, 80 + k * 8)
    end = 16
    for m in (62, 66, 69, 71):  # D장6 화음
        s.n('brass', end, m, 16, 118)
        s.n('sax', end, m + 12, 16, 100)
        s.n('spad', end, m, 16, 80)
        s.n('hit', end, m + 12, 2, 100)
    s.n('tpt', end, 86, 16, 120)
    s.n('mute', end, 78, 16, 100)
    s.n('upright', end, 38, 8, 110)
    s.n('sbass', end, 38, 8, 100)
    s.n('drums', end, CRASH, 16, 120)
    s.n('drums', end, KICK, 1, 120)
    s.n('boom', end, 36, 8, 127)
    s.n('drums', end, CHINA, 8, 110)
    s.save('swing-victory')
    return {}


def main():
    return {'swing-battle': swing_battle(), 'swing-pinch': swing_pinch(), 'swing-victory': swing_victory()}


if __name__ == '__main__':
    print(json.dumps(main(), indent=2))
