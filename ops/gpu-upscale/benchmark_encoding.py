import json
import sys
import tempfile
import time
from pathlib import Path
from PIL import Image

with Image.open(sys.argv[1]) as im, tempfile.TemporaryDirectory() as tmp:
    im.load()
    original = im.convert('RGB').tobytes()
    for method in (0, 1, 3, 4):
        dest = Path(tmp)/('method-%s.webp' % method)
        tick = time.monotonic()
        im.save(dest, 'WEBP', lossless=True, method=method)
        elapsed = time.monotonic()-tick
        with Image.open(dest) as restored:
            equal = restored.convert('RGB').tobytes() == original
        print(json.dumps(dict(method=method, seconds=round(elapsed,3), bytes=dest.stat().st_size, pixels_equal=equal)), flush=True)
        assert equal
