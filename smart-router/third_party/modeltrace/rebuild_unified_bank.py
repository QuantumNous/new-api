from __future__ import annotations

import json
from pathlib import Path

from bank_builder import build_bank, read_rows


PROJECT = Path(__file__).resolve().parent
OUTPUT = PROJECT / "data" / "unified_bank.json"
SOURCES = {
    "gpt": ("GPT", PROJECT / "data" / "gpt_reference.jsonl"),
    "claude": ("Claude", PROJECT / "data" / "claude_reference.jsonl"),
}


def main() -> None:
    rows = []
    for family_id, (family_name, path) in SOURCES.items():
        rows.extend(
            {
                **row,
                "family_id": family_id,
                "family_name": family_name,
            }
            for row in read_rows(path)
        )
    bank = build_bank(rows)
    OUTPUT.write_text(
        json.dumps(bank, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "output": str(OUTPUT),
                "models": len(bank["models"]),
                "responses": sum(model["response_count"] for model in bank["models"]),
                "calibration": bank["calibration"],
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
