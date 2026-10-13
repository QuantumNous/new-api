from __future__ import annotations

import sys
import threading
import webbrowser

sys.dont_write_bytecode = True

from app import app  # noqa: E402


if __name__ == "__main__":
    threading.Timer(1.0, lambda: webbrowser.open("http://127.0.0.1:7860")).start()
    app.run(host="127.0.0.1", port=7860, debug=False)
