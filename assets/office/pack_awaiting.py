"""Pack the awaiting (question) pose rows and the question_bubble row.

Only touches src/sheets/<id>-awaiting.png, src/sheets/question_bubble.png and the
manifest entries for them (sheets, actors.*.awaiting, effects, effectPlacement,
pods/leadDesks awaiting seat keys). Existing sheets are never rewritten.
Also writes the runtime WebP/GIF for the new sheets itself; do NOT run export_runtime.py (it deletes the provider-icon WebP files).
"""
from pathlib import Path
from PIL import Image
import numpy as np, json

R = Path(__file__).resolve().parent
M = json.loads((R / 'manifest.json').read_text())
FW, FH, ANCHOR = 160, 216, [80, 205]
ACTORS = [f'actor-{i}' for i in range(6)] + ['orchestrator']
CUTS = [0, 341, 683, 1024]
HEAD_TOP_Y = 22          # head top row inside the 160x216 frame (hand rises ~6px above it)
details = {}


def alpha(im):
    return np.array(im.getchannel('A'))


def head_top(a, thr=60):
    return next(y for y in range(a.shape[0]) if (a[y] > 32).sum() >= thr)


def body_metrics(fr_img):
    """(head top y, shoulder y, torso y) of one 160x216 frame, alpha only, in frame px.
    Mass is counted inside +-50 px of the head column and above the desk line (y<125);
    shoulder = row where 25% of that mass (counted from the head top) is reached, torso = 50% row.
    The raised hand beside the head barely changes these rows, so they are comparable with working."""
    al = np.array(fr_img.convert('RGBA'))[..., 3] > 32
    ht = next(y for y in range(FH) if al[y].sum() >= 18)
    hx = int(np.where(al[ht:ht + 8])[1].mean())
    sub = al[:125, max(0, hx - 50):min(FW, hx + 50)]
    cum = np.cumsum(sub.sum(1)); base = cum[ht - 1] if ht else 0; tot = cum[-1] - base
    q = lambda f: int(np.searchsorted(cum - base, f * tot))
    return ht, q(.25), q(.5)


def width_at(a, y):
    xs = np.where(a[y] > 32)[0]
    return int(xs.max() - xs.min()) if len(xs) else 0


for actor in ACTORS:
    src = Image.open(R / f'src/generated/{actor}-awaiting.png').convert('RGBA')
    cells = [src.crop((CUTS[i], 0, CUTS[i + 1], src.height)) for i in range(3)]
    A = [alpha(c) for c in cells]
    tops = [head_top(a) for a in A]
    bottoms = [int(np.where(a > 32)[0].max()) for a in A]
    # working frame 0 is the scale/position reference for head size and hip column
    wk = alpha(Image.open(R / f'src/sheets/{actor}-working.png').convert('RGBA').crop((0, 0, FW, FH)))
    wt = next(y for y in range(FH) if (wk[y] > 32).sum() >= 18)
    work_w = width_at(wk, wt + 20)
    hip = float(np.where(wk[110:130] > 32)[1].mean())
    s0 = .39
    off = round(20 / s0)
    aw = np.mean([width_at(A[i], tops[i] + off) for i in (0, 2)])
    s = work_w / aw
    bottom = float(np.mean(bottoms))
    top = float(np.mean(tops))
    yb = HEAD_TOP_Y + (bottom - top) * s   # common feet baseline (may fall below the frame; legs are hidden by the desk)
    work_m = body_metrics(Image.open(R / f'src/sheets/{actor}-working.png').convert('RGBA').crop((0, 0, FW, FH)))
    shift = 0.0
    for attempt in range(2):
        sheet = Image.new('RGBA', (FW * 3, FH))
        info = []
        for i, (c, a) in enumerate(zip(cells, A)):
            box = c.getchannel('A').point(lambda v: 255 if v > 32 else 0).getbbox()
            lo = bottoms[i]
            legs = a[lo - 250:lo - 100]
            lx = float(np.where(legs > 32)[1].mean())
            part = c.crop(box).resize((round((box[2] - box[0]) * s), round((box[3] - box[1]) * s)), Image.Resampling.LANCZOS)
            x = round(hip - (lx - box[0]) * s)
            y = round(yb - shift - (box[3] - box[1]) * s)   # feet bottom (box[3]) mapped to the common baseline
            fr = Image.new('RGBA', (FW, FH))
            fr.paste(part, (x, y), part)
            sheet.alpha_composite(fr, (i * FW, 0))
            info.append({'box': list(box), 'legCenterX': lx, 'paste': [x, y]})
        ms = [body_metrics(sheet.crop((i * FW, 0, (i + 1) * FW, FH))) for i in range(3)]
        if attempt == 0:
            before = [list(m) for m in ms]
            d = [float(np.median([m[k] for m in ms])) - work_m[k] for k in range(3)]
            # raise the pose until shoulder and torso rows are no lower than working (what the chair back is judged against)
            shift = max(0, min(round(max(d[1], d[2])), (ms[0][0] - work_m[0]) + 4))   # head top may end at most 4px above working   # never lower than working; at least 3px up (user: sits too low)
    after = [list(m) for m in ms]
    hand_top = int(np.where(np.array(sheet.getchannel('A')) > 32)[0].min())
    align = {'metrics': ['headTop', 'shoulder', 'torso'], 'working': list(work_m), 'before': before, 'after': after, 'raisedBy': shift, 'handTopY': hand_top}
    sid = f'{actor}-awaiting'
    sheet.save(R / f'src/sheets/{sid}.png')
    M['sheets'][sid] = {'file': f'runtime/{sid}.webp', 'frameW': FW, 'frameH': FH, 'frames': 3, 'fps': 4, 'loop': True, 'anchor': ANCHOR}
    M['actors'][actor]['awaiting'] = sid
    details[sid] = {'alignment': align, 'scale': s, 'workingHeadWidth': work_w, 'workingHipX': hip, 'headTopY': HEAD_TOP_Y, 'frames': info}

# question bubble: common crop, bottom-center anchor, same rule as other effect rows
src = Image.open(R / 'src/generated/question_bubble-clean.png').convert('RGBA')
cells = [src.crop((CUTS[i], 0, CUTS[i + 1], src.height)) for i in range(3)]
boxes = [c.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox() for c in cells]
common = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
BW, BH, BA = 128, 96, [64, 90]
s = min((BW - 8) / (common[2] - common[0]), (BH - 10) / (common[3] - common[1]))
sheet = Image.new('RGBA', (BW * 3, BH))
for i, c in enumerate(cells):
    part = c.crop(common).resize((round((common[2] - common[0]) * s), round((common[3] - common[1]) * s)), Image.Resampling.LANCZOS)
    fr = Image.new('RGBA', (BW, BH))
    fr.alpha_composite(part, (round(BA[0] - part.width / 2), BA[1] - part.height))
    sheet.alpha_composite(fr, (i * BW, 0))
sheet.save(R / 'src/sheets/question_bubble.png')
M['sheets']['question_bubble'] = {'file': 'runtime/question_bubble.webp', 'frameW': BW, 'frameH': BH, 'frames': 3, 'fps': 4, 'loop': True, 'anchor': BA}
M['effects']['question_bubble'] = 'question_bubble'
ba = alpha(sheet.crop((0, 0, BW, BH)))
tip_y = int(np.where(ba > 32)[0].max())
tip_x = float(np.where(ba[tip_y - 2:tip_y + 1] > 32)[1].mean())
details['question_bubble'] = {'scale': s, 'commonCrop': list(common), 'tailTipFrame0': [tip_x, tip_y]}
M['effectPlacement']['question_bubble'] = {
    'sheet': 'question_bubble',
    'anchor': 'sheet.anchor bottom-center',
    'position': 'current rendered awaiting pose headTopCenter + [0,-10] logical px; replaces attention while the agent is waiting on a question',
    'preferredDisplayHeight': 64,
    'tailTipInSheetFrame0': [round(tip_x, 1), tip_y],
    'note': 'tail tip sits left of the sheet anchor; shift by (anchorX - tailTipX)*scale if the tail must point at the head',
}

# desks: awaiting is seated higher than working so the chest shows above the tabletop in front of the chair back.
# Per desk and actor the raise k (logical px, applied through actorOffsets[actor].awaiting y; actorStateYOffset.awaiting stays = working) is the smallest
# value that satisfies, in room logical px (headH = 0.9 * working head width in frame px * f; chin ~ shoulder = head top + headH):
#   (b) head top <= chair back top - 0.30*headH      (c) tabletop rear edge - shoulder >= 0.50*headH
CH = {}      # report: per desk/actor before/after
def desk_report(dname, p, actor, k):
    back = np.array(Image.open(R / M['assets'][p['back']]['sourceFile']).convert('RGBA'))[..., 3] > 40
    chair_top = int(np.where(back[:, :p['seat'][0] - 10].any(1))[0].min())
    f = p['actorHeight'] / 216
    wk = alpha(Image.open(R / f'src/sheets/{actor}-working.png').convert('RGBA').crop((0, 0, FW, FH)))
    wt = next(y for y in range(FH) if (wk[y] > 32).sum() >= 18)
    head_h = 0.9 * width_at(wk, wt + 20)
    wx, wy = p['actorOffsets'][actor]['working']
    base = p['seat'][1] - p['actorAnchor'][1] * f + p['actorStateYOffset']['working'] + wy
    sheet = Image.open(R / f'src/sheets/{actor}-awaiting.png').convert('RGBA')
    hts = [next(y for y in range(FH) if (alpha(sheet.crop((i * FW, 0, (i + 1) * FW, FH)))[y] > 32).sum() >= 18) for i in range(3)]
    ys = lambda r, kk: base + r * f - kk
    out = {'chairTop': chair_top, 'tableRear': p['tableRearY'], 'headH': round(head_h * f, 1),
           'working': {'headTop': round(ys(wt, 0), 1), 'shoulder': round(ys(wt + head_h, 0), 1)}}
    ht = max(hts)                                    # lowest head over the 3 frames = worst case
    need_b = ys(ht, 0) - (chair_top - 0.30 * head_h * f)
    need_c = 0.5 * head_h * f - (p['tableRearY'] - ys(ht + head_h, 0))
    out['awaitingBefore'] = {'headTop': round(ys(ht, 0), 1), 'shoulder': round(ys(ht + head_h, 0), 1), 'chestAboveTable': round(p['tableRearY'] - ys(ht + head_h, 0), 1)}
    kk = k if k is not None else max(0, int(np.ceil(max(need_b, need_c))))
    out['awaitingAfter'] = {'headTop': round(ys(ht, kk), 1), 'shoulder': round(ys(ht + head_h, kk), 1), 'chestAboveTable': round(p['tableRearY'] - ys(ht + head_h, kk), 1), 'raise': kk}
    return kk, out
for dname, p in list(M['pods'].items()) + [('lead-' + k, v) for k, v in M['leadDesks'].items()]:
    actors = ['orchestrator'] if dname.startswith('lead') else ACTORS[:6]
    p['actorStateYOffset']['awaiting'] = p['actorStateYOffset']['working']
    for actor in ACTORS:
        p['actorOffsets'].setdefault(actor, {})
        wx, wy = p['actorOffsets'][actor]['working']
        if actor in actors:
            kk, rep = desk_report(dname, p, actor, None)
            p['actorOffsets'][actor]['awaiting'] = [wx, wy - kk]
            CH[f'{dname}/{actor}'] = rep
        else:
            p['actorOffsets'][actor]['awaiting'] = [wx, wy]
    p['actorSourceClip']['awaiting'] = [0, 0, 160, 216]
details['seatRaise'] = CH
M['stateContract']['awaiting'] = 'needsAttention while seated at a desk: awaiting sheet replaces working/typing and its hand overlay; effects.question_bubble replaces effects.attention. Raised arm stays above the tabletop, the other arm rests behind it, so no armOverlays.awaiting is needed.'

# runtime WebP (same recipe as export_runtime.py: 5/8 scale, q85, alpha 100, method 6) + review GIF, only for the new sheets
for sid in [f'{a}-awaiting' for a in ACTORS] + ['question_bubble']:
    sp = M['sheets'][sid]; n = sp['frames']; rw, rh = sp['frameW'] * 5 // 8, sp['frameH'] * 5 // 8
    png = Image.open(R / 'src/sheets' / f'{sid}.png').convert('RGBA'); out = Image.new('RGBA', (rw * n, rh)); gif = []
    for i in range(n):
        f = png.crop((i * sp['frameW'], 0, (i + 1) * sp['frameW'], sp['frameH'])).resize((rw, rh), Image.Resampling.LANCZOS)
        out.alpha_composite(f, (i * rw, 0)); bg = Image.new('RGBA', f.size, (244, 236, 219, 255)); bg.alpha_composite(f); gif.append(bg.convert('RGB'))
    out.save(R / sp['file'], 'WEBP', quality=85, method=6, alpha_quality=100)
    gif[0].save(R / 'review' / f'{sid}.gif', save_all=True, append_images=gif[1:], duration=round(1000 / sp['fps']), loop=0, disposal=2)

(R / 'manifest.next.json').write_text(json.dumps(M, ensure_ascii=False, indent=2))
(R / 'manifest.next.json').replace(R / 'manifest.json')
(R / 'src/awaiting-alignment.json').write_text(json.dumps(details, indent=2))
print('packed', [k for k in details])
