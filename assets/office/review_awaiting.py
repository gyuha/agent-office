"""Compose awaiting poses (7 actors x 3 frames) between desk layers + question bubble -> review/awaiting-compose.png."""
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np, json
R = Path(__file__).resolve().parent
M = json.loads((R / 'manifest.json').read_text())
def sheet(id, i):
    s = M['sheets'][id]; im = Image.open(R / 'src/sheets' / (id + '.png')).convert('RGBA')
    return im.crop((i * s['frameW'], 0, (i + 1) * s['frameW'], s['frameH']))
def compose(p, actor, frame, pad=110, state='awaiting', bubble=True):
    w, h = M['assets'][p['back']]['size']
    out = Image.new('RGBA', (w, h + pad + 20))
    out.alpha_composite(Image.open(R / M['assets'][p['back']]['sourceFile']).convert('RGBA'), (0, pad))
    a = sheet(M['actors'][actor][state], frame)
    f = p['actorHeight'] / 216; adj = p['actorOffsets'][actor][state]
    x = round(p['seat'][0] - p['actorAnchor'][0] * f + adj[0]); y = round(p['seat'][1] - p['actorAnchor'][1] * f + p['actorStateYOffset'][state] + adj[1]) + pad
    size = (round(160 * f), round(216 * f)); layer = Image.new('RGBA', out.size); layer.alpha_composite(a.resize(size, Image.Resampling.LANCZOS), (x, y))
    layer.paste((0, 0, 0, 0), (0, p['tableRearY'] + pad + 2, w, out.height)); out.alpha_composite(layer)
    out.alpha_composite(Image.open(R / M['assets'][p['front']]['sourceFile']).convert('RGBA'), (0, pad))
    if state == 'working':
        ov = sheet(M['armOverlays'][actor]['working'], frame); out.alpha_composite(Image.new('RGBA', out.size), (0, 0)); lay = Image.new('RGBA', out.size); lay.alpha_composite(ov.resize(size, Image.Resampling.LANCZOS), (x, y)); out.alpha_composite(lay)
    if not bubble: return out
    al = np.array(a.getchannel('A')); ht = next(r for r in range(216) if (al[r] > 32).sum() >= 18)
    hx = np.where(al[ht + 2] > 32)[0].mean()
    hc = (x + hx * f, y + ht * f)
    b = sheet('question_bubble', frame); bs = M['effectPlacement']['question_bubble']['preferredDisplayHeight'] / 96
    b = b.resize((round(128 * bs), round(96 * bs)), Image.Resampling.LANCZOS)
    out.alpha_composite(b, (round(hc[0] - M['sheets']['question_bubble']['anchor'][0] * bs), round(hc[1] - 10 - M['sheets']['question_bubble']['anchor'][1] * bs)))
    return out
W, H = 360, 400
review = Image.new('RGB', (W * 3, H * 7), (242, 229, 207)); d = ImageDraw.Draw(review)
rows = [(M['pods'][str(i % 3)], f'actor-{i}') for i in range(6)] + [(M['leadDesks']['small'], 'orchestrator')]
for r, (p, actor) in enumerate(rows):
    for fr in range(3):
        im = compose(p, actor, fr); im.thumbnail((W - 5, H - 30), Image.Resampling.LANCZOS)
        review.paste(im, (fr * W, r * H + 25), im); d.text((fr * W + 4, r * H + 4), f'{actor} awaiting f{fr}', fill='black')
review.save(R / 'review/awaiting-compose.png'); print(review.size)

# awaiting-vs-working: working f0 | awaiting f0..f2 on the same desk layers (no bubble), for chair-back / shoulder height comparison
W, H = 300, 330
cmp = Image.new('RGB', (W * 4, H * 7), (242, 229, 207)); d = ImageDraw.Draw(cmp)
for r, (p, actor) in enumerate(rows):
    for c, (st, fr) in enumerate([('working', 0), ('awaiting', 0), ('awaiting', 1), ('awaiting', 2)]):
        im = compose(p, actor, fr, state=st, bubble=False); im.thumbnail((W - 5, H - 25), Image.Resampling.LANCZOS)
        cmp.paste(im, (c * W, r * H + 22), im); d.text((c * W + 4, r * H + 4), f'{actor} {st} f{fr}', fill='black')
cmp.save(R / 'review/awaiting-vs-working.png'); print(cmp.size)

# awaiting-seated-compare: working f0 | awaiting f0..f2, same desk + chair layers, crop to the chair/desk area (seat-height check)
cmp = Image.new('RGB', (W * 4, 300 * 7), (242, 229, 207)); d = ImageDraw.Draw(cmp)
for r, (p, actor) in enumerate(rows):
    for c, (st, fr) in enumerate([('working', 0), ('awaiting', 0), ('awaiting', 1), ('awaiting', 2)]):
        im = compose(p, actor, fr, pad=150, state=st, bubble=False)
        top = 150 - 60; im = im.crop((0, top, min(im.width, 420), top + 60 + p['tableRearY'] + 70)); im.thumbnail((W - 5, 275), Image.Resampling.LANCZOS)
        cmp.paste(im, (c * W, r * 300 + 22), im); d.text((c * W + 4, r * 300 + 4), f'{actor} {st} f{fr}', fill='black')
cmp.save(R / 'review/awaiting-seated-compare.png'); print(cmp.size)
