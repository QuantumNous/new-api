import os
import sys

# 阻止后续所有 Python 操作生成字节码缓存
sys.dont_write_bytecode = True
os.environ["PYTHONDONTWRITEBYTECODE"] = "1"

# 清理本轮可能已生成的 __pycache__
import shutil
from pathlib import Path

for p in Path(__file__).resolve().parents[1].rglob("__pycache__"):
    if p.is_dir():
        shutil.rmtree(p, ignore_errors=True)