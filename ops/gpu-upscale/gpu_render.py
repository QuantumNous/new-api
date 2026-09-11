"""Same x4plus pixels, without re-encoding an intermediate output PNG."""
import subprocess
import tempfile
import time
from pathlib import Path
from PIL import Image, ImageOps


def render(source, destination, target, gpu_lock, root=None):
    root = Path(root) if root else Path(__file__).resolve().parent.parent
    destination = Path(destination)
    timings = {}
    tick = time.monotonic()
    with Image.open(source) as original:
        if original.width * original.height > 4_194_304:
            raise ValueError('Input exceeds 4 megapixels')
        im = ImageOps.exif_transpose(original).convert('RGB')
    if target not in (2048, 4096) or target > max(im.size) * 4:
        raise ValueError('Invalid target')
    size = tuple(max(1, round(v * target / max(im.size))) for v in im.size)
    with tempfile.TemporaryDirectory(prefix='gpu-pipeline-') as tmp:
        inp, out = Path(tmp)/'input.png', Path(tmp)/'output.png'
        im.save(inp, compress_level=1)
        timings['prepare_s'] = round(time.monotonic()-tick, 3)
        tick = time.monotonic()
        with gpu_lock:
            timings['gpu_wait_s'] = round(time.monotonic()-tick, 3)
            tick = time.monotonic()
            result = subprocess.run([
                str(root/'engine/realesrgan-ncnn-vulkan.exe'),
                '-i', str(inp), '-o', str(out), '-m', str(root/'engine/models'),
                '-n', 'realesrgan-x4plus', '-s', '4', '-t', '256', '-j', '1:1:1',
            ], capture_output=True, timeout=600)
            timings['engine_s'] = round(time.monotonic()-tick, 3)
        if result.returncode or not out.exists():
            raise RuntimeError('GPU engine failed')
        tick = time.monotonic()
        with Image.open(out) as enhanced:
            final = enhanced.resize(size, Image.Resampling.LANCZOS) if enhanced.size != size else enhanced
            part = destination.with_suffix(destination.suffix+'.tmp')
            final.save(part, 'WEBP', lossless=True, method=0)
            part.replace(destination)
        timings['encode_s'] = round(time.monotonic()-tick, 3)
    return timings
