"""Local GPU benchmark using an existing image; never calls generation APIs."""
import json
import sys
import threading
import time
import tempfile
from pathlib import Path
from PIL import Image
from gpu_render import render

root = Path(sys.argv[1])
sys.path.insert(0, str(root))
from upscale import upscale

with tempfile.TemporaryDirectory(prefix='upscale-compare-') as folder:
    folder = Path(folder)
    for target in (2048, 4096):
        old = folder / ('old-%s.png' % target)
        old_wire = folder / ('old-%s.webp' % target)
        new = folder / ('new-%s.webp' % target)
        tick = time.monotonic()
        upscale(root/'user-b467d84f.png', old, target)
        with Image.open(old) as im:
            im.save(old_wire, 'WEBP', lossless=True, method=4)
        old_seconds = time.monotonic()-tick
        tick = time.monotonic()
        stages = render(root/'user-b467d84f.png', new, target, threading.Lock(), root)
        new_seconds = time.monotonic()-tick
        with Image.open(old) as a, Image.open(new) as b:
            equal = a.size == b.size and a.convert('RGB').tobytes() == b.convert('RGB').tobytes()
        print(json.dumps(dict(target=target, old_s=round(old_seconds,3), new_s=round(new_seconds,3), old_bytes=old_wire.stat().st_size, new_bytes=new.stat().st_size, pixels_equal=equal, stages=stages)), flush=True)
        if not equal:
            raise RuntimeError('Pixel mismatch')
