"""미분 배틀 배경음악 — 일렉트로스윙 버전 (오리지널 곡)

    python3 tools/music/swing.py   # tools/music/out/swing-*.mid 생성 (render.sh 가 같이 부른다)

재즈 쪽: 약음기 트럼펫·알토 색소폰·클라리넷·트롬본·금관 섹션, 집시 재즈식 '라 퐁프' 기타, 콘트라베이스, 피아노
전자 쪽: 4박 킥 + 박수 + 오프비트 오픈 하이햇, 오프비트 신스 베이스, 사이드체인처럼 숨 쉬는 신스 패드, 톱니파 리드
8분음표는 셋잇단 2:1 로 스윙한다.
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
    'vibes': (13, 11, 76, 96, 70),   # 비브라폰
    'choir': (14, 53, 64, 64, 90),   # 우~ 코러스
    'hit':   (15, 55, 60, 64, 70),   # 오케스트라 히트
}
KICK, CLAP, SNARE, CHAT, OHAT, CRASH, RIDE = 36, 39, 38, 42, 46, 49, 51

QUAL = {'m6': [0, 3, 7, 9], '7': [0, 4, 7, 10], 'm7b5': [0, 3, 6, 10], 'M6': [0, 4, 7, 9], 'm': [0, 3, 7]}
ROOT = {'C': 36, 'D': 38, 'Eb': 39, 'E': 40, 'F': 41, 'G': 43, 'A': 45, 'Bb': 46}


def chord(name):
    for q in ('m7b5', 'm6', 'M6', '7', 'm'):
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


def rhythm(s, b, spec, sec, kick=True):
    """sec: 0 도입(드럼 없음) · 1 본편 · 2 드롭"""
    chords = bar_chords(spec)
    for beat in range(4):
        at = b * 16 + beat * 4
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
            s.n('drums', at, KICK, 1, 118)
            s.n('drums', at + 2, OHAT, 1, 70 if sec == 1 else 82)
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
PROG = ['Dm6', 'Dm6', 'Gm6', 'A7', 'Dm6', 'Bb7', 'Em7b5 A7', 'Dm6 A7']
MEL_A = [  # 약음기 트럼펫
    [(2, 69, 1), (3, 74, 1), (4, 77, 2), (6, 76, 1), (7, 74, 1)],
    [(0, 73, 2), (2, 74, 1), (3, 69, 3)],
    [(1, 67, 1), (2, 70, 1), (3, 74, 1), (4, 79, 2), (6, 77, 1), (7, 76, 1)],
    [(0, 76, 1), (1, 73, 1), (2, 69, 2), (4, 67, 1), (5, 69, 3)],
    [(1, 69, 1), (2, 74, 1), (3, 77, 1), (4, 81, 2), (6, 79, 1), (7, 77, 1)],
    [(0, 80, 2), (2, 79, 1), (3, 77, 1), (4, 74, 2), (6, 70, 2)],
    [(0, 79, 1), (1, 76, 1), (2, 70, 2), (4, 73, 1), (5, 76, 1), (6, 79, 2)],
    [(0, 77, 2), (2, 76, 1), (3, 74, 3)],
]
MEL_B = [  # 드롭: 알토 색소폰 + 트럼펫 + 톱니파 리드
    [(0, 74, 1), (1, 77, 1), (2, 81, 1), (3, 77, 1), (4, 80, 1), (5, 81, 3)],
    [(1, 79, 1), (2, 77, 1), (3, 76, 1), (4, 74, 2), (6, 71, 2)],
    [(0, 79, 1), (1, 82, 1), (2, 86, 1), (3, 82, 1), (4, 85, 1), (5, 86, 3)],
    [(1, 85, 1), (2, 83, 1), (3, 81, 1), (4, 79, 2), (6, 76, 2)],
    [(0, 74, 1), (1, 77, 1), (2, 81, 1), (3, 77, 1), (4, 80, 1), (5, 81, 3)],
    [(0, 86, 1), (1, 84, 1), (2, 82, 1), (3, 80, 2), (5, 77, 1), (6, 74, 2)],
    [(0, 79, 1), (1, 76, 1), (2, 74, 1), (3, 70, 1), (4, 73, 1), (5, 76, 1), (6, 79, 1), (7, 82, 1)],
    [(0, 81, 3), (3, 77, 1), (4, 74, 4)],
]
CLAR_A = [74, 74, 74, 73, 77, 74, 74, 73]  # 클라리넷 긴 대선율 (마디마다 한 음, 한 옥타브 위)


def swing_battle():
    s = Song(132, SWING)
    bar = 0
    # 도입 4마디: 기타·베이스·비브라폰, 4마디째에 스네어 셋잇단 롤 + 금관 픽업
    intro = ['Dm6', 'Dm6', 'Gm6', 'A7']
    for i, c in enumerate(intro):
        b = bar + i
        rhythm(s, b, c, 0)
        pad_and_piano(s, b, c, 0)
        for k, m in enumerate(tones(c, 5)):
            s.n('vibes', b * 16 + k * 4, m, 3, 70)
        if i >= 2:
            s.n('drums', b * 16, KICK, 1, 90)
            s.n('drums', b * 16 + 8, KICK, 1, 90)
    b = bar + 3
    for k in range(12):
        s.n('drums', b * 16 + 8 + k * 2 / 3, SNARE, 0.6, 40 + k * 6)
    play_line(s, 'brass', b, [(5, 69, 1), (6, 72, 1), (7, 73, 1)], 100)
    bar += 4

    def section_a(b0):
        for i, c in enumerate(PROG):
            b = b0 + i
            rhythm(s, b, c, 1)
            pad_and_piano(s, b, c, 1)
            play_line(s, 'mute', b, MEL_A[i], 108)
            s.n('clar', b * 16, CLAR_A[i], 16, 62)
            if i == 0:
                s.n('drums', b * 16, CRASH, 8, 90)
        b = b0 + 7
        for k in range(6):
            s.n('drums', b * 16 + 8 + k * 4 / 3, SNARE, 1, 70 + k * 8)
        play_line(s, 'brass', b, [(5, 69, 1), (6, 72, 1), (7, 73, 1)], 108)

    def section_b(b0):
        for i, c in enumerate(PROG):
            b = b0 + i
            rhythm(s, b, c, 2)
            pad_and_piano(s, b, c, 2)
            play_line(s, 'sax', b, MEL_B[i], 112)
            play_line(s, 'tpt', b, MEL_B[i], 96)
            play_line(s, 'lead', b, MEL_B[i], 70, 12 if i in (1, 3, 5, 7) else 0)
            play_line(s, 'tbn', b, [(0, chord(bar_chords(c)[0][1])[0] + 24, 3)], 96)
            if i % 2 == 1:
                charleston(s, b, c, 104)
            if i in (0, 4):
                s.n('drums', b * 16, CRASH, 8, 110)
                s.n('hit', b * 16, 62, 2, 90)
                for m in tones(c, 4):
                    s.n('choir', b * 16, m + 12, 32, 60)
        b = b0 + 7
        for k, n in enumerate((SNARE, SNARE, SNARE, 45, 45, 41)):
            s.n('drums', b * 16 + 8 + k * 4 / 3, n, 1, 90 + k * 5)

    loop_start = bar + 16
    section_a(bar); bar += 8
    section_b(bar); bar += 8
    section_a(bar); bar += 8
    section_b(bar); bar += 8
    rhythm(s, bar, 'Dm6', 1)
    s.n('drums', bar * 16, CRASH, 8, 90)
    s.save('swing-battle')
    return {'loopStart': s.sec(loop_start), 'loopEnd': s.sec(bar)}


# ---------------------------------------------------------------- swing-pinch
PPROG = ['Dm6', 'Eb7', 'Dm6', 'A7', 'Gm6', 'Dm6', 'Eb7', 'A7']
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
    s = Song(152, SWING)
    bar = 0

    def half(b0, melody):
        for i, c in enumerate(PPROG):
            b = b0 + i
            rhythm(s, b, c, 2)
            pad_and_piano(s, b, c, 2)
            # 클라리넷이 셋잇단으로 코드를 빠르게 오르내린다
            tn = tones(c, 5)
            run = tn + [tn[0] + 12] + tn[::-1]
            for k in range(12):
                s.n('clar', b * 16 + k * 4 / 3, run[k % len(run)], 1.2, 70 + (10 if k % 3 == 0 else 0))
            if i in (0, 4):
                s.n('drums', b * 16, CRASH, 8, 112)
                s.n('hit', b * 16, tones(c, 4)[0] + 12, 2, 100)
            if not melody:
                charleston(s, b, c, 112)
                for e in (0, 3):
                    s.n('lead', b * 16 + e8(e), tones(c, 5)[0], 1.2, 80)
            else:
                play_line(s, 'tpt', b, PMEL[i], 116)
                play_line(s, 'sax', b, PMEL[i], 100, -12)
                play_line(s, 'lead', b, PMEL[i], 72)
                if i % 2:
                    charleston(s, b, c, 96)
            if i in (3, 7):
                for k in range(6):
                    s.n('drums', b * 16 + 8 + k * 4 / 3, SNARE, 1, 80 + k * 8)

    for _ in range(2):
        half(bar, False); bar += 8
        half(bar, True); bar += 8
    rhythm(s, bar, 'Dm6', 2)
    s.n('drums', bar * 16, CRASH, 8, 100)
    s.save('swing-pinch')
    return {'loopStart': s.sec(16), 'loopEnd': s.sec(32)}


# ---------------------------------------------------------------- swing-victory
def swing_victory():
    s = Song(132, SWING)
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
        s.n('choir', end, m + 12, 16, 70)
    s.n('tpt', end, 86, 16, 120)
    s.n('mute', end, 78, 16, 100)
    s.n('upright', end, 38, 8, 110)
    s.n('sbass', end, 38, 8, 100)
    s.n('drums', end, CRASH, 16, 120)
    s.n('drums', end, KICK, 1, 120)
    s.n('vibes', end, 74, 8, 90)
    s.save('swing-victory')
    return {}


def main():
    return {'swing-battle': swing_battle(), 'swing-pinch': swing_pinch(), 'swing-victory': swing_victory()}


if __name__ == '__main__':
    print(json.dumps(main(), indent=2))
