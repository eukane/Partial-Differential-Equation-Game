/* 수학 배틀 직업 캐릭터 (코드로 그린 2등신 SD 벡터)
 * 머리·몸·팔·무기를 따로 그려 부위별로 움직인다. 플레이어 색은 --pc 로 들어간다 (.pc / .pc-d).
 * 동작: st-idle(가만히) · st-attack(공격) · st-hit(맞음) · st-ko(탈락) · st-win(승리)
 * 사용법: Chars.svg('sniper') → SVG 문자열,  Chars.play(svg요소, 'attack')
 */
(function () {
  'use strict';

  const CSS = `
  .ch { overflow: visible; }
  .ch .o { stroke: #151827; stroke-width: 3; stroke-linejoin: round; stroke-linecap: round; }
  .ch .thin { stroke: #151827; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
  .ch .pc { fill: var(--pc, #ff5a5f); }
  .ch .pc-d { fill: color-mix(in srgb, var(--pc, #ff5a5f) 70%, #000); }
  .ch .pc-s { stroke: var(--pc, #ff5a5f); }
  .ch g { transform-box: fill-box; }
  .ch .rig { transform-origin: 50% 100%; }
  .ch .shadow { transform-origin: center; transform-box: fill-box; }
  .ch .face-hurt, .ch .face-ko { display: none; }
  .ch.st-hit .face-normal, .ch.st-ko .face-normal { display: none; }
  .ch.st-hit .face-hurt { display: inline; }
  .ch.st-ko .face-ko { display: inline; }
  .ch .flash, .ch .proj { opacity: 0; }

  /* 공통: 가만히 들썩 · 맞음 번쩍 · 탈락 쓰러짐 · 승리 점프 */
  .ch.st-idle .rig { animation: ch-bob 1.8s ease-in-out infinite; }
  .ch.st-idle .shadow { animation: ch-shadowBob 1.8s ease-in-out infinite; }
  @keyframes ch-bob { 0%, 100% { transform: translateY(0) scaleY(1); } 50% { transform: translateY(-3px) scaleY(1.015); } }
  @keyframes ch-shadowBob { 0%, 100% { transform: scale(1); } 50% { transform: scale(.92); } }
  .ch.st-hit .rig { animation: ch-hit .6s ease-out; }
  @keyframes ch-hit { 0% { transform: translateX(0); filter: brightness(1); } 12% { transform: translateX(-12px) rotate(-6deg); filter: brightness(3.2); }
    30% { filter: brightness(1); } 45% { filter: brightness(2.4); } 60% { transform: translateX(-4px) rotate(-2deg); filter: brightness(1); } 100% { transform: translateX(0); } }
  .ch.st-ko .rig { animation: ch-ko .9s ease-in forwards; transform-origin: 50% 95%; }
  .ch.st-ko .shadow { animation: ch-koShadow .9s forwards; }
  @keyframes ch-ko { 0% { transform: translate(0, 0) rotate(0); } 30% { transform: translate(0, -16px) rotate(-20deg); } 100% { transform: translate(14px, -21px) rotate(-86deg); opacity: .6; } }
  @keyframes ch-koShadow { to { transform: scale(1.25, .8); opacity: .5; } }
  .ch.st-win .rig { animation: ch-win 1.1s ease-in-out; }
  @keyframes ch-win { 0%, 50%, 100% { transform: translateY(0) scale(1, 1); } 10%, 60% { transform: translateY(2px) scale(1.06, .92); }
    28%, 78% { transform: translateY(-26px) scale(.96, 1.05); } }

  /* 공통 부품 동작 */
  @keyframes ch-flash { 0% { opacity: 0; transform: scale(.3); } 15% { opacity: 1; transform: scale(1.3); } 100% { opacity: 0; transform: scale(.8); } }
  @keyframes ch-flap { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(12deg); } }
  @keyframes ch-recoil { 0% { transform: translateX(0); } 12% { transform: translateX(-9px) rotate(-7deg); } 100% { transform: translateX(0); } }
  @keyframes ch-lean { 12% { transform: rotate(-4deg); } 100% { transform: rotate(0); } }
  @keyframes ch-raise { 20%, 80% { transform: rotate(-55deg) translate(-4px, -6px); } }
  @keyframes ch-sway { 0%, 100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
  @keyframes ch-glint { 0%, 70%, 100% { filter: none; } 80% { filter: brightness(1.6) drop-shadow(0 0 3px #fff6b0); } }
  @keyframes ch-dash { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 45%, 60% { transform: translateX(18px); } }
  @keyframes ch-blink { 0%, 100% { opacity: .25; } 50% { opacity: 1; } }

  /* 🎯 저격 */
  .k-sniper.st-idle .hat { animation: ch-hatTip 3.6s ease-in-out infinite; transform-origin: 50% 100%; }
  @keyframes ch-hatTip { 0%, 80%, 100% { transform: rotate(0); } 86% { transform: rotate(-6deg) translateY(-2px); } 92% { transform: rotate(2deg); } }
  .k-sniper.st-idle .scarf-tail { animation: ch-flap 1.4s ease-in-out infinite; transform-origin: 0% 0%; }
  .k-sniper.st-attack .gun { animation: ch-recoil .55s ease-out; transform-origin: 30% 50%; }
  .k-sniper.st-attack .rig { animation: ch-lean .55s ease-out; }
  .k-sniper.st-attack .flash { animation: ch-flash .35s ease-out; transform-origin: 0% 50%; }
  .k-sniper.st-win .gun { animation: ch-raise 1.1s ease-in-out; transform-origin: 20% 50%; }

  /* 💥 산탄 */
  .k-shotgun.st-idle .flaps { animation: ch-flap 1.6s ease-in-out infinite; transform-origin: 50% 0%; }
  .k-shotgun.st-attack .gun { animation: ch-bigRecoil .7s ease-out; transform-origin: 20% 50%; }
  .k-shotgun.st-attack .rig { animation: ch-lean .7s ease-out; }
  .k-shotgun.st-attack .flash { animation: ch-flash .4s ease-out; transform-origin: 0% 50%; }
  @keyframes ch-bigRecoil { 0% { transform: translateX(0); } 10% { transform: translateX(-12px) rotate(-14deg); } 40% { transform: translateX(-3px) rotate(-3deg); } 100% { transform: translateX(0); } }
  .k-shotgun.st-win .gun { animation: ch-raise 1.1s ease-in-out; transform-origin: 20% 50%; }

  /* 🌀 도탄 */
  .k-ricochet.st-idle .sling { animation: ch-sway 1.4s ease-in-out infinite; transform-origin: 50% 100%; }
  .k-ricochet.st-attack .sling { animation: ch-pull 1.1s ease-in-out; transform-origin: 50% 100%; }
  @keyframes ch-pull { 0%, 100% { transform: rotate(0); } 20% { transform: rotate(-14deg) translateX(-4px); } 26% { transform: rotate(8deg); } 40% { transform: rotate(0); } }
  .k-ricochet.st-attack .proj { animation: ch-zigzag 1.1s linear; }
  @keyframes ch-zigzag { 0%, 24% { opacity: 0; transform: translate(0, 0); } 25% { opacity: 1; }
    45% { transform: translate(30px, -26px); } 65% { transform: translate(52px, 4px); } 88% { opacity: 1; transform: translate(74px, -20px); } 90%, 100% { opacity: 0; transform: translate(78px, -22px); } }
  .k-ricochet.st-win .sling { animation: ch-raise 1.1s ease-in-out; transform-origin: 50% 100%; }

  /* ✖️ 비숍 */
  .k-bishop.st-idle .mitre { animation: ch-sway 3s ease-in-out infinite; transform-origin: 50% 100%; }
  .k-bishop.st-idle .staff { animation: ch-sway 2.4s ease-in-out infinite; transform-origin: 50% 100%; }
  .k-bishop.st-attack .staff { animation: ch-staffSwing .9s ease-in-out; transform-origin: 50% 100%; }
  @keyframes ch-staffSwing { 0%, 100% { transform: rotate(0); } 25% { transform: rotate(-12deg); } 50%, 70% { transform: rotate(28deg); } }
  .k-bishop.st-attack .flash { animation: ch-flash .6s ease-out .35s; transform-origin: 50% 50%; }
  .k-bishop.st-win .staff { animation: ch-staffSwing 1.1s ease-in-out; transform-origin: 50% 100%; }

  /* ➕ 룩 */
  .k-rook.st-attack .rig { animation: ch-dash .8s ease-in-out; }
  .k-rook.st-attack .shield { animation: ch-bash .8s ease-in-out; transform-origin: 50% 50%; }
  @keyframes ch-bash { 0%, 100% { transform: translateX(0); } 45%, 60% { transform: translateX(10px) scale(1.12); } }
  .k-rook.st-attack .flash { animation: ch-flash .5s ease-out .3s; transform-origin: 50% 50%; }
  .k-rook.st-win .shield { animation: ch-shieldUp 1.1s ease-in-out; transform-origin: 50% 50%; }
  @keyframes ch-shieldUp { 20%, 80% { transform: translate(4px, -22px) rotate(-8deg); } }

  /* 🐴 나이트 */
  .k-knight.st-idle .plume { animation: ch-flap 1.3s ease-in-out infinite; transform-origin: 20% 100%; }
  .k-knight.st-attack .rig { animation: ch-leapL 1s ease-in-out; }
  @keyframes ch-leapL { 0%, 100% { transform: translate(0, 0); } 10% { transform: translate(0, 3px) scale(1.05, .92); } 35% { transform: translate(0, -30px); }
    60% { transform: translate(20px, -30px); } 78% { transform: translate(20px, 0); } 88% { transform: translate(20px, 0); } }
  .k-knight.st-attack .sword { animation: ch-slash 1s ease-in-out; transform-origin: 50% 100%; }
  @keyframes ch-slash { 0%, 55%, 100% { transform: rotate(0); } 62% { transform: rotate(-30deg); } 78%, 88% { transform: rotate(80deg); } }
  .k-knight.st-attack .flash { animation: ch-flash .4s ease-out .72s; transform-origin: 0% 0%; }
  .k-knight.st-win .sword { animation: ch-raise 1.1s ease-in-out; transform-origin: 50% 100%; }

  /* 👑 킹 */
  .k-king.st-idle .crown { animation: ch-glint 2.6s ease-in-out infinite; }
  .k-king.st-attack .sceptre { animation: ch-slam .9s ease-in; transform-origin: 50% 100%; }
  @keyframes ch-slam { 0%, 100% { transform: rotate(0); } 35% { transform: rotate(-60deg) translateY(-6px); } 50%, 70% { transform: rotate(35deg); } }
  .k-king.st-attack .rig { animation: ch-stomp .9s ease-in; }
  @keyframes ch-stomp { 0%, 100% { transform: translateX(0) scale(1, 1); } 25% { transform: translateX(22px) rotate(6deg); } 40% { transform: translate(22px, -10px) scale(.97, 1.04); }
    55% { transform: translate(22px, 0) scale(1.1, .88); } 75% { transform: translateX(16px) scale(1, 1); } }
  .k-king.st-attack .flash { animation: ch-ring .6s ease-out .42s; transform-origin: 50% 50%; }
  @keyframes ch-ring { 0% { opacity: 1; transform: scale(.3); } 100% { opacity: 0; transform: scale(1.3); } }
  .k-king.st-win .sceptre { animation: ch-raise 1.1s ease-in-out; transform-origin: 50% 100%; }

  /* 💣 박격포 */
  .k-mortar.st-idle .goggles { animation: ch-glint 3s ease-in-out infinite; }
  .k-mortar.st-attack .tube { animation: ch-thump .8s ease-out; transform-origin: 50% 100%; }
  @keyframes ch-thump { 0%, 100% { transform: translateY(0); } 15% { transform: translateY(4px) scale(1.04, .94); } 40% { transform: translateY(0); } }
  .k-mortar.st-attack .proj { animation: ch-lob .9s ease-out; }
  @keyframes ch-lob { 0%, 10% { opacity: 0; transform: translate(0, 0); } 12% { opacity: 1; } 80% { opacity: 1; transform: translate(26px, -96px) rotate(30deg); } 100% { opacity: 0; transform: translate(30px, -110px) rotate(40deg); } }
  .k-mortar.st-attack .flash { animation: ch-puff .8s ease-out .08s; transform-origin: 50% 50%; }
  @keyframes ch-puff { 0% { opacity: 0; transform: scale(.4); } 20% { opacity: .95; transform: scale(1); } 100% { opacity: 0; transform: scale(1.6) translateY(-8px); } }
  .k-mortar.st-win .helm { animation: ch-hatHop 1.1s ease-in-out; transform-origin: 50% 100%; }
  @keyframes ch-hatHop { 28%, 78% { transform: translateY(-10px) rotate(-8deg); } }

  /* 🎲 난사 */
  .k-scatter.st-idle .hat { animation: ch-hatTip 3.2s ease-in-out infinite; transform-origin: 50% 100%; }
  .k-scatter.st-attack .gun { animation: ch-jitter .12s linear 7; transform-origin: 30% 50%; }
  @keyframes ch-jitter { 0%, 100% { transform: translate(0, 0) rotate(0); } 25% { transform: translate(-3px, 1px) rotate(-5deg); } 75% { transform: translate(-1px, -1px) rotate(4deg); } }
  .k-scatter.st-attack .f1 { animation: ch-flash .16s ease-out 5; transform-origin: 0% 50%; }
  .k-scatter.st-attack .f2 { animation: ch-flash .16s ease-out .08s 5; transform-origin: 0% 50%; }
  .k-scatter.st-attack .f3 { animation: ch-flash .16s ease-out .04s 5; transform-origin: 0% 50%; }
  .k-scatter.st-win .gun { animation: ch-raise 1.1s ease-in-out; transform-origin: 20% 50%; }

  /* 👸 퀸 */
  .k-queen.st-idle .wand { animation: ch-sway 2s ease-in-out infinite; transform-origin: 50% 100%; }
  .k-queen.st-idle .star { animation: ch-glint 1.6s ease-in-out infinite; }
  .k-queen.st-idle .hair-back { animation: ch-hairSway 2.6s ease-in-out infinite; transform-origin: 50% 0%; }
  @keyframes ch-hairSway { 0%, 100% { transform: skewX(0); } 50% { transform: skewX(-3deg); } }
  .k-queen.st-attack .wand { animation: ch-wandUp .9s ease-in-out; transform-origin: 50% 100%; }
  @keyframes ch-wandUp { 0%, 100% { transform: rotate(0); } 30%, 70% { transform: rotate(20deg) translateY(-6px); } }
  .k-queen.st-attack .flash { animation: ch-burst .7s ease-out .25s; transform-origin: 50% 50%; }
  @keyframes ch-burst { 0% { opacity: 0; transform: scale(.2) rotate(0); } 25% { opacity: 1; } 100% { opacity: 0; transform: scale(1.5) rotate(45deg); } }
  .k-queen.st-win .flash { animation: ch-burst 1s ease-out .2s; transform-origin: 50% 50%; }

  /* 🔦 레이저 */
  .k-laser.st-idle .light { animation: ch-blink 1.2s ease-in-out infinite; }
  .k-laser.st-attack .gun { animation: ch-recoil .9s ease-out .35s; transform-origin: 30% 50%; }
  .k-laser.st-attack .charge { animation: ch-charge .45s ease-in; transform-origin: 50% 50%; }
  @keyframes ch-charge { 0% { opacity: 0; transform: scale(.2); } 90% { opacity: 1; transform: scale(1.2); } 100% { opacity: 0; transform: scale(.4); } }
  .k-laser.st-attack .beam { animation: ch-beam .6s ease-out .4s; transform-origin: 0% 50%; }
  @keyframes ch-beam { 0% { opacity: 1; transform: scaleX(0); } 30% { opacity: 1; transform: scaleX(1); } 100% { opacity: 0; transform: scaleX(1) scaleY(.2); } }
  .k-laser.st-win .gun { animation: ch-raise 1.1s ease-in-out; transform-origin: 20% 50%; }

  /* 🔱 창 */
  .k-spear.st-idle .crest { animation: ch-flap 1.5s ease-in-out infinite; transform-origin: 50% 100%; }
  .k-spear.st-attack .spear { animation: ch-thrust .7s ease-in-out; }
  @keyframes ch-thrust { 0%, 100% { transform: translateX(0); } 30% { transform: translateX(-12px); } 45%, 65% { transform: translateX(26px); } }
  .k-spear.st-attack .rig { animation: ch-lunge .7s ease-in-out; }
  @keyframes ch-lunge { 0%, 100% { transform: translateX(0); } 30% { transform: translateX(-4px) rotate(-3deg); } 45%, 65% { transform: translateX(8px) rotate(4deg); } }
  .k-spear.st-attack .flash { animation: ch-flash .35s ease-out .32s; transform-origin: 50% 50%; }
  .k-spear.st-win .spear { animation: ch-spearUp 1.1s ease-in-out; transform-origin: 40% 50%; }
  @keyframes ch-spearUp { 20%, 80% { transform: rotate(-60deg); } }

  /* 🌩️ 체인 번개 */
  .k-chain.st-idle .spark { animation: ch-blink .5s steps(2) infinite; }
  .k-chain.st-idle .hair { animation: ch-frizz 1.2s ease-in-out infinite; transform-origin: 50% 100%; }
  @keyframes ch-frizz { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04, 1.06); } }
  .k-chain.st-attack .rod { animation: ch-wandUp .9s ease-in-out; transform-origin: 50% 100%; }
  .k-chain.st-attack .bolt { animation: ch-zap .5s steps(3) .2s; }
  .k-chain.st-attack .bolt2 { animation: ch-zap .5s steps(3) .45s; }
  @keyframes ch-zap { 0% { opacity: 1; } 33% { opacity: .2; } 66% { opacity: 1; } 100% { opacity: 0; } }
  .k-chain.st-attack .hair { animation: ch-frizz .15s linear 6; transform-origin: 50% 100%; }
  .k-chain.st-win .rod { animation: ch-raise 1.1s ease-in-out; transform-origin: 50% 100%; }

  /* 🌪️ 회오리 */
  .k-whirl.st-idle .tails { animation: ch-flap 1.1s ease-in-out infinite; transform-origin: 100% 0%; }
  .k-whirl.st-attack .rig { animation: ch-spin .9s ease-in-out; }
  @keyframes ch-spin { 0%, 100% { transform: scaleX(1); } 12% { transform: translateY(-8px) scaleX(-1); } 25% { transform: translateY(-10px) scaleX(1); }
    37% { transform: translateY(-10px) scaleX(-1); } 50% { transform: translateY(-8px) scaleX(1); } 62% { transform: translateY(-6px) scaleX(-1); } 75% { transform: translateY(0) scaleX(1); } }
  .k-whirl.st-attack .flash { animation: ch-swirl .9s linear; }
  @keyframes ch-swirl { 0% { opacity: 0; stroke-dashoffset: 0; } 15%, 75% { opacity: 1; } 100% { opacity: 0; stroke-dashoffset: -176; } }
  .k-whirl.st-attack .flash ellipse { animation: ch-swirl .9s linear; }
  .k-whirl.st-win .sword { animation: ch-raise 1.1s ease-in-out; transform-origin: 20% 80%; }

  /* 🪃 부메랑 */
  .k-boomerang.st-idle .held { animation: ch-twirl 1.6s ease-in-out infinite; transform-origin: 20% 80%; }
  @keyframes ch-twirl { 0%, 100% { transform: rotate(-10deg); } 50% { transform: rotate(14deg); } }
  .k-boomerang.st-idle .tails { animation: ch-flap 1.1s ease-in-out infinite; transform-origin: 100% 0%; }
  .k-boomerang.st-attack .arm-throw { animation: ch-throw 1.3s ease-in-out; transform-origin: 15% 15%; }
  .k-boomerang.st-attack .held { animation: ch-hideHeld 1.3s linear; }
  .k-boomerang.st-attack .proj { animation: ch-fly 1.3s ease-in-out; transform-origin: 50% 50%; }
  @keyframes ch-throw { 0%, 100% { transform: rotate(0); } 12% { transform: rotate(-70deg); } 24% { transform: rotate(40deg); } 88% { transform: rotate(40deg); } }
  @keyframes ch-hideHeld { 0%, 20% { opacity: 1; } 21%, 86% { opacity: 0; } 87%, 100% { opacity: 1; } }
  @keyframes ch-fly { 0%, 20% { opacity: 0; transform: translate(0, 0) rotate(0); } 21% { opacity: 1; }
    52% { transform: translate(64px, -46px) rotate(720deg); } 86% { opacity: 1; transform: translate(0, 0) rotate(1440deg); } 87%, 100% { opacity: 0; } }
  .k-boomerang.st-win .arm-throw { animation: ch-raiseB 1.1s ease-in-out; transform-origin: 15% 15%; }
  @keyframes ch-raiseB { 20%, 80% { transform: rotate(-120deg); } }

  /* 🪝 갈고리 */
  .k-grapple.st-idle .tails { animation: ch-flap 1.2s ease-in-out infinite; transform-origin: 100% 0%; }
  .k-grapple.st-attack .proj { animation: ch-hookOut 1.2s ease-in-out; }
  @keyframes ch-hookOut { 0%, 8% { opacity: 0; transform: translateX(0); } 10% { opacity: 1; } 40%, 52% { transform: translateX(56px) rotate(90deg); } 85% { opacity: 1; transform: translateX(0) rotate(0); } 88%, 100% { opacity: 0; } }
  .k-grapple.st-attack .rope { animation: ch-ropeOut 1.2s ease-in-out; transform-origin: 0% 50%; }
  @keyframes ch-ropeOut { 0%, 8% { opacity: 0; transform: scaleX(0); } 10% { opacity: 1; } 40%, 52% { transform: scaleX(1); } 85% { opacity: 1; transform: scaleX(0); } 88%, 100% { opacity: 0; } }
  .k-grapple.st-attack .rig { animation: ch-yank 1.2s ease-in-out; }
  @keyframes ch-yank { 0%, 45%, 100% { transform: rotate(0); } 58% { transform: rotate(-8deg) translateX(-4px); } 75% { transform: rotate(0); } }
  .k-grapple.st-win .hook { animation: ch-raise 1.1s ease-in-out; transform-origin: 50% 0%; }

  /* 🌊 충격파 */
  .k-shockwave.st-idle .fist-l { animation: ch-guard 1s ease-in-out infinite; }
  .k-shockwave.st-idle .fist-r { animation: ch-guard 1s ease-in-out .5s infinite; }
  @keyframes ch-guard { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
  .k-shockwave.st-attack .fist-r { animation: ch-punch .7s ease-out; }
  @keyframes ch-punch { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 35%, 60% { transform: translateX(20px) scale(1.2); } }
  .k-shockwave.st-attack .rig { animation: ch-lunge .7s ease-in-out; }
  .k-shockwave.st-attack .wave { animation: ch-waveOut .6s ease-out .22s; transform-origin: 0% 50%; }
  @keyframes ch-waveOut { 0% { opacity: 1; transform: translateX(0) scale(.5, .6); } 100% { opacity: 0; transform: translateX(26px) scale(1.2, 1.2); } }
  .k-shockwave.st-win .fist-r { animation: ch-uppercut 1.1s ease-in-out; }
  @keyframes ch-uppercut { 20%, 80% { transform: translate(4px, -34px); } }

  /* 💫 유도탄 */
  .k-homing.st-idle .orb { animation: ch-glint 1.4s ease-in-out infinite; }
  .k-homing.st-idle .hat-tip { animation: ch-flap 2s ease-in-out infinite; transform-origin: 0% 100%; }
  .k-homing.st-attack .staff { animation: ch-wandUp 1s ease-in-out; transform-origin: 50% 100%; }
  .k-homing.st-attack .o1 { animation: ch-seek1 1.1s ease-in-out .15s; }
  .k-homing.st-attack .o2 { animation: ch-seek2 1.1s ease-in-out .3s; }
  @keyframes ch-seek1 { 0% { opacity: 0; transform: translate(0, 0); } 10% { opacity: 1; } 45% { transform: translate(18px, -42px); } 80% { opacity: 1; transform: translate(52px, -12px); } 100% { opacity: 0; transform: translate(62px, 8px); } }
  @keyframes ch-seek2 { 0% { opacity: 0; transform: translate(0, 0); } 10% { opacity: 1; } 45% { transform: translate(34px, 26px); } 80% { opacity: 1; transform: translate(60px, 0); } 100% { opacity: 0; transform: translate(66px, -14px); } }
  .k-homing.st-win .staff { animation: ch-raise 1.1s ease-in-out; transform-origin: 50% 100%; }

  /* 🧛 흡혈 */
  .k-vampire.st-idle .cape { animation: ch-cape 2.2s ease-in-out infinite; transform-origin: 50% 0%; }
  @keyframes ch-cape { 0%, 100% { transform: skewX(0) scaleX(1); } 50% { transform: skewX(-4deg) scaleX(1.04); } }
  .k-vampire.st-idle .eyes-red { animation: ch-glow 2.2s ease-in-out infinite; }
  @keyframes ch-glow { 0%, 100% { filter: none; } 50% { filter: drop-shadow(0 0 3px #ff2a4a); } }
  .k-vampire.st-attack .rig { animation: ch-vlunge .7s ease-in-out; }
  .k-vampire.st-attack .cape { animation: ch-spread .7s ease-in-out; transform-origin: 50% 0%; }
  .k-vampire.st-attack .bite { animation: ch-flash .5s ease-out .18s; transform-origin: 50% 50%; }
  @keyframes ch-vlunge { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-6px) scale(.96); } 45% { transform: translateX(22px) rotate(8deg); } 70% { transform: translateX(4px); } }
  @keyframes ch-spread { 0%, 100% { transform: scaleX(1); } 45% { transform: scaleX(1.6) scaleY(1.08); } }
  .k-vampire.st-win .cape { animation: ch-spread 1.1s ease-in-out; transform-origin: 50% 0%; }

  /* 🗡️ 암살 */
  .k-assassin.st-idle .tail { animation: ch-flap 1.2s ease-in-out infinite; transform-origin: 100% 0%; }
  .k-assassin.st-idle .blade { animation: ch-sway 2.2s ease-in-out infinite; transform-origin: 0% 50%; }
  .k-assassin.st-attack .rig { animation: ch-vanish 1s ease-in-out; }
  @keyframes ch-vanish { 0%, 100% { opacity: 1; transform: translateX(0); } 15% { opacity: 1; transform: translateX(-4px) scale(.95); } 25%, 38% { opacity: 0; transform: translateX(0) scale(.6); }
    48% { opacity: 1; transform: translateX(22px) scale(1.05); } 70% { opacity: 1; transform: translateX(18px); } }
  .k-assassin.st-attack .smoke { animation: ch-puff .6s ease-out; transform-origin: 50% 50%; }
  .k-assassin.st-attack .slash { animation: ch-flash .4s ease-out .48s; transform-origin: 0% 50%; }
  .k-assassin.st-win .blade { animation: ch-raise 1.1s ease-in-out; transform-origin: 0% 50%; }

  /* ☠️ 독 */
  .k-poison.st-idle .bubbles { animation: ch-blink 1s ease-in-out infinite; }
  .k-poison.st-idle .flask { animation: ch-sway 2.4s ease-in-out infinite; transform-origin: 50% 100%; }
  .k-poison.st-attack .flask { animation: ch-lobArm 1.1s ease-in-out; transform-origin: 30% 100%; }
  @keyframes ch-lobArm { 0%, 100% { transform: rotate(0); opacity: 1; } 20% { transform: rotate(-50deg); } 32% { transform: rotate(30deg); opacity: 1; } 34%, 88% { opacity: 0; } }
  .k-poison.st-attack .proj { animation: ch-potion 1.1s ease-out; }
  @keyframes ch-potion { 0%, 30% { opacity: 0; transform: translate(0, 0) rotate(0); } 32% { opacity: 1; } 70% { opacity: 1; transform: translate(40px, -40px) rotate(300deg); }
    82% { opacity: 1; transform: translate(62px, 0) rotate(420deg); } 84%, 100% { opacity: 0; transform: translate(62px, 0); } }
  .k-poison.st-attack .splash { animation: ch-puff .5s ease-out .84s; transform-origin: 50% 50%; }
  .k-poison.st-win .flask { animation: ch-raise 1.1s ease-in-out; transform-origin: 30% 100%; }

  /* 🏹 궁수 */
  .k-archer.st-idle .ears { animation: ch-earTwitch 3s ease-in-out infinite; }
  @keyframes ch-earTwitch { 0%, 85%, 100% { transform: rotate(0); } 90% { transform: rotate(-6deg); } 95% { transform: rotate(3deg); } }
  .k-archer.st-attack .nock { animation: ch-draw .9s ease-in-out; }
  @keyframes ch-draw { 0%, 100% { transform: translateX(0); opacity: 1; } 35%, 45% { transform: translateX(-9px); opacity: 1; } 47%, 90% { opacity: 0; } }
  .k-archer.st-attack .bow { animation: ch-bowFlex .9s ease-in-out; transform-origin: 0% 50%; }
  @keyframes ch-bowFlex { 0%, 100% { transform: scaleX(1); } 35%, 45% { transform: scaleX(1.25); } 50% { transform: scaleX(.9); } 60% { transform: scaleX(1); } }
  .k-archer.st-attack .proj { animation: ch-arrowFly .9s linear; }
  @keyframes ch-arrowFly { 0%, 46% { opacity: 0; transform: translateX(0); } 47% { opacity: 1; } 80% { opacity: 1; transform: translateX(70px); } 82%, 100% { opacity: 0; transform: translateX(76px); } }
  .k-archer.st-attack .twang { animation: ch-flash .3s ease-out .42s; transform-origin: 50% 50%; }
  .k-archer.st-win .bow { animation: ch-raise 1.1s ease-in-out; transform-origin: 50% 50%; }

  /* 🧨 폭탄 */
  .k-bomber.st-idle .spark, .k-bomber.st-attack .spark { animation: ch-blink .25s steps(2) infinite; }
  .k-bomber.st-idle .held { animation: ch-toss 1.6s ease-in-out infinite; }
  @keyframes ch-toss { 0%, 60%, 100% { transform: translateY(0); } 75% { transform: translateY(-10px) rotate(-20deg); } }
  .k-bomber.st-attack .arm-throw { animation: ch-throw 1.2s ease-in-out; transform-origin: 15% 15%; }
  .k-bomber.st-attack .held { animation: ch-hideHeld 1.2s linear; }
  .k-bomber.st-attack .proj { animation: ch-bombArc 1.2s ease-in-out; }
  @keyframes ch-bombArc { 0%, 20% { opacity: 0; transform: translate(0, 0) rotate(0); } 21% { opacity: 1; } 45% { transform: translate(30px, -34px) rotate(200deg); }
    68% { opacity: 1; transform: translate(58px, 6px) rotate(400deg); } 70%, 100% { opacity: 0; transform: translate(58px, 6px); } }
  .k-bomber.st-attack .boom { animation: ch-puff .6s ease-out .68s; transform-origin: 50% 50%; }
  .k-bomber.st-hit .soot, .k-bomber.st-ko .soot { opacity: 1; }
  .k-bomber.st-win .arm-throw { animation: ch-raiseB 1.1s ease-in-out; transform-origin: 15% 15%; }

  @media (prefers-reduced-motion: reduce) { .ch.st-idle .rig, .ch.st-idle .shadow, .ch.st-idle g { animation: none !important; } }
  `;

  // ───────── 공통 부위 ─────────
  const OUT = 'class="o"';
  const shadow = `<ellipse class="shadow" cx="60" cy="133" rx="27" ry="6" fill="rgba(0,0,0,.35)"/>`;
  const legs = pants => `<rect ${OUT} x="45" y="110" width="13" height="18" rx="5" fill="${pants}"/><rect ${OUT} x="62" y="110" width="13" height="18" rx="5" fill="${pants}"/>`;
  const torso = fill => `<rect ${OUT} x="40" y="80" width="40" height="36" rx="14" fill="${fill}"/>`;
  const robe = fill => `<path ${OUT} d="M40 84 Q40 80 50 80 L70 80 Q80 80 80 84 L86 124 Q86 128 82 128 L38 128 Q34 128 34 124 Z" fill="${fill}"/>`;
  const head = skin => `<circle ${OUT} cx="60" cy="58" r="27" fill="${skin}"/>`;
  const hand = (x, y, fill) => `<circle ${OUT} cx="${x}" cy="${y}" r="5.5" fill="${fill}"/>`;
  const brows = (col = '#151827') => `<path d="M45 52 L54 54.5 M75 52 L66 54.5" stroke="${col}" stroke-width="2.6" stroke-linecap="round"/>`;
  const smile = `<path d="M56 71 Q60 74 64 71" fill="none" stroke="#151827" stroke-width="2.2" stroke-linecap="round"/>`;
  const grin = `<path d="M55 70 Q60 77 66 70 Z" fill="#fff" stroke="#151827" stroke-width="2.2" stroke-linejoin="round"/>`;
  const faces = (eye = '#151827', extra = '') => `
  <g class="face-normal">
    <ellipse cx="50" cy="60" rx="3.4" ry="4.4" fill="${eye}"/><ellipse cx="70" cy="60" rx="3.4" ry="4.4" fill="${eye}"/>
    <circle cx="51.2" cy="58.4" r="1.2" fill="#fff"/><circle cx="71.2" cy="58.4" r="1.2" fill="#fff"/>
    ${extra}
  </g>
  <g class="face-hurt" fill="none" stroke="#151827" stroke-width="2.6" stroke-linecap="round">
    <path d="M46 56 L53 60 L46 64"/><path d="M74 56 L67 60 L74 64"/><path d="M54 72 Q60 68 66 72"/>
  </g>
  <g class="face-ko" fill="none" stroke="#151827" stroke-width="2.6" stroke-linecap="round">
    <path d="M46 56 L54 64 M54 56 L46 64"/><path d="M66 56 L74 64 M74 56 L66 64"/><path d="M55 72 Q60 70 65 72"/>
  </g>`;
  const blush = `<ellipse cx="44" cy="68" rx="4.5" ry="2.6" fill="#ff8fa3" opacity=".45"/><ellipse cx="76" cy="68" rx="4.5" ry="2.6" fill="#ff8fa3" opacity=".45"/>`;
  const wrap = (key, body) => `<svg class="ch k-${key} st-idle" viewBox="-10 0 140 140" aria-hidden="true">${shadow}<g class="rig">${body}</g></svg>`;

  const SKIN = { a: '#ffd9b8', b: '#f2c79b', c: '#e8b48a', d: '#c98e62', e: '#8d5a3b', f: '#ffe0c7' };

  const DRAW = {
    // 🎯 저격: 챙 넓은 모자 + 스카프 + 긴 저격총
    sniper: () => wrap('sniper', `
      ${legs('#3b3f55')}
      ${torso('#6b7f3a')}
      <path d="M52 82 L60 100 L68 82" fill="#566a2c" class="thin"/>
      <g class="scarf"><path class="o pc" d="M42 80 Q60 90 78 80 L78 88 Q60 97 42 88 Z"/>
        <g class="scarf-tail"><path class="o pc" d="M44 86 L36 104 L44 102 L48 90 Z"/></g></g>
      ${head(SKIN.a)}
      ${blush}
      ${faces('#151827', smile)}
      <g class="hat">
        <path ${OUT} d="M40 40 L45 18 Q60 12 75 18 L80 40 Z" fill="#8a5a2b"/>
        <path class="o pc" d="M42.5 25 L77.5 25 L79 33 L41 33 Z"/>
        <ellipse ${OUT} cx="60" cy="40" rx="42" ry="8.5" fill="#9b6834"/>
        <path d="M26 40 Q60 47 94 40" fill="none" stroke="#6e4520" stroke-width="2"/>
      </g>
      <g class="gun">
        <path ${OUT} d="M34 92 L60 88 L64 100 L40 104 Q32 100 34 92 Z" fill="#8a5a2b"/>
        <rect ${OUT} x="58" y="88" width="62" height="6" rx="2" fill="#2e3242"/>
        <rect ${OUT} x="66" y="80" width="22" height="7" rx="3" fill="#3b4058"/>
        <circle cx="88" cy="83.5" r="2.4" fill="#7fd1ff"/>
        ${hand(64, 98, SKIN.a)}
        <g class="flash"><path d="M122 91 L134 84 L130 91 L138 93 L130 95 L134 102 Z" fill="#ffe14d" stroke="#ff9f43" stroke-width="1.5"/></g>
      </g>`),

    // 💥 산탄: 귀덮개 사냥 모자 + 덥수룩한 수염 + 체크무늬 셔츠 + 쌍발 산탄총
    shotgun: () => wrap('shotgun', `
      ${legs('#4b3a2a')}
      ${torso('#3f6b4a')}
      <path d="M49 82 L49 115 M60 81 L60 116 M71 82 L71 115 M41 93 L79 93 M41 105 L79 105" stroke="#2c4d35" stroke-width="2.5"/>
      ${head(SKIN.b)}
      <path ${OUT} d="M35 63 Q35 91 60 91 Q85 91 85 63 Q78 71 70 69 Q60 76 50 69 Q42 71 35 63 Z" fill="#7a4a26"/>
      ${faces('#151827', `<path d="M55 76 Q60 79 65 76" fill="none" stroke="#3a220f" stroke-width="2.2" stroke-linecap="round"/>`)}
      <g class="hat">
        <g class="flaps"><rect class="o pc" x="29" y="46" width="12" height="25" rx="6"/><rect class="o pc" x="79" y="46" width="12" height="25" rx="6"/></g>
        <path class="o pc" d="M32 52 Q32 23 60 23 Q88 23 88 52 Z"/>
        <rect ${OUT} x="31" y="43" width="58" height="10" rx="5" fill="#efe4cf"/>
      </g>
      <g class="gun">
        <path ${OUT} d="M28 96 L52 91 L54 102 L33 107 Q26 103 28 96 Z" fill="#7a4f2a"/>
        <rect ${OUT} x="50" y="89" width="46" height="5.5" rx="2" fill="#3a3e4f"/>
        <rect ${OUT} x="50" y="94.5" width="46" height="5.5" rx="2" fill="#2c303e"/>
        ${hand(56, 100, SKIN.b)}${hand(82, 99, SKIN.b)}
        <g class="flash"><path d="M97 94 L118 83 M97 94 L121 94 M97 94 L118 105" stroke="#ffe14d" stroke-width="3.5" stroke-linecap="round"/><circle cx="99" cy="94" r="6" fill="#fff3a0"/></g>
      </g>`),

    // 🌀 도탄: 거꾸로 쓴 야구모자 + 줄무늬 티 + 새총
    ricochet: () => wrap('ricochet', `
      ${legs('#3a4a6b')}
      ${torso('#f4f1ea')}
      <path d="M41 90 L79 90 M41 100 L79 100 M42 110 L78 110" stroke="#34507a" stroke-width="3.5"/>
      ${hand(42, 102, SKIN.a)}
      ${head(SKIN.a)}
      ${blush}
      <g fill="#c98b3c" opacity=".7"><circle cx="45" cy="66" r="1"/><circle cx="48" cy="68" r="1"/><circle cx="72" cy="68" r="1"/><circle cx="75" cy="66" r="1"/></g>
      ${faces('#151827', grin)}
      <g class="cap">
        <path class="o pc-d" d="M37 46 Q24 43 15 49 Q21 55 37 52 Z"/>
        <path class="o pc" d="M33 50 Q33 26 60 26 Q87 26 87 50 Q60 42 33 50 Z"/>
        <circle class="o pc-d" cx="60" cy="27" r="3"/>
        <path d="M60 30 L60 44 M46 33 Q44 40 44 46 M74 33 Q76 40 76 46" stroke="#151827" stroke-width="1.5" opacity=".35" fill="none"/>
      </g>
      <g class="sling">
        <path d="M84 104 L84 90 M84 90 L77 77 M84 90 L91 77" stroke="#151827" stroke-width="8" stroke-linecap="round" fill="none"/>
        <path d="M84 104 L84 90 M84 90 L77 77 M84 90 L91 77" stroke="#8a5a2b" stroke-width="4" stroke-linecap="round" fill="none"/>
        <path d="M77 77 Q80 86 84 86 Q88 86 91 77" stroke="#e8e2d0" stroke-width="2" fill="none"/>
        ${hand(84, 104, SKIN.a)}
      </g>
      <g transform="translate(80 82)"><g class="proj"><circle ${OUT} r="3.5" fill="#9aa0ad"/></g></g>`),

    // ✖️ 비숍: 주교관(플레이어 색) + 흰 사제복 + 금빛 지팡이
    bishop: () => wrap('bishop', `
      ${robe('#f3efe6')}
      <path d="M54 81 L51 127 M66 81 L69 127" stroke="#151827" stroke-width="7"/>
      <path d="M54 81 L51 127 M66 81 L69 127" stroke="#e0b43a" stroke-width="4"/>
      <g class="staff">
        <rect ${OUT} x="27" y="52" width="6" height="76" rx="3" fill="#d9a93a"/>
        <path d="M30 56 Q28 36 42 36 Q52 38 48 50" fill="none" stroke="#151827" stroke-width="9" stroke-linecap="round"/>
        <path d="M30 56 Q28 36 42 36 Q52 38 48 50" fill="none" stroke="#f0c75a" stroke-width="4.5" stroke-linecap="round"/>
        ${hand(30, 100, SKIN.c)}
      </g>
      ${hand(79, 104, SKIN.c)}
      ${head(SKIN.c)}
      ${blush}
      ${faces('#151827', smile)}
      <g class="mitre">
        <path class="o pc" d="M38 44 Q37 20 60 4 Q83 20 82 44 Q60 37 38 44 Z"/>
        <path d="M60 13 L60 32 M53 20 L67 20" stroke="#ffd45a" stroke-width="4" stroke-linecap="round"/>
        <path ${OUT} d="M38 45 Q60 37 82 45 L82 38 Q60 30 38 38 Z" fill="#ffd45a"/>
      </g>
      <g class="flash"><path d="M86 18 L112 44 M112 18 L86 44" stroke="#fff4b0" stroke-width="5" stroke-linecap="round"/><circle cx="99" cy="31" r="5" fill="#fff"/></g>`),

    // ➕ 룩: 성벽 모양 투구 + 갑옷 + 플레이어 색 방패(＋ 무늬)
    rook: () => wrap('rook', `
      ${legs('#5a6275')}
      ${torso('#9aa3b5')}
      <rect class="o pc" x="50" y="81" width="20" height="35" rx="4"/>
      ${hand(80, 102, SKIN.d)}
      ${head(SKIN.d)}
      ${faces('#151827', brows() + `<path d="M55 72 L65 72" stroke="#151827" stroke-width="2.4" stroke-linecap="round"/>`)}
      <path ${OUT} d="M31 60 L31 28 L39 28 L39 20 L47 20 L47 28 L55 28 L55 20 L65 20 L65 28 L73 28 L73 20 L81 20 L81 28 L89 28 L89 60 L83 60 Q83 44 60 44 Q37 44 37 60 Z" fill="#9aa3b5"/>
      <path d="M33 36 L87 36 M45 28 L45 36 M60 28 L60 36 M75 28 L75 36" stroke="#6f788b" stroke-width="2"/>
      <g class="shield">
        <path class="o pc" d="M21 86 L49 86 L49 106 Q49 120 35 127 Q21 120 21 106 Z"/>
        <path d="M35 92 L35 118 M26 104 L44 104" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>
      </g>
      <g class="flash"><path d="M104 68 L104 104 M86 86 L122 86" stroke="#fff4b0" stroke-width="6" stroke-linecap="round"/><circle cx="104" cy="86" r="5" fill="#fff"/></g>`),

    // 🐴 나이트: 투구 + 플레이어 색 깃털 장식 + 띠 + 검
    knight: () => wrap('knight', `
      ${legs('#7d8699')}
      ${torso('#b8c0cf')}
      <path class="o pc" d="M42 87 L49 81 L78 109 L72 115 Z"/>
      ${hand(42, 104, '#b8c0cf')}
      ${head(SKIN.a)}
      ${blush}
      ${faces('#151827', smile)}
      <g class="plume"><path class="o pc" d="M57 30 Q48 9 65 4 Q84 1 89 17 Q77 12 68 29 Z"/></g>
      <path ${OUT} d="M30 63 Q30 26 60 26 Q90 26 90 63 L83 63 Q83 42 60 42 Q37 42 37 63 Z" fill="#c7ceda"/>
      <path d="M60 27 L60 42" stroke="#8e97aa" stroke-width="3"/>
      <g fill="#8e97aa"><circle cx="34" cy="55" r="1.6"/><circle cx="86" cy="55" r="1.6"/></g>
      <g class="sword">
        <path ${OUT} d="M77 94 L77 58 L80.5 52 L84 58 L84 94 Z" fill="#e6ebf5"/>
        <rect ${OUT} x="71" y="93" width="19" height="5" rx="2" fill="#d9a93a"/>
        <rect ${OUT} x="78" y="98" width="5" height="8" fill="#6b4423"/>
        ${hand(80.5, 104, '#b8c0cf')}
      </g>
      <g class="flash"><path d="M86 36 Q120 60 98 108" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".9"/></g>`),

    // 👑 킹: 왕관 + 플레이어 색 망토 + 흰 털 깃 + 콧수염 + 홀
    king: () => wrap('king', `
      <path class="o pc" d="M38 78 Q23 104 28 128 L92 128 Q97 104 82 78 Z"/>
      ${legs('#3a2f55')}
      ${torso('#f5e6c4')}
      <rect ${OUT} x="40" y="102" width="40" height="6" rx="3" fill="#d9a93a"/>
      <rect ${OUT} x="36" y="76" width="48" height="10" rx="5" fill="#fbfaf5"/>
      <g fill="#151827"><circle cx="44" cy="81" r="1.3"/><circle cx="54" cy="81" r="1.3"/><circle cx="66" cy="81" r="1.3"/><circle cx="76" cy="81" r="1.3"/></g>
      ${hand(42, 104, SKIN.b)}
      ${head(SKIN.b)}
      ${blush}
      ${faces('#151827', `<path ${OUT} d="M51 71 Q56 66 60 70 Q64 66 69 71 Q64 74 60 72 Q56 74 51 71 Z" fill="#8a5a2b" stroke-width="1.5"/>`)}
      <g class="crown">
        <path ${OUT} d="M38 41 L37 18 L47 28 L53 13 L60 25 L67 13 L73 28 L83 18 L82 41 Q60 36 38 41 Z" fill="#ffcb3d"/>
        <circle class="pc thin" cx="60" cy="34" r="3.6"/>
        <circle cx="47" cy="35" r="2" fill="#fff"/><circle cx="73" cy="35" r="2" fill="#fff"/>
      </g>
      <g class="sceptre">
        <rect ${OUT} x="79" y="66" width="5" height="42" rx="2" fill="#d9a93a"/>
        <circle ${OUT} cx="81.5" cy="62" r="7" fill="#ffcb3d"/>
        <circle class="pc" cx="81.5" cy="62" r="3"/>
        ${hand(81.5, 104, SKIN.b)}
      </g>
      <g class="flash"><ellipse cx="60" cy="128" rx="54" ry="13" fill="none" stroke="#ffe07a" stroke-width="4"/><ellipse cx="60" cy="128" rx="38" ry="9" fill="none" stroke="#fff4b0" stroke-width="3"/></g>`),

    // 💣 박격포: 철모(플레이어 색 줄) + 고글 + 군복 + 박격포
    mortar: () => wrap('mortar', `
      ${legs('#4d5530')}
      ${torso('#6b7a3f')}
      <rect ${OUT} x="40" y="100" width="40" height="6" rx="3" fill="#4a3a22"/>
      <rect ${OUT} x="44" y="86" width="10" height="9" rx="2" fill="#5a6834"/>
      ${hand(42, 104, SKIN.e)}
      ${head(SKIN.e)}
      ${faces('#151827', grin)}
      <g class="helm">
        <path ${OUT} d="M30 53 Q30 23 60 23 Q90 23 90 53 Z" fill="#5d6b3a"/>
        <path class="o pc" d="M31 45 Q60 37 89 45 L89 51 Q60 43 31 51 Z"/>
        <rect ${OUT} x="27" y="49" width="66" height="7" rx="3.5" fill="#4f5c30"/>
        <g class="goggles"><path d="M40 36 Q60 30 80 36" stroke="#151827" stroke-width="3" fill="none"/>
          <circle ${OUT} cx="50" cy="35" r="5.5" fill="#bfe8ff"/><circle ${OUT} cx="70" cy="35" r="5.5" fill="#bfe8ff"/></g>
      </g>
      <g class="tube">
        <path ${OUT} d="M86.8 123 L108.8 84.9 L119.2 90.9 L97.2 129 Z" fill="#3f4633"/>
        <path ${OUT} d="M107.1 83.9 L110.1 78.7 L123.9 86.7 L120.9 91.9 Z" fill="#2f3526"/>
        <path ${OUT} d="M78 128 L108 128 L101 121 L85 121 Z" fill="#2f3526"/>
        ${hand(101, 111, SKIN.e)}
      </g>
      <g transform="translate(117 80)"><g class="proj"><path ${OUT} d="M0 -7 Q5 -2 5 5 L-5 5 Q-5 -2 0 -7 Z" fill="#3a3e4f"/></g></g>
      <g class="flash"><circle cx="118" cy="78" r="8" fill="#eceae4"/><circle cx="109" cy="74" r="5.5" fill="#d6d3cc"/><circle cx="126" cy="72" r="5.5" fill="#e0ddd6"/></g>`),

    // 🎲 난사: 페도라(플레이어 색 띠) + 선글라스 + 줄무늬 정장 + 톰슨 기관단총
    scatter: () => wrap('scatter', `
      ${legs('#2b2d38')}
      ${torso('#3a3d4d')}
      <path d="M46 84 L46 114 M53 81 L53 116 M67 81 L67 116 M74 84 L74 114" stroke="#555a70" stroke-width="1.6"/>
      <path ${OUT} d="M52 81 L60 92 L68 81 Z" fill="#f4f1ea"/>
      <path class="thin pc" d="M58.5 83 L61.5 83 L62.5 96 L60 100 L57.5 96 Z"/>
      ${head(SKIN.a)}
      ${faces('#151827', `<path ${OUT} d="M42 54 L57 54 L56 62 Q50 66 44 62 Z M63 54 L78 54 L76 62 Q70 66 64 62 Z" fill="#151827" stroke-width="2"/>
        <path d="M57 56 L63 56" stroke="#151827" stroke-width="2.4"/><path d="M45 57 L50 57" stroke="#fff" stroke-width="1.4" opacity=".6"/>
        <path d="M55 72 Q61 75 66 70" fill="none" stroke="#151827" stroke-width="2.2" stroke-linecap="round"/><path d="M66 71 L75 68" stroke="#e8c98a" stroke-width="2.2" stroke-linecap="round"/>`)}
      <g class="hat">
        <path ${OUT} d="M40 40 L43 20 Q52 24 60 18 Q68 24 77 20 L80 40 Z" fill="#2b2d38"/>
        <rect class="o pc" x="41" y="31" width="38" height="7"/>
        <path ${OUT} d="M23 42 Q60 31 97 42 Q60 50 23 42 Z" fill="#2b2d38"/>
      </g>
      <g class="gun">
        <path ${OUT} d="M26 99 L45 94 L47 104 L31 109 Z" fill="#7a4f2a"/>
        <rect ${OUT} x="43" y="91" width="35" height="9" rx="2" fill="#2e3242"/>
        <circle ${OUT} cx="59" cy="105" r="7.5" fill="#3b4058"/>
        <rect ${OUT} x="76" y="92.5" width="24" height="6" rx="2" fill="#454b63"/>
        <path d="M81 94 L81 97 M86 94 L86 97 M91 94 L91 97" stroke="#151827" stroke-width="1.5"/>
        <rect ${OUT} x="80" y="98" width="5" height="9" rx="2" fill="#7a4f2a"/>
        ${hand(50, 99, SKIN.a)}${hand(82.5, 106, SKIN.a)}
        <g class="flash f1"><path d="M101 95.5 L114 88 L111 95.5 L118 97 L111 99 L114 104 Z" fill="#ffe14d" stroke="#ff9f43" stroke-width="1.5"/></g>
        <g class="flash f2"><path d="M101 93 L112 82 L110 90 Z" fill="#ffe14d" stroke="#ff9f43" stroke-width="1.5"/></g>
        <g class="flash f3"><path d="M101 98 L112 108 L110 101 Z" fill="#ffe14d" stroke="#ff9f43" stroke-width="1.5"/></g>
      </g>`),

    // 👸 퀸: 긴 머리 + 티아라 + 플레이어 색 드레스 + 별 지팡이
    queen: () => wrap('queen', `
      <g class="hair-back"><path ${OUT} d="M30 58 Q28 26 60 26 Q92 26 90 58 L94 100 Q86 105 80 95 L40 95 Q34 105 26 100 Z" fill="#6b3f2a"/></g>
      <path class="o pc" d="M46 80 L74 80 Q80 80 81 86 L92 123 Q93 128 88 128 L32 128 Q27 128 28 123 L39 86 Q40 80 46 80 Z"/>
      <path d="M46 82 Q60 92 74 82" stroke="#fff" stroke-width="3" fill="none"/>
      <path d="M32 121 Q39 116 46 121 Q53 116 60 121 Q67 116 74 121 Q81 116 88 121" stroke="#fff" stroke-width="2.5" fill="none" opacity=".85"/>
      ${hand(40, 100, SKIN.f)}
      ${head(SKIN.f)}
      <path ${OUT} d="M33 57 Q33 30 60 30 Q87 30 87 57 Q80 42 67 40 Q59 50 41 48 Q36 51 33 57 Z" fill="#6b3f2a"/>
      ${blush}
      ${faces('#151827', `<path d="M45 55 L43 53 M75 55 L77 53" stroke="#151827" stroke-width="1.8" stroke-linecap="round"/><path d="M56 71 Q60 74 64 71" fill="none" stroke="#d64561" stroke-width="2.4" stroke-linecap="round"/>`)}
      <g class="tiara"><path ${OUT} d="M42 35 L48 24 L54 30 L60 17 L66 30 L72 24 L78 35 Q60 31 42 35 Z" fill="#ffd45a"/><circle class="pc thin" cx="60" cy="27" r="3.2"/></g>
      <g class="wand">
        <rect ${OUT} x="79" y="74" width="4" height="30" rx="2" fill="#fff"/>
        <g class="star"><path ${OUT} d="M81 58 L84 66 L92 66 L86 71 L88 79 L81 74 L74 79 L76 71 L70 66 L78 66 Z" fill="#ffd45a"/></g>
        ${hand(81, 102, SKIN.f)}
      </g>
      <g class="flash"><path d="M81 42 L81 54 M81 82 L81 94 M53 68 L65 68 M97 68 L109 68 M62 49 L70 57 M92 79 L100 87 M100 49 L92 57 M70 79 L62 87" stroke="#fff4b0" stroke-width="4" stroke-linecap="round"/></g>`),

    // 🔦 레이저: 우주 헬멧 + 안테나(플레이어 색 불빛) + 흰 우주복 + 광선총
    laser: () => wrap('laser', `
      ${legs('#e6e9f0')}
      ${torso('#eef1f7')}
      <rect class="o pc" x="51" y="90" width="18" height="12" rx="3"/>
      <circle cx="56" cy="96" r="2" fill="#fff"/><circle cx="64" cy="96" r="2" fill="#151827" opacity=".5"/>
      ${hand(42, 104, '#eef1f7')}
      ${head(SKIN.d)}
      ${blush}
      ${faces('#151827', grin)}
      <rect ${OUT} x="38" y="81" width="44" height="7" rx="3.5" fill="#b8c0cf"/>
      <circle cx="60" cy="57" r="31" fill="#bfe8ff" fill-opacity=".22" stroke="#151827" stroke-width="3"/>
      <path d="M39 42 Q45 33 56 31" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".85"/>
      <g class="ant"><path d="M79 33 L87 16" stroke="#151827" stroke-width="2.6"/><circle class="o pc light" cx="87" cy="15" r="4.2"/></g>
      <g class="gun">
        <path ${OUT} d="M70 96 L94 92 Q101 92 101 97 L101 99 Q101 103 94 103 L81 103 L79 111 L71 111 Z" fill="#f2c14e"/>
        <path d="M86 93.5 L86 103 M91 93 L91 103" stroke="#151827" stroke-width="2"/>
        ${hand(74, 104, '#eef1f7')}
        <g class="flash charge"><circle cx="103" cy="97.5" r="6" class="pc" opacity=".8"/><circle cx="103" cy="97.5" r="3" fill="#fff"/></g>
        <g class="flash beam"><rect x="101" y="94.5" width="46" height="6" rx="3" class="pc"/><rect x="101" y="96.5" width="46" height="2" fill="#fff"/></g>
      </g>`),

    // 🔱 창: 청동 투구 + 플레이어 색 볏 + 짧은 망토 + 긴 창
    spear: () => wrap('spear', `
      <path class="o pc" d="M42 80 Q28 100 30 122 L48 116 L50 84 Z"/>
      ${legs('#8a5a2b')}
      ${torso('#c98b3c')}
      <path d="M46 90 Q60 96 74 90 M48 100 Q60 105 72 100" stroke="#8a5a2b" stroke-width="2.2" fill="none"/>
      ${head(SKIN.c)}
      ${faces('#151827', brows() + `<path d="M55 72 L65 71" stroke="#151827" stroke-width="2.4" stroke-linecap="round"/>`)}
      <g class="crest"><path class="o pc" d="M36 33 Q38 6 62 5 Q86 6 88 31 L80 31 Q77 16 62 15 Q46 15 44 33 Z"/>
        <path d="M46 14 L44 8 M54 10 L53 4 M62 9 L62 3 M70 10 L72 4 M78 14 L81 9" stroke="#151827" stroke-width="2" stroke-linecap="round"/></g>
      <path ${OUT} d="M30 64 Q29 27 60 27 Q91 27 90 64 L82 66 L80 50 Q60 44 40 50 L38 66 Z" fill="#d19a3a"/>
      <path d="M60 28 L60 44" stroke="#9a6a1f" stroke-width="3"/>
      <g class="spear">
        <rect ${OUT} x="12" y="97" width="94" height="5" rx="2.5" fill="#8a5a2b"/>
        <path ${OUT} d="M104 91 L123 99.5 L104 108 L107 99.5 Z" fill="#dfe4ee"/>
        ${hand(46, 100, SKIN.c)}${hand(76, 100, SKIN.c)}
        <g class="flash"><path d="M126 99.5 L136 99.5 M124 92 L131 87 M124 107 L131 112" stroke="#fff4b0" stroke-width="3" stroke-linecap="round"/></g>
      </g>`),

    // 🌩️ 체인 번개: 번개 맞은 흰 머리 + 이마 고글 + 흰 가운 + 플레이어 색 나비넥타이 + 테슬라 막대
    chain: () => wrap('chain', `
      ${legs('#3b3f55')}
      <path ${OUT} d="M40 86 Q40 80 48 80 L72 80 Q80 80 80 86 L82 121 L38 121 Z" fill="#f4f6fb"/>
      <path d="M52 81 L57 98 M68 81 L63 98 M60 100 L60 121" stroke="#c9cfdc" stroke-width="2.2" fill="none"/>
      <path class="thin pc" d="M51 82 L60 86 L51 90 Z M69 82 L60 86 L69 90 Z"/>
      ${hand(42, 104, SKIN.a)}
      <g class="hair"><path ${OUT} d="M32 57 L21 45 L33 42 L25 28 L40 32 L40 15 L52 26 L58 9 L66 26 L78 13 L80 30 L95 25 L87 40 L99 44 L88 57 Q86 38 60 36 Q34 38 32 57 Z" fill="#eef0f5"/></g>
      ${head(SKIN.a)}
      ${blush}
      ${faces('#151827', `<path d="M54 70 Q60 78 67 70 Z" fill="#fff" stroke="#151827" stroke-width="2.2" stroke-linejoin="round"/><path d="M57 71 L57 74 M60 71 L60 75 M63 71 L63 74" stroke="#151827" stroke-width="1"/>`)}
      <path d="M34 45 Q60 36 86 45" stroke="#151827" stroke-width="3.5" fill="none"/>
      <circle ${OUT} cx="50" cy="42" r="6" fill="#ffb84d"/><circle ${OUT} cx="70" cy="42" r="6" fill="#ffb84d"/>
      <circle cx="48" cy="40" r="1.8" fill="#fff" opacity=".8"/><circle cx="68" cy="40" r="1.8" fill="#fff" opacity=".8"/>
      <g class="rod">
        <rect ${OUT} x="79" y="70" width="5" height="36" rx="2" fill="#8a8f9e"/>
        <path d="M78 76 L85 78 M78 82 L85 84 M78 88 L85 90" stroke="#c98b3c" stroke-width="2"/>
        <circle ${OUT} cx="81.5" cy="65" r="7" fill="#7fd1ff"/>
        <g class="spark"><path d="M72 58 L69 54 M91 58 L94 54 M81.5 55 L81.5 49" stroke="#7fd1ff" stroke-width="2.4" stroke-linecap="round"/></g>
        ${hand(81.5, 104, SKIN.a)}
      </g>
      <g class="flash bolt"><path d="M88 62 L99 53 L96 63 L109 56 L104 68 L118 63" fill="none" stroke="#fff27a" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/></g>
      <g class="flash bolt2"><path d="M118 63 L113 74 L120 78 L112 92" fill="none" stroke="#fff27a" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/></g>`),

    // 🌪️ 회오리: 상투 + 플레이어 색 머리띠 + 도복·하카마 + 카타나
    whirl: () => wrap('whirl', `
      <path ${OUT} d="M42 106 L78 106 L85 128 L63 128 L60 116 L57 128 L35 128 Z" fill="#2f3450"/>
      ${torso('#f4f1ea')}
      <path d="M52 81 L60 96 L68 81" stroke="#c9c2b0" stroke-width="2.5" fill="none"/>
      <rect ${OUT} x="40" y="102" width="40" height="7" rx="3" fill="#1d1b24"/>
      ${head(SKIN.b)}
      <path ${OUT} d="M33 54 Q32 30 60 30 Q88 30 87 54 Q80 40 60 41 Q40 40 33 54 Z" fill="#1d1b24"/>
      <ellipse ${OUT} cx="60" cy="26" rx="7" ry="6" fill="#1d1b24"/>
      <g class="band"><path class="o pc" d="M33 49 Q60 41 87 49 L87 55 Q60 47 33 55 Z"/>
        <g class="tails"><path class="o pc" d="M34 51 L20 47 L24 53 L18 59 L34 56 Z"/></g></g>
      ${faces('#151827', brows() + `<path d="M56 72 L64 72" stroke="#151827" stroke-width="2.4" stroke-linecap="round"/>`)}
      <g class="sword">
        <path d="M78 94 L112 54" stroke="#151827" stroke-width="7.5" stroke-linecap="round"/>
        <path d="M78 94 L112 54" stroke="#e6ebf5" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M71 102 L78 94" stroke="#151827" stroke-width="7" stroke-linecap="round"/>
        <path d="M71 102 L78 94" stroke="#6b2a2a" stroke-width="3.5" stroke-linecap="round"/>
        <ellipse ${OUT} cx="78" cy="94" rx="5" ry="2.5" transform="rotate(-50 78 94)" fill="#d9a93a"/>
        ${hand(74, 99, SKIN.b)}${hand(70, 104, SKIN.b)}
      </g>
      <g class="flash"><ellipse cx="60" cy="100" rx="52" ry="15" fill="none" stroke="#dff6ff" stroke-width="4" stroke-dasharray="30 14" stroke-linecap="round"/>
        <ellipse cx="60" cy="78" rx="42" ry="11" fill="none" stroke="#dff6ff" stroke-width="3" stroke-dasharray="22 12" stroke-linecap="round" opacity=".8"/></g>`),

    // 🪃 부메랑: 삐죽 머리 + 머리띠 (플레이어 색) + 나무 부메랑
    boomerang: () => {
      const boom = (cls = '') => `<g class="${cls}"><path class="o" d="M0 0 L20 -4 Q24 -3 22 1 L8 4 L4 18 Q2 22 -2 18 Z" fill="#c98b3c"/><path d="M3 2 L16 -1 M3 3 L1 14" stroke="#8a5a2b" stroke-width="2" stroke-linecap="round"/></g>`;
      return wrap('boomerang', `
      ${legs('#4a5a7a')}
      ${torso('#2f9e8f')}
      <path ${OUT} d="M40 90 Q40 80 50 80 L56 80 L56 116 L46 116 Q40 116 40 108 Z M80 90 Q80 80 70 80 L64 80 L64 116 L74 116 Q80 116 80 108 Z" fill="#b8864a"/>
      ${hand(42, 100, SKIN.b)}
      ${head(SKIN.b)}
      <path ${OUT} d="M34 52 L30 36 L42 42 L44 26 L54 38 L60 22 L66 38 L76 26 L78 42 L90 36 L86 52 Q60 40 34 52 Z" fill="#c9702a"/>
      <g class="band"><path class="o pc" d="M34 48 Q60 40 86 48 L86 55 Q60 47 34 55 Z"/>
        <g class="tails"><path class="o pc" d="M34 50 L20 46 L24 52 L18 58 L34 55 Z"/></g></g>
      ${blush}
      <g fill="#b0602a" opacity=".6"><circle cx="46" cy="67" r="1"/><circle cx="49" cy="69" r="1"/><circle cx="71" cy="69" r="1"/><circle cx="74" cy="67" r="1"/></g>
      ${faces('#151827', grin)}
      <g class="arm-throw">
        <rect ${OUT} x="74" y="84" width="10" height="20" rx="5" fill="#2f9e8f"/>
        <g transform="translate(79 96)">${boom('held')}</g>
        ${hand(80, 104, SKIN.b)}
      </g>
      <g transform="translate(82 94)">${boom('proj')}</g>`);
    },

    // 🪝 갈고리: 플레이어 색 두건 + 안대 + 줄무늬 셔츠·조끼 + 갈고리 손 + 밧줄 갈고리
    grapple: () => wrap('grapple', `
      ${legs('#3b3f55')}
      ${torso('#f4f1ea')}
      <path d="M41 91 L79 91 M41 101 L79 101 M42 110 L78 110" stroke="#3a3f55" stroke-width="3"/>
      <path ${OUT} d="M40 90 Q40 80 50 80 L54 80 L54 116 L46 116 Q40 116 40 108 Z M80 90 Q80 80 70 80 L66 80 L66 116 L74 116 Q80 116 80 108 Z" fill="#6b4423"/>
      <g class="hook"><rect ${OUT} x="36" y="95" width="11" height="6" rx="2" fill="#6b4423"/>
        <path d="M41.5 101 L41.5 107 Q41.5 115 35 115 Q30 114 31 108" fill="none" stroke="#151827" stroke-width="6.5" stroke-linecap="round"/>
        <path d="M41.5 101 L41.5 107 Q41.5 115 35 115 Q30 114 31 108" fill="none" stroke="#c7ceda" stroke-width="3" stroke-linecap="round"/></g>
      ${head(SKIN.c)}
      <g fill="#6b4423" opacity=".45"><circle cx="50" cy="75" r=".9"/><circle cx="54" cy="78" r=".9"/><circle cx="60" cy="79" r=".9"/><circle cx="66" cy="78" r=".9"/><circle cx="70" cy="75" r=".9"/></g>
      ${faces('#151827', `<path d="M35 50 L85 44" stroke="#151827" stroke-width="2"/><ellipse cx="50" cy="60" rx="6.5" ry="7" fill="#151827"/>
        <path d="M55 70 Q60 77 66 70 Z" fill="#fff" stroke="#151827" stroke-width="2.2" stroke-linejoin="round"/><rect x="61" y="70.5" width="3" height="3" fill="#ffcb3d"/>`)}
      <g class="bandana"><path class="o pc" d="M33 50 Q33 28 60 28 Q87 28 87 50 Q60 42 33 50 Z"/>
        <g fill="#fff" opacity=".8"><circle cx="48" cy="36" r="2"/><circle cx="62" cy="33" r="2"/><circle cx="75" cy="38" r="2"/><circle cx="55" cy="43" r="1.6"/><circle cx="70" cy="44" r="1.6"/></g>
        <g class="tails"><path class="o pc" d="M34 46 L21 42 L25 49 L19 56 L35 51 Z"/></g></g>
      <circle cx="83" cy="103" r="8" fill="none" stroke="#151827" stroke-width="6"/>
      <circle cx="83" cy="103" r="8" fill="none" stroke="#c9a26a" stroke-width="3"/>
      ${hand(82, 99, SKIN.c)}
      <g class="rope flash"><rect x="86" y="96" width="56" height="2.4" fill="#c9a26a"/></g>
      <g transform="translate(88 97)"><g class="proj">
        <path d="M0 -7 L0 7 M-7 2 Q0 12 7 2 M0 -7 L-3 -4 M0 -7 L3 -4" fill="none" stroke="#151827" stroke-width="5" stroke-linecap="round"/>
        <path d="M0 -7 L0 7 M-7 2 Q0 12 7 2" fill="none" stroke="#c7ceda" stroke-width="2.4" stroke-linecap="round"/></g></g>`),

    // 🌊 충격파: 삐죽 머리 + 흰 머리띠 + 도복 + 플레이어 색 권투 장갑
    shockwave: () => wrap('shockwave', `
      ${legs('#f4f1ea')}
      ${torso('#f4f1ea')}
      <path d="M52 81 L60 95 L68 81 Z" fill="${SKIN.d}"/>
      <path d="M52 81 L60 95 L68 81" stroke="#c9c2b0" stroke-width="2.5" fill="none"/>
      <rect ${OUT} x="40" y="102" width="40" height="6" rx="3" fill="#1d1b24"/>
      <path d="M44 108 L40 118 M50 108 L52 118" stroke="#1d1b24" stroke-width="4" stroke-linecap="round"/>
      ${head(SKIN.d)}
      <path ${OUT} d="M33 52 L29 37 L40 40 L42 27 L52 34 L60 23 L68 34 L78 27 L80 40 L91 37 L87 52 Q60 40 33 52 Z" fill="#1d1b24"/>
      <path ${OUT} d="M33 48 Q60 40 87 48 L87 54 Q60 46 33 54 Z" fill="#f4f1ea"/>
      <path ${OUT} d="M34 50 L22 46 L25 52 L20 58 L34 55 Z" fill="#f4f1ea"/>
      ${faces('#151827', brows() + `<path d="M54 71 L66 71 L64 75 L56 75 Z" fill="#fff" stroke="#151827" stroke-width="2" stroke-linejoin="round"/>`)}
      <g class="fist-l"><circle class="o pc" cx="40" cy="95" r="8.5"/><path d="M36 91 Q40 89 44 91" stroke="#fff" stroke-width="2" fill="none" opacity=".6"/></g>
      <g class="fist-r"><circle class="o pc" cx="82" cy="92" r="8.5"/><path d="M78 88 Q82 86 86 88" stroke="#fff" stroke-width="2" fill="none" opacity=".6"/></g>
      <g class="flash wave"><path d="M92 66 Q110 94 92 122" fill="none" stroke="#dff6ff" stroke-width="5" stroke-linecap="round"/>
        <path d="M102 58 Q126 94 102 130" fill="none" stroke="#dff6ff" stroke-width="4" stroke-linecap="round" opacity=".7"/></g>`),

    // 💫 유도탄: 플레이어 색 고깔모자 + 동그란 안경 + 별무늬 로브 + 빛나는 구슬 지팡이
    homing: () => wrap('homing', `
      ${robe('#2c3a73')}
      <g fill="#ffe14d"><circle cx="48" cy="100" r="1.6"/><circle cx="70" cy="92" r="1.4"/><circle cx="64" cy="114" r="1.6"/><circle cx="44" cy="118" r="1.3"/><circle cx="76" cy="120" r="1.3"/></g>
      ${hand(40, 104, SKIN.a)}
      ${head(SKIN.a)}
      <path ${OUT} d="M33 58 Q33 43 42 41 L78 41 Q87 43 87 58 Q79 48 71 50 Q65 44 59 50 Q51 44 45 50 Q38 50 33 58 Z" fill="#c98b3c"/>
      ${blush}
      ${faces('#151827', `<circle cx="50" cy="60" r="7" fill="none" stroke="#151827" stroke-width="2"/><circle cx="70" cy="60" r="7" fill="none" stroke="#151827" stroke-width="2"/><path d="M57 60 L63 60" stroke="#151827" stroke-width="2"/>` + smile)}
      <g class="hat">
        <path class="o pc" d="M40 43 Q46 24 56 12 L68 16 Q72 30 80 43 Z"/>
        <g class="hat-tip"><path class="o pc" d="M55 13 Q62 2 76 5 Q70 9 69 18 Z"/></g>
        <path d="M59 31 L61 26 L63 31 L68 31 L64 34 L66 39 L61 36 L56 39 L58 34 L54 31 Z" fill="#ffe14d"/>
        <path class="o pc-d" d="M27 44 Q60 35 93 44 Q60 51 27 44 Z"/>
      </g>
      <g class="staff">
        <rect ${OUT} x="80" y="66" width="5" height="60" rx="2.5" fill="#8a5a2b"/>
        <g class="orb"><circle ${OUT} cx="82.5" cy="61" r="7" fill="#b8f0ff"/><circle cx="80" cy="58.5" r="2" fill="#fff"/></g>
        ${hand(82.5, 104, SKIN.a)}
      </g>
      <g transform="translate(82 58)"><g class="proj o1"><circle r="5" fill="#b8f0ff" stroke="#fff" stroke-width="2"/></g></g>
      <g transform="translate(82 58)"><g class="proj o2"><circle r="4.5" fill="#b8f0ff" stroke="#fff" stroke-width="2"/></g></g>`),

    // 🗡️ 암살: 두건 + 플레이어 색 복면·목도리 + 단검
    assassin: () => wrap('assassin', `
      <g class="tail"><path class="o pc" d="M42 82 Q26 78 13 88 Q24 88 29 93 Q20 98 16 107 Q31 99 44 90 Z"/></g>
      ${legs('#23263a')}
      ${torso('#2b2f45')}
      <path d="M44 100 L76 100" stroke="#151827" stroke-width="4"/>
      <path d="M44 100 L76 100" stroke="#4a5070" stroke-width="2"/>
      ${hand(42, 104, SKIN.b)}
      ${head(SKIN.b)}
      <path ${OUT} d="M31 64 Q30 28 60 28 Q90 28 89 64 L83 66 Q83 49 60 48 Q37 49 37 66 Z" fill="#2b2f45"/>
      <path class="o pc" d="M35 65 Q60 60 85 65 Q85 85 60 87 Q35 85 35 65 Z"/>
      <path d="M40 72 Q60 68 80 72" stroke="#151827" stroke-width="1.5" opacity=".35" fill="none"/>
      ${faces('#151827', `<path d="M44 53 L55 56 M76 53 L65 56" stroke="#151827" stroke-width="2.8" stroke-linecap="round"/>`)}
      <g class="blade">
        <rect ${OUT} x="70" y="98" width="10" height="6" rx="2" fill="#151827"/>
        <rect ${OUT} x="79" y="95" width="3.5" height="12" rx="1.5" fill="#8a8f9e"/>
        <path ${OUT} d="M82.5 98 L104 101 L82.5 104 Z" fill="#e6ebf5"/>
        ${hand(75, 101, SKIN.b)}
      </g>
      <g class="flash smoke"><circle cx="60" cy="96" r="22" fill="#9aa0ad" opacity=".85"/><circle cx="42" cy="84" r="14" fill="#b8bdc8" opacity=".85"/><circle cx="78" cy="82" r="15" fill="#b8bdc8" opacity=".85"/><circle cx="60" cy="68" r="16" fill="#c9cdd6" opacity=".8"/></g>
      <g class="flash slash"><path d="M86 66 Q116 88 94 118" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M92 72 Q114 90 98 112" fill="none" stroke="#ff5d6c" stroke-width="2.5" stroke-linecap="round"/></g>`),

    // ☠️ 독: 역병 의사 — 플레이어 색 두건 + 부리 가면 + 초록 독병
    poison: () => {
      const flask = cls => `<g class="${cls}"><path ${OUT} d="M77 84 L85 84 L85 90 Q93 94 92 103 Q91 112 81 112 Q71 112 70 103 Q69 94 77 90 Z" fill="#e8f7ff"/>
        <path d="M72 100 Q81 97 90 100 Q90 110 81 110 Q72 110 72 100 Z" fill="#7dff6a"/><rect ${OUT} x="76" y="80" width="10" height="5" rx="1.5" fill="#8a5a2b"/></g>`;
      return wrap('poison', `
      ${robe('#34423a')}
      <path d="M60 82 L60 126" stroke="#26302a" stroke-width="2.5"/>
      <g fill="#26302a"><circle cx="56" cy="92" r="1.8"/><circle cx="56" cy="104" r="1.8"/><circle cx="56" cy="116" r="1.8"/></g>
      ${hand(40, 104, '#3a2f2a')}
      <path class="o pc" d="M29 68 Q27 25 60 25 Q93 25 91 68 L85 72 Q85 44 60 42 Q35 44 35 72 Z"/>
      ${head('#efe6d2')}
      <path ${OUT} d="M63 64 Q92 60 108 80 Q88 82 64 77 Z" fill="#e6dcc4"/>
      <path d="M70 70 Q88 70 100 77" stroke="#b9ad92" stroke-width="2" fill="none"/>
      <circle ${OUT} cx="50" cy="58" r="8" fill="#cfe8d8"/><circle ${OUT} cx="70" cy="58" r="8" fill="#cfe8d8"/>
      ${faces('#1f5a2a', `<circle cx="47" cy="55" r="2" fill="#fff" opacity=".7"/><circle cx="67" cy="55" r="2" fill="#fff" opacity=".7"/>`)}
      <g class="bubbles"><circle cx="86" cy="76" r="2.4" fill="none" stroke="#9dff8a" stroke-width="1.6"/><circle cx="90" cy="70" r="1.6" fill="none" stroke="#9dff8a" stroke-width="1.4"/></g>
      ${flask('flask')}
      ${hand(79, 104, '#3a2f2a')}
      <g transform="translate(0 0)"><g class="proj">${flask('')}</g></g>
      <g class="flash splash"><circle cx="146" cy="96" r="12" fill="#7dff6a" opacity=".6"/><circle cx="138" cy="88" r="4" fill="#b8ff9e"/><circle cx="154" cy="86" r="3.5" fill="#b8ff9e"/><circle cx="150" cy="104" r="3" fill="#b8ff9e"/></g>`);
    },

    // 🏹 궁수: 엘프 — 긴 금발 + 뾰족 귀 + 플레이어 색 두건 + 활·화살통
    archer: () => wrap('archer', `
      <path ${OUT} d="M31 58 Q29 30 60 30 Q91 30 89 58 L92 90 Q82 93 78 82 L42 82 Q38 93 28 90 Z" fill="#f3d27a"/>
      <path ${OUT} d="M26 72 L38 66 L47 102 L35 106 Z" fill="#8a5a2b"/>
      <path d="M29 70 L25 60 M33 68 L31 57 M37 66 L37 56" stroke="#151827" stroke-width="2.5" stroke-linecap="round"/>
      <g class="pc"><path class="thin pc" d="M22 58 L25 60 L28 56 Z M28 56 L31 57 L33 53 Z M34 54 L37 56 L39 52 Z"/></g>
      ${legs('#5a4030')}
      ${torso('#3f7a4a')}
      <rect ${OUT} x="40" y="100" width="40" height="6" rx="3" fill="#8a5a2b"/>
      <path class="o pc" d="M38 78 Q60 90 82 78 L84 87 Q60 99 36 87 Z"/>
      <g class="ears"><path ${OUT} d="M34 58 L17 47 L35 67 Z M86 58 L103 47 L85 67 Z" fill="#ffe0c7"/></g>
      ${head('#ffe0c7')}
      <path ${OUT} d="M33 56 Q34 31 60 31 Q86 31 87 56 Q78 42 64 42 Q60 50 50 46 Q40 46 33 56 Z" fill="#f3d27a"/>
      <path class="o pc" d="M31 50 Q30 22 60 20 Q90 22 89 50 Q84 34 60 32 Q36 34 31 50 Z"/>
      ${blush}
      ${faces('#2c6b3a', smile)}
      <g class="bow">
        <path d="M88 70 Q106 98 88 126" fill="none" stroke="#151827" stroke-width="7" stroke-linecap="round"/>
        <path d="M88 70 Q106 98 88 126" fill="none" stroke="#b07a3e" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M88 70 L88 126" stroke="#e8e2d0" stroke-width="1.3"/>
        ${hand(93, 98, '#ffe0c7')}
      </g>
      <g class="nock"><path d="M64 98 L100 98" stroke="#151827" stroke-width="4" stroke-linecap="round"/><path d="M64 98 L100 98" stroke="#c9a26a" stroke-width="2"/>
        <path ${OUT} d="M104 98 L98 94.5 L99.5 98 L98 101.5 Z" fill="#dfe4ee" stroke-width="1.5"/>${hand(68, 99, '#ffe0c7')}</g>
      <g transform="translate(64 98)"><g class="proj"><path d="M0 0 L36 0" stroke="#151827" stroke-width="4" stroke-linecap="round"/><path d="M0 0 L36 0" stroke="#c9a26a" stroke-width="2"/>
        <path d="M40 0 L34 -3.5 L35.5 0 L34 3.5 Z" fill="#dfe4ee" stroke="#151827" stroke-width="1.2"/></g></g>
      <g class="flash twang"><path d="M84 86 L78 82 M84 110 L78 114 M80 98 L72 98" stroke="#fff4b0" stroke-width="2.4" stroke-linecap="round"/></g>`),

    // 🧨 폭탄: 폭파 전문가 — 빨간 모히칸 + 큰 고글 + 플레이어 색 목수건 + 작업복 + 폭탄
    bomber: () => {
      const bomb = cls => `<g class="${cls}"><circle ${OUT} cx="0" cy="0" r="10" fill="#2a2d3a"/><circle cx="-3.5" cy="-3.5" r="2.6" fill="#fff" opacity=".45"/>
        <path d="M5 -8 Q9 -14 13 -16" stroke="#c9a26a" stroke-width="2.4" fill="none" stroke-linecap="round"/><g class="spark"><circle cx="14" cy="-17" r="3.2" fill="#ffe14d"/><circle cx="14" cy="-17" r="1.5" fill="#fff"/></g></g>`;
      return wrap('bomber', `
      ${legs('#4a4f63')}
      ${torso('#5d6b8a')}
      <path d="M41 97 L79 97 L79 103 L41 103 Z" fill="#ffcb3d"/>
      <path d="M46 97 L42 103 M54 97 L50 103 M62 97 L58 103 M70 97 L66 103 M78 97 L74 103" stroke="#151827" stroke-width="2.4"/>
      <rect x="40" y="80" width="40" height="36" rx="14" fill="none" class="o"/>
      ${hand(42, 104, SKIN.c)}
      ${head(SKIN.c)}
      <path ${OUT} d="M51 36 L54 17 L59 29 L62 14 L66 29 L70 18 L70 37 Q60 32 51 36 Z" fill="#e0452b"/>
      <path class="o pc" d="M39 79 Q60 90 81 79 L81 87 Q60 98 39 87 Z"/>
      <path class="o pc" d="M40 84 L30 92 L38 94 Z"/>
      <g class="soot" opacity=".55"><ellipse cx="43" cy="70" rx="5" ry="2.5" fill="#3a3a3a"/><ellipse cx="77" cy="72" rx="4" ry="2" fill="#3a3a3a"/></g>
      ${faces('#151827', grin)}
      <path d="M33 47 Q60 40 87 47" stroke="#151827" stroke-width="4" fill="none"/>
      <circle ${OUT} cx="49" cy="45" r="7.5" fill="#ffb84d"/><circle ${OUT} cx="71" cy="45" r="7.5" fill="#ffb84d"/>
      <circle cx="46.5" cy="42.5" r="2.2" fill="#fff" opacity=".8"/><circle cx="68.5" cy="42.5" r="2.2" fill="#fff" opacity=".8"/>
      <g class="arm-throw">
        <rect ${OUT} x="74" y="84" width="10" height="20" rx="5" fill="#5d6b8a"/>
        <g transform="translate(84 100)">${bomb('held')}</g>
        ${hand(80, 104, SKIN.c)}
      </g>
      <g transform="translate(86 96)">${bomb('proj')}</g>
      <g class="flash boom"><circle cx="146" cy="100" r="18" fill="#ff9f43" opacity=".8"/><circle cx="146" cy="100" r="9" fill="#ffe07a"/>
        <path d="M146 76 L146 70 M168 100 L174 100 M124 100 L118 100 M162 84 L166 80 M130 84 L126 80" stroke="#ffb35c" stroke-width="3" stroke-linecap="round"/></g>`);
    },

    // 🧛 흡혈: 높은 깃 망토 (안감이 플레이어 색) + 빨간 눈 + 송곳니
    vampire: () => wrap('vampire', `
      <g class="cape">
        <path ${OUT} d="M38 76 Q20 104 26 130 L94 130 Q100 104 82 76 Z" fill="#1d1830"/>
        <path class="pc" d="M42 80 Q28 104 33 126 L87 126 Q92 104 78 80 Z" opacity=".95"/>
      </g>
      ${legs('#1d1830')}
      ${torso('#2a2140')}
      <path ${OUT} d="M52 81 L60 96 L68 81 Z" fill="#f4f1ff"/>
      <path ${OUT} d="M55 87 L60 92 L65 87 L60 84 Z" fill="#c21d3a"/>
      <path ${OUT} d="M28 44 L40 70 L50 76 Z M92 44 L80 70 L70 76 Z" fill="#1d1830"/>
      ${head('#efe6ff')}
      <path ${OUT} d="M33 56 Q34 30 60 30 Q86 30 87 56 Q80 46 70 44 L60 54 L50 44 Q40 46 33 56 Z" fill="#241b3a"/>
      <g class="eyes-red">${faces('#e0314b', `<path d="M54 70 Q60 74 66 70" fill="none" stroke="#151827" stroke-width="2.2" stroke-linecap="round"/><path d="M56 71 L57.5 75 L59 71.6 Z M61 71.6 L62.5 75 L64 71 Z" fill="#fff" stroke="#151827" stroke-width="1"/>`)}</g>
      ${hand(42, 104, '#efe6ff')}${hand(78, 104, '#efe6ff')}
      <g class="flash bite"><path d="M104 66 L112 58 L110 68 L122 64 L112 72 L118 80 L106 74 Z" fill="#ff3b5c" stroke="#7a0f22" stroke-width="1.5"/></g>`),
  };

  // 카드·미리보기용 한 줄 소개
  const META = {
    sniper: ['챙 넓은 모자 · 스카프 · 긴 총', '공격: 총 반동 + 총구 섬광'],
    shotgun: ['사냥꾼 · 귀덮개 모자 · 쌍발 산탄총', '공격: 크게 튀는 반동 + 세 갈래 불꽃'],
    ricochet: ['거꾸로 쓴 모자 · 새총 소년', '공격: 당겼다 놓으면 돌멩이가 지그재그로 튕김'],
    bishop: ['주교관 · 사제복 · 금빛 지팡이', '공격: 지팡이를 휘두르면 ✕ 모양 빛'],
    rook: ['성벽 투구 · 갑옷 · ＋ 방패', '공격: 방패 들고 돌진 + ＋ 모양 빛'],
    knight: ['깃털 투구 · 기사 · 검', '공격: 위로 뛰었다 옆으로 내려찍기 (L자)'],
    king: ['왕관 · 망토 · 콧수염 · 홀', '공격: 앞으로 돌진해 홀로 바닥을 쾅 → 둥근 충격'],
    mortar: ['철모 · 고글 · 군복 · 박격포', '공격: 포탄이 하늘로 쏘아 올라감 + 연기'],
    scatter: ['페도라 · 선글라스 · 정장 · 기관단총', '공격: 두두두 연사 + 여기저기 섬광'],
    queen: ['티아라 · 긴 머리 · 드레스 · 별 지팡이', '공격: 지팡이를 들면 8방향 별빛'],
    laser: ['우주 헬멧 · 안테나 · 우주복 · 광선총', '공격: 기를 모았다가 광선 발사'],
    spear: ['스파르타 투구 · 볏 · 망토 · 긴 창', '공격: 뒤로 뺐다가 힘껏 찌르기'],
    chain: ['번개 맞은 머리 · 고글 · 가운 · 테슬라 막대', '공격: 번개가 연달아 두 번 번쩍'],
    whirl: ['상투 · 머리띠 · 도복 · 카타나', '공격: 제자리에서 빙글빙글 + 바람'],
    boomerang: ['삐죽 머리 · 머리띠 · 나무 부메랑', '공격: 던졌다가 돌아오면 받기'],
    grapple: ['해적 두건 · 안대 · 갈고리 손', '공격: 갈고리를 던져 걸고 확 당기기'],
    shockwave: ['격투가 · 머리띠 · 권투 장갑', '공격: 정권 지르기 → 앞으로 퍼지는 파동'],
    homing: ['고깔모자 · 동그란 안경 · 별 로브', '공격: 구슬 두 개가 휘어져 날아감'],
    vampire: ['높은 깃 망토 · 빨간 눈 · 송곳니', '공격: 달려들며 망토를 활짝'],
    assassin: ['닌자 · 복면 · 목도리 · 단검', '공격: 연기와 함께 사라졌다가 튀어나와 베기'],
    poison: ['역병 의사 · 부리 가면 · 독병', '공격: 독병을 던지면 초록 독이 퍼짐'],
    archer: ['엘프 · 금발 · 뾰족 귀 · 활', '공격: 시위를 당겼다 놓으면 화살이 쭉'],
    bomber: ['폭파 전문가 · 모히칸 · 고글 · 폭탄', '공격: 폭탄을 던지면 콰광'],
  };

  const STATES = ['idle', 'attack', 'hit', 'ko', 'win'];
  const ONE_SHOT = { attack: 1400, hit: 650, win: 1150 };
  let cssDone = false;
  function css() {
    if (cssDone || typeof document === 'undefined') return;
    cssDone = true;
    const s = document.createElement('style');
    s.id = 'chars-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  const Chars = {
    keys: Object.keys(DRAW),
    meta: META,
    ONE_SHOT,
    has: k => !!DRAW[k],
    /** 직업 캐릭터 SVG 문자열 (없는 직업이면 '') */
    svg(k) { css(); return DRAW[k] ? DRAW[k]() : ''; },
    /** 동작 재생. 공격·맞음·승리는 끝나면 가만히로 돌아가고, 탈락은 쓰러진 채로 */
    play(svg, st) {
      if (!svg || !STATES.includes(st)) return;
      clearTimeout(svg._chT);
      svg.classList.remove(...STATES.map(s => 'st-' + s));
      void svg.getBoundingClientRect();   // 같은 동작을 연달아 해도 다시 재생
      svg.classList.add('st-' + st);
      if (ONE_SHOT[st]) svg._chT = setTimeout(() => Chars.play(svg, 'idle'), ONE_SHOT[st]);
    },
  };
  window.Chars = Chars;
})();
