"""미분 배틀 배경음악 — 일렉트로스윙 버전 (오리지널 곡)

    python3 tools/music/swing.py   # tools/music/out/swing-*.mid 생성 (render.sh 가 같이 부른다)

재즈 쪽: 약음기 트럼펫·알토 색소폰·클라리넷·트롬본·금관 섹션, 집시 재즈식 '라 퐁프' 기타, 콘트라베이스, 피아노
전자 쪽: 4박 킥 + 박수 + 오프비트 오픈 하이햇, 오프비트 신스 베이스, 사이드체인처럼 숨 쉬는 신스 패드, 톱니파 리드
8분음표는 셋잇단 2:1 로 스윙한다.

구성 (레퍼런스처럼 8마디 단위, 각 구간 마지막 마디는 킥·베이스가 빠지는 '스톱' → 다음 첫 박에 '팡')
    battle : 도입 4(고음 훅) · 빌드업 4 → [드롭 · 색소폰 솔로 · 고음 하이라이트 · 최고조 · 브레이크다운 · 드롭 B · 트럼펫 솔로 · 하이라이트 · 최고조] 반복 (각 8마디, 148bpm)
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
ROOT = {'C': 36, 'D': 38, 'Eb': 39, 'E': 40, 'F': 41, 'F#': 42, 'G': 43, 'G#': 44, 'A': 45, 'Bb': 46, 'B': 47}


def chord(name):
    """'Am7' → (근음, 구성음 간격). 'Am/G' 같은 분수 화음은 화음 부분만"""
    name = name.split()[0].split('/')[0]  # 마디 전체('Am Am/G …')를 받으면 첫 화음
    for q in ('m7b5', 'm6', 'M6', 'm7', '7', 'm'):
        if name.endswith(q):
            return ROOT[name[:-len(q)]], QUAL[q]
    return ROOT[name], [0, 4, 7]


def bass_of(name):
    """베이스 음: 분수 화음이면 / 뒤의 음, 아니면 근음"""
    name = name.split()[0]
    return ROOT[name.split('/')[1]] if '/' in name else chord(name)[0]


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
    """'Am' · 'Dm7 E7'(반 마디씩) · 'Am Am/G Am/F# E7/G#'(한 박씩)"""
    parts = spec.split()
    return [(16 * i // len(parts), c) for i, c in enumerate(parts)]


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
        r = bass_of(name)
        tn = tones(name, 3)
        # 라 퐁프: 매 박 짧게, 2·4박 강하게
        for m in tn[1:]:
            s.n('pompe', at, m + 12, 0.9, 84 if beat % 2 else 64)
        if beat % 2:
            for m in tn[1:]:
                s.n('pompe', at + 8 / 3, m + 12, 0.6, 40)
        # 콘트라베이스 워킹: 근음 · 5음 · 옥타브 · 다음 코드로 반음 접근
        # 한 박씩 바뀌는 화음(라인 클리셰)이나 분수 화음이면 베이스가 그 음을 그대로 걷는다
        walk = [r] * 4 if (len(chords) == 4 or '/' in name) else [r, r + 7, r + 12, r + 11 if beat == 3 else r + 7]
        s.n('upright', at, walk[beat] - 12 if walk[beat] > 50 else walk[beat], 3.2, 104)
        if sec >= 1:
            # 오프비트 신스 베이스 (킥 사이를 채워 '쿵짝' 탄력)
            s.n('sbass', at + 2, r, 1.6, 96 if sec == 2 else 80)
        if sec >= 1 and kick:
            s.n('drums', at, KICK, 1, 120)
            if hats:
                s.n('drums', at + 2, OHAT, 1, 90 if sec == 1 else 108)
                s.n('drums', at, CHAT, 1, 64)
                s.n('drums', at + 8 / 3, CHAT, 1, 60)
                if sec == 2:
                    s.n('drums', at + 10 / 3, CHAT, 1, 84)  # 박 끝에서 밀어 주는 하이햇 (레퍼런스 그루브)
            if beat % 2:
                s.n('drums', at, CLAP, 1, 100)
                if sec == 2:
                    s.n('drums', at, SNARE, 1, 70)
        # 패드: 박마다 숨 쉬는 사이드체인 느낌
        if sec == 2:
            s.ramp('spad', b * 16 + beat * 4, 2, 30, 118)


def pad_and_piano(s, b, spec, sec):
    parts = bar_chords(spec)
    for k, (st, name) in enumerate(parts):
        ln = (parts[k + 1][0] if k + 1 < len(parts) else 16) - st
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
# A단조. 드롭은 레퍼런스처럼 베이스가 한 박씩 A → G → F# → G# 로 걷는 '마이너 라인 클리셰'
LC = 'Am Am/G Am/F# E7/G#'
LC2 = 'Am/F# Am/F# E7 E7/G#'
PROG = [LC, LC, LC, LC2, LC, LC, LC, LC2]
HALF = ['Am', 'Am/G', 'Am/F#', 'E7/G#']  # 도입·브레이크다운: 한 마디에 한 음씩 천천히
_RA = [(0, 81, 1), (1, 81, 1), (2, 76, 1), (3, 81, 2), (5, 84, 1), (6, 83, 1), (7, 80, 1)]
_RB = [(0, 81, 1), (1, 79, 1), (2, 76, 2), (4, 78, 1), (5, 76, 1), (6, 74, 1), (7, 71, 1)]
_RD = [(0, 84, 1), (1, 84, 1), (2, 81, 1), (3, 78, 2), (5, 81, 1), (6, 80, 1), (7, 76, 1)]
RIFF = [_RA, _RB, _RA, _RD, _RA, _RB, _RA, [(0, 81, 3)]]
# 색소폰 솔로는 i-iv-V 로 (예전 D단조 솔로를 A단조로 옮김)
SOLO_PROG = ['Am7', 'Am7', 'Dm7', 'E7', 'Am7', 'F7', 'Dm7 E7', 'Am7 E7']


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
            s.n('drums', b * 16 + e8(e), 70, 0.8, 76 + (20 if e % 2 == 0 else 0))
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


SOLO_A = [([(e, m - 5, ln) for e, m, ln in line], [(st, [m - 5 for m in ns]) for st, ns in runs]) for line, runs in SOLO]


# ---------------------------------------------------------------- swing-battle 본편 (고음 하이라이트)
# 레퍼런스처럼 선율(훅)이 높은 음역(C6~G6)에 살고, 최고조 전에 중저음을 비운 채 훅이 A6·C7 까지 치고 올라가는
# '하이라이트' 구간을 거쳐 → 리프 + 고음 훅이 한꺼번에 터지는 최고조로.
HOOK = {
    1: [(0, 88, 2), (2, 93, 2), (4, 91, 1), (5, 88, 1), (6, 86, 1), (7, 84, 1)],
    2: [(0, 86, 3), (3, 84, 1), (4, 81, 2), (6, 83, 1), (7, 84, 1)],
    3: [(0, 88, 2), (2, 93, 2), (4, 96, 2), (6, 95, 1), (7, 93, 1)],
    4: [(0, 90, 3), (3, 88, 1), (4, 92, 4)],
    'peak': [(0, 93, 8)],
}
HL = dict(SWING, clar=(3, 72, 90, 70, 60))  # 클라리넷 자리에 피콜로


# 트럼펫 솔로 (두 번째 바퀴): SOLO_PROG 위에서 높은 음으로 길게 외치는 쪽
TPT_SOLO = [
    [(0, 76, 1), (1, 79, 1), (2, 81, 2), (4, 84, 3), (7, 83, 1)],
    [(0, 81, 1), (1, 79, 1), (2, 76, 1), (3, 74, 1), (4, 72, 2), (6, 76, 2)],
    [(0, 77, 1), (1, 81, 1), (2, 84, 2), (4, 86, 2), (6, 84, 1), (7, 81, 1)],
    [(0, 80, 2), (2, 83, 1), (3, 86, 1), (4, 88, 3), (7, 86, 1)],
    [(0, 84, 1), (1, 88, 1), (2, 91, 3), (5, 88, 1), (6, 84, 2)],
    [(0, 87, 1), (1, 84, 1), (2, 81, 1), (3, 77, 1), (4, 81, 2), (6, 84, 2)],
    [(0, 86, 2), (2, 84, 1), (3, 81, 1), (4, 83, 1), (5, 86, 1), (6, 88, 2)],
    [(0, 93, 3)],
]


def swing_battle():
    """도입 4 · 빌드업 4 → [드롭 · 색소폰 솔로 · 하이라이트 · 최고조 · 브레이크다운 · 드롭 B · 트럼펫 솔로 · 하이라이트 · 마지막 최고조] 반복 (72마디, 약 2분)"""
    s = Song(148, HL)
    picc = 'clar'
    bar = 0
    # 도입: 고음 훅을 피콜로 + 약음기 트럼펫(옥타브 아래)으로 먼저 들려준다
    for i, (c, h) in enumerate(zip(HALF, (1, 2, 1, 4))):
        b = bar + i
        rhythm(s, b, c, 0)
        pad_and_piano(s, b, c, 1)
        groove_extras(s, b, i)
        play_line(s, picc, b, HOOK[h], 92)
        play_line(s, 'mute', b, HOOK[h], 80, -12)
        s.n('tbn', b * 16, bass_of(c) + 12, 3, 88)
        for q in range(4):
            s.n('drums', b * 16 + q * 4 + 2, OHAT, 1, 54)
    s.n('drums', 0, CRASH, 12, 96)
    run16(s, 'piano', 0, 0, [57, 60, 64, 69, 72, 76, 81, 84], 84)
    bar += 4
    # 빌드업 (지금 스윙과 같음)
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

    def drop(b0, climax, second=False):
        """second: 두 번째 바퀴 드롭 — 리프는 트럼펫·약음기 트럼펫이, 색소폰은 한 옥타브 아래로 훅을 받는다"""
        hooks = (1, 2, 1, 4, 1, 2, 3, None)
        for i, c in enumerate(PROG):
            b = b0 + i
            last = i == 7
            rhythm(s, b, c, 2, stop=last)
            pad_and_piano(s, b, c, 2)
            if second and hooks[i]:
                play_line(s, 'mute', b, RIFF[i], 100)
                play_line(s, 'sax', b, HOOK[hooks[i]], 104, -12)
            else:
                play_line(s, 'sax', b, RIFF[i], 116)
            play_line(s, 'tpt', b, RIFF[i], 104)
            play_line(s, 'tbn', b, [(e, m - 12, ln) for e, m, ln in RIFF[i]], 92)
            if climax and hooks[i]:
                # 최고조: 리프 위로 고음 훅이 같이 (피콜로 + 톱니파 리드)
                play_line(s, picc, b, HOOK[hooks[i]], 110)
                play_line(s, 'lead', b, HOOK[hooks[i]], 82)
            else:
                play_line(s, 'lead', b, RIFF[i], 76, 12 if i % 2 else 0)
            if not last:
                charleston(s, b, c, 110 if climax else 102)
                groove_extras(s, b, i, claps=False)
            if climax and not last:
                for q in range(4):
                    s.n('drums', b * 16 + q * 4, CLAP, 1, 98)
            if i == 4:
                s.n('drums', b * 16, CRASH, 8, 112)
                s.n('hit', b * 16, tones(c, 4)[0] + 12, 2, 110)
        slam(s, b0, PROG[0], climax)
        build_up(s, b0 + 7)

    def solo(b0, inst='sax'):
        for i, c in enumerate(SOLO_PROG):
            b = b0 + i
            last = i == 7
            rhythm(s, b, c, 2, stop=last)
            pad_and_piano(s, b, c, 2)
            if inst == 'sax':
                line, runs = SOLO_A[i]
                play_line(s, 'sax', b, line, 120)
                for st, notes in runs:
                    run16(s, 'sax', b, st, notes, 112)
            else:
                play_line(s, 'tpt', b, TPT_SOLO[i], 122)
                play_line(s, 'mute', b, TPT_SOLO[i], 70, -12)
            if not last:
                charleston(s, b, c, 96)
                groove_extras(s, b, i, claps=False)
            if i % 4 == 0:
                s.n('drums', b * 16, CRASH, 8, 100)
        slam(s, b0, SOLO_PROG[0])
        s.n('riser', (b0 + 7) * 16, 60, 16, 110)
        for k in range(8, 15):
            s.n('drums', (b0 + 7) * 16 + k, SNARE, 1, 80 + k * 3)

    def highlight(b0):
        """하이라이트 8마디: 중저음은 비우고(콘트라베이스·기타 없이 신스 베이스만 박에), 훅이 고음으로 치고 올라간다.
        박수·킥이 마디마다 촘촘해지고, 7마디째 A6 를 길게 → 8마디째 스톱 + 라이저"""
        hooks = (1, 2, 1, 4, 3, 2, 'peak', None)
        for i, c in enumerate(PROG):
            b = b0 + i
            last = i == 7
            names = [n for _, n in bar_chords(c)]
            for q in range(4):
                at = b * 16 + q * 4
                if last and q >= 2:
                    continue
                s.n('sbass', at, bass_of(names[q]), 2, 96)
                if i >= 2 or q % 2 == 0:
                    s.n('drums', at, KICK, 1, 100 + i * 3)
                s.n('drums', at + 2, OHAT, 1, 70 + i * 5)
                if i < 4:
                    if q % 2:
                        s.n('drums', at, CLAP, 1, 90)
                else:
                    s.n('drums', at, CLAP, 1, 90 + i * 2)
                    if i >= 5:
                        s.n('drums', at + 8 / 3, CLAP, 1, 70 + i * 4)
            # 가운데는 피아노 컴핑·기타 2·4박으로 가볍게 채운다 (너무 비면 앙상해서)
            pad_and_piano(s, b, c, 1)
            for q in (1, 3):
                if not (last and q == 3):
                    for m in tones(names[q], 3)[1:]:
                        s.n('pompe', b * 16 + q * 4, m + 12, 0.9, 88)
            for m in tones(names[0], 4):
                s.n('horn' if 'horn' in s.ch else 'brass', b * 16, m, 16 if not last else 8, 50 + i * 5)
            # 높이 깔리는 패드가 점점 커진다
            for m in tones(names[0], 5):
                s.n('spad', b * 16, m, 16 if not last else 8, 60 + i * 7)
            if hooks[i]:
                play_line(s, picc, b, HOOK[hooks[i]], 104 + i * 2)
                play_line(s, 'lead', b, HOOK[hooks[i]], 72 + i * 3)
                play_line(s, 'tpt', b, HOOK[hooks[i]], 84 + i * 3, -12)
            # 금관은 가끔 높은 화음으로 '빠-' 하고 받쳐 줄 뿐
            if i in (1, 3, 5):
                for m in tones(names[0], 5)[:3]:
                    s.n('brass', b * 16 + 8, m, 6, 88)
        s.n('drums', b0 * 16, CRASH, 12, 100)
        s.n('drums', (b0 + 4) * 16, CRASH, 8, 104)
        build_up(s, b0 + 7)

    def breakdown(b0):
        """숨 돌리기 8마디: 킥 없이 피아노·기타·박수 위로 피콜로 훅을 가볍게 → 5마디째 킥 복귀 → 마지막 스톱 + 빌드업"""
        for i, c in enumerate(HALF + HALF):
            b = b0 + i
            last = i == 7
            rhythm(s, b, c, 1, kick=(i >= 4), hats=(i >= 4), stop=last)
            pad_and_piano(s, b, c, 1)
            groove_extras(s, b, i, claps=not last)
            h = (1, 2, 1, 4)[i % 4]
            if not last:
                play_line(s, picc, b, HOOK[h], 80 + i * 3)
                play_line(s, 'mute', b, HOOK[h], 72 + i * 3, -12)
            for m in tones(c, 4):
                s.n('spad', b * 16, m, 16 if not last else 8, 62 + i * 3)
        s.n('drums', b0 * 16, CRASH, 12, 90)
        s.n('drums', (b0 + 4) * 16, CRASH, 8, 96)
        build_up(s, b0 + 7)

    drop(bar, False); bar += 8
    solo(bar); bar += 8
    highlight(bar); bar += 8
    drop(bar, True); bar += 8
    breakdown(bar); bar += 8
    drop(bar, False, second=True); bar += 8
    solo(bar, 'tpt'); bar += 8
    highlight(bar); bar += 8
    drop(bar, True); bar += 8
    loop_end = bar
    rhythm(s, bar, PROG[0], 2)
    slam(s, bar, PROG[0])
    s.save('swing-battle', stems=True)
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
    s.tp = -5  # D단조 → A단조 (전투곡과 같은 조)
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
    s.save('swing-pinch', stems=True)
    return {'loopStart': s.sec(1), 'loopEnd': s.sec(17)}


# ---------------------------------------------------------------- swing-victory
def swing_victory():
    s = Song(140, SWING)
    s.tp = -5
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
    s.save('swing-victory', stems=True)
    return {}


def main():
    return {'swing-battle': swing_battle(), 'swing-pinch': swing_pinch(), 'swing-victory': swing_victory()}


if __name__ == '__main__':
    print(json.dumps(main(), indent=2))
