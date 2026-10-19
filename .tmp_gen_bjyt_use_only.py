#!/usr/bin/env python3
"""Import ONLY one settlement customer (default: cust_bjyt_use). Never wipes other cust_*."""
from __future__ import annotations

import bisect
import json
import os
import random
import secrets
import subprocess
import sys
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import bcrypt

# Reuse helpers by importing sibling module if present, else inline minimal copy
SPEC = Path("/tmp/settlement_spec_v3.json")
WORKDIR = Path("/tmp/settlement_v3")
LOAD_DIR = "/var/lib/mysql-files"
QUOTA_PER_UNIT = 500_000.0
TZ = timezone(timedelta(hours=8))
START = datetime(2026, 9, 1, 0, 0, 0, tzinfo=TZ)
END = datetime(2026, 9, 30, 23, 59, 59, tzinfo=TZ)
ONLY_USER = os.environ.get("SETTLEMENT_ONLY_USER", "cust_bjyt_use")
MIN_FREE_GB = float(os.environ.get("SETTLEMENT_MIN_FREE_GB", "8"))


def mysql(sql: str, input_bytes: bytes | None = None) -> str:
    p = subprocess.run(
        [
            "docker",
            "exec",
            "-i",
            "mysql",
            "sh",
            "-c",
            'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 --batch --raw --skip-column-names',
        ],
        input=(input_bytes if input_bytes is not None else sql.encode("utf-8")),
        capture_output=True,
    )
    if p.returncode != 0:
        raise RuntimeError(p.stderr.decode("utf-8", errors="replace") or p.stdout.decode())
    return p.stdout.decode("utf-8", errors="replace")


def sql_str(s: str) -> str:
    return "'" + s.replace("\\", "\\\\").replace("'", "''") + "'"


def clean_tsv(s: str) -> str:
    return s.replace("\t", " ").replace("\n", " ").replace("\r", " ")


def free_gb(path: str = "/") -> float:
    st = os.statvfs(path)
    return st.f_bavail * st.f_frsize / (1024**3)


def ensure_disk(label: str) -> None:
    free = free_gb("/")
    print(f"  disk free {free:.1f}G ({label})", flush=True)
    if free < MIN_FREE_GB:
        raise RuntimeError(f"disk too low before {label}: {free:.1f}G < {MIN_FREE_GB}G")


def purge_binlogs() -> None:
    try:
        mysql("PURGE BINARY LOGS BEFORE NOW();")
        print("  purged binary logs", flush=True)
    except Exception as e:
        print(f"  purge binlogs skipped: {e}", flush=True)


def day_weight(dt: datetime) -> float:
    wd = dt.weekday()
    if wd == 5:
        return 0.40
    if wd == 6:
        return 0.30
    return 1.0


def hour_weight(h: int) -> float:
    table = {
        0: 0.08, 1: 0.06, 2: 0.05, 3: 0.05, 4: 0.06, 5: 0.10,
        6: 0.25, 7: 0.45, 8: 0.85, 9: 1.0, 10: 1.0, 11: 0.95,
        12: 0.55, 13: 0.75, 14: 0.95, 15: 1.0, 16: 1.0, 17: 0.90,
        18: 0.70, 19: 0.55, 20: 0.45, 21: 0.35, 22: 0.22, 23: 0.12,
    }
    return table.get(h, 0.3)


def build_slot_weights(rng: random.Random):
    slots = []
    weights = []
    d = START
    while d <= END:
        w = day_weight(d) * hour_weight(d.hour) * rng.uniform(0.85, 1.15)
        slots.append(d)
        weights.append(max(w, 0.01))
        d += timedelta(hours=1)
    cum = []
    acc = 0.0
    for w in weights:
        acc += w
        cum.append(acc)
    return slots, cum


def pick_slot(slots, cum, rng: random.Random) -> datetime:
    r = rng.uniform(0, cum[-1])
    i = bisect.bisect_left(cum, r)
    if i >= len(slots):
        i = len(slots) - 1
    return slots[i] + timedelta(seconds=rng.randint(0, 3599))


def split_amounts(total: float, low: float, high: float, rng: random.Random) -> list[float]:
    if total <= 0:
        return []
    parts: list[float] = []
    rem = total
    band_lo = low + (high - low) * 0.30
    band_hi = low + (high - low) * 0.70
    while rem > high + 1e-9:
        p = rng.uniform(band_lo, band_hi)
        if rng.random() < 0.12:
            p = rng.uniform(low, band_lo)
        elif rng.random() < 0.12:
            p = rng.uniform(band_hi, high)
        parts.append(round(p, 4))
        rem -= p
    if rem > 1e-9:
        if rem < low * 0.5 and parts:
            parts[-1] = round(parts[-1] + rem, 4)
        elif rem < low and parts and parts[-1] + rem <= high * 1.05:
            parts[-1] = round(parts[-1] + rem, 4)
        else:
            parts.append(round(rem, 4))
    drift = total - sum(parts)
    if parts and abs(drift) > 1e-6:
        parts[-1] = round(parts[-1] + drift, 4)
    return parts


def tokens_for_video(yuan: float, price_in: float) -> tuple[int, int, int]:
    if price_in <= 0:
        return 0, 0, 0
    tokens = int(round(yuan / price_in * 1_000_000))
    return max(1000, tokens), 0, 0


def tokens_for_text(
    yuan, price_in, price_out, price_cache, share_in, share_out, share_cache, rng
) -> tuple[int, int, int]:
    s = share_in + share_out + share_cache
    if s <= 0 or price_in <= 0:
        return tokens_for_video(yuan, price_in)[0], 0, 0
    wi = max(0.05, share_in / s * rng.uniform(0.85, 1.15))
    wo = max(0.0, share_out / s * rng.uniform(0.85, 1.15))
    wc = max(0.0, share_cache / s * rng.uniform(0.85, 1.15))
    wsum = wi + wo + wc
    wi, wo, wc = wi / wsum, wo / wsum, wc / wsum
    yin, yout, ycache = yuan * wi, yuan * wo, yuan * wc
    tin = int(round(yin / price_in * 1_000_000)) if price_in > 0 else 0
    tout = int(round(yout / price_out * 1_000_000)) if price_out > 0 and yout > 0 else 0
    tcache = int(round(ycache / price_cache * 1_000_000)) if price_cache > 0 and ycache > 0 else 0
    max_in = 120_000
    if tin > max_in:
        scale = max_in / tin
        tin = max_in
        tout = int(tout * scale)
        tcache = int(tcache * scale)
    tin = max(tin, 400)
    if tout > 16_000:
        tout = int(tout * rng.uniform(0.35, 0.7))
    return tin, tout, tcache


def load_tsv(table: str, remote_path: str, columns: str) -> int:
    out = mysql(
        f"""USE `new-api`;
LOAD DATA INFILE '{remote_path}'
INTO TABLE {table}
CHARACTER SET utf8mb4
FIELDS TERMINATED BY '\\t'
LINES TERMINATED BY '\\n'
({columns});
SELECT ROW_COUNT();
"""
    )
    lines = [ln.strip() for ln in out.strip().splitlines() if ln.strip()]
    if not lines:
        return 0
    try:
        return int(lines[-1])
    except ValueError:
        return 0


def main():
    if len(sys.argv) > 1:
        global ONLY_USER
        ONLY_USER = sys.argv[1]
    print(f"ONLY_USER={ONLY_USER}", flush=True)
    ensure_disk("start")
    purge_binlogs()

    spec = json.loads(SPEC.read_text(encoding="utf-8"))
    cust = next((c for c in spec["customers"] if c["username"] == ONLY_USER), None)
    if not cust:
        raise SystemExit(f"customer {ONLY_USER} not in spec")
    # preserve original index for RNG seed stability with full run
    ci = next(i for i, c in enumerate(spec["customers"]) if c["username"] == ONLY_USER)

    WORKDIR.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(["docker", "exec", "mysql", "mkdir", "-p", LOAD_DIR])
    pwd_hash = bcrypt.hashpw(spec["password"].encode(), bcrypt.gensalt(rounds=10)).decode()
    v_lo, v_hi = spec["video_price_range"]
    t_lo, t_hi = spec["text_price_range"]

    ch_id = int(mysql("USE `new-api`; SELECT id FROM channels WHERE name='结算导入渠道' LIMIT 1;").strip().splitlines()[-1])

    # safety: never touch other cust_*
    others = mysql(
        "USE `new-api`; SELECT username, "
        "(SELECT COUNT(*) FROM logs l WHERE l.username=u.username AND l.type=2) "
        "FROM users u WHERE username LIKE 'cust_%' AND username<>" + sql_str(ONLY_USER) + ";"
    )
    print("other customers before (must stay):\n" + others, flush=True)

    rng = random.Random(20260924 + ci)
    username = cust["username"]
    display = cust["display"][:20]
    total_amount = float(cust["total_amount"])
    remain = int(round(total_amount * 0.05 * QUOTA_PER_UNIT))
    created_at = int(START.timestamp())
    slots, cum = build_slot_weights(rng)

    print(f"\n=== {username} target ¥{total_amount:,.2f} ===", flush=True)

    mysql(
        f"""USE `new-api`;
DELETE FROM logs WHERE username={sql_str(username)};
DELETE FROM quota_data WHERE username={sql_str(username)};
DELETE FROM tokens WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE username={sql_str(username)}) t);
DELETE FROM users WHERE username={sql_str(username)};
"""
    )
    mysql(
        f"""USE `new-api`;
INSERT INTO users (username, password, display_name, role, status, email, quota, used_quota, request_count, `group`, remark, created_at, last_login_at, auth_version)
VALUES ({sql_str(username)}, {sql_str(pwd_hash)}, {sql_str(display)}, 1, 1, '', {remain}, 0, 0, 'default', {sql_str(cust['remark'][:255])}, {created_at}, 0, 1);
"""
    )
    user_id = int(mysql(f"USE `new-api`; SELECT id FROM users WHERE username={sql_str(username)};").strip().splitlines()[-1])
    token_key = "sk-" + secrets.token_hex(24)
    model_list = []
    seen = set()
    for it in cust["items"]:
        if it["model"] not in seen:
            seen.add(it["model"])
            model_list.append(it["model"])
    mysql(
        f"""USE `new-api`;
INSERT INTO tokens (user_id, `key`, status, name, created_time, accessed_time, expired_time, remain_quota, unlimited_quota, model_limits_enabled, model_limits, allow_ips, used_quota, `group`)
VALUES ({user_id}, {sql_str(token_key)}, 1, '默认令牌', {created_at}, {created_at}, -1, {remain}, 0, 1, {sql_str(','.join(model_list))}, '', 0, '');
"""
    )
    token_id = int(mysql(f"USE `new-api`; SELECT id FROM tokens WHERE `key`={sql_str(token_key)};").strip().splitlines()[-1])
    mysql(
        f"""USE `new-api`;
INSERT INTO logs (user_id, created_at, type, content, username, token_name, model_name, quota, prompt_tokens, completion_tokens, use_time, is_stream, channel_id, token_id, `group`, ip, other)
VALUES ({user_id}, {created_at}, 1, {sql_str(f'settlement-import topup ¥{total_amount:.2f}')}, {sql_str(username)}, '', '', {int(round(total_amount*QUOTA_PER_UNIT))+remain}, 0, 0, 0, 0, 0, 0, 'default', '', {sql_str(json.dumps({"source":"settlement-import"}, ensure_ascii=False))});
"""
    )

    log_path = WORKDIR / f"logs_{username}.tsv"
    qd_map = defaultdict(lambda: {"token_used": 0, "count": 0, "quota": 0})
    request_count = 0
    used_quota = 0
    price_stats = {"video": [], "text": []}
    expected_rows = 0

    with log_path.open("w", encoding="utf-8", newline="\n") as f:
        for it in cust["items"]:
            model = it["model"]
            mr = (it["price_in"] / 2.0) if it["price_in"] > 0 else 0.0
            cr = (it["price_out"] / it["price_in"]) if it["price_in"] > 0 and it["price_out"] > 0 else 1.0
            car = (it["price_cache"] / it["price_in"]) if it["price_in"] > 0 and it["price_cache"] > 0 else 1.0
            share_in = it["qty_in_m"] * it["price_in"]
            share_out = it["qty_out_m"] * it["price_out"]
            share_cache = it["qty_cache_m"] * it["price_cache"]
            low, high = (v_lo, v_hi) if it["is_video"] else (t_lo, t_hi)
            parts = split_amounts(it["amount"], low, high, rng)
            print(
                f"  {model[:48]} ¥{it['amount']:.2f} → {len(parts)} reqs, avg ¥{it['amount']/max(len(parts),1):.2f}",
                flush=True,
            )
            row_buf = []
            for pi_amt in parts:
                when = pick_slot(slots, cum, rng)
                ts = int(when.timestamp())
                if it["is_video"]:
                    tin, tout, tcache = tokens_for_video(pi_amt, it["price_in"])
                    tin = max(1000, int(tin * rng.uniform(0.97, 1.03)))
                    use_time = rng.randint(8, 18)
                    is_stream = 0
                    other = {
                        "group_ratio": 1,
                        "model_ratio": round(mr, 8),
                        "completion_ratio": 1,
                        "cache_ratio": 1,
                        "cache_tokens": 0,
                        "is_task": True,
                        "seconds": use_time,
                        "settlement_import": True,
                        "settlement_context": it["context"],
                        "settlement_price_in": it["price_in"],
                    }
                    price_stats["video"].append(pi_amt)
                else:
                    tin, tout, tcache = tokens_for_text(
                        pi_amt,
                        it["price_in"],
                        it["price_out"],
                        it["price_cache"],
                        share_in,
                        share_out,
                        share_cache,
                        rng,
                    )
                    use_time = rng.randint(1, 45)
                    is_stream = 1 if rng.random() < 0.62 else 0
                    other = {
                        "group_ratio": 1,
                        "model_ratio": round(mr, 8),
                        "completion_ratio": round(cr, 8),
                        "cache_ratio": round(car, 8),
                        "cache_tokens": tcache,
                        "settlement_import": True,
                        "settlement_context": it["context"],
                        "settlement_price_in": it["price_in"],
                        "settlement_price_out": it["price_out"],
                        "settlement_price_cache": it["price_cache"],
                    }
                    price_stats["text"].append(pi_amt)
                q = int(round(pi_amt * QUOTA_PER_UNIT))
                row_buf.append((ts, model, q, tin, tout, use_time, is_stream, other, tin + tout + tcache))

            got = sum(r[2] for r in row_buf)
            want = int(round(it["amount"] * QUOTA_PER_UNIT))
            if row_buf and got != want:
                last = list(row_buf[-1])
                last[2] = max(1, last[2] + (want - got))
                row_buf[-1] = tuple(last)

            for ts, model, q, tin, tout, use_time, is_stream, other, tu in row_buf:
                rid = uuid.uuid4().hex[:24]
                ip = f"10.{rng.randint(1, 40)}.{rng.randint(0, 255)}.{rng.randint(2, 254)}"
                other_s = clean_tsv(json.dumps(other, ensure_ascii=False, separators=(",", ":")))
                f.write(
                    "\t".join(
                        [
                            str(user_id),
                            str(ts),
                            "2",
                            "settlement-import",
                            clean_tsv(username),
                            "默认令牌",
                            clean_tsv(model),
                            str(q),
                            str(tin),
                            str(tout),
                            str(use_time),
                            "1" if is_stream else "0",
                            str(ch_id),
                            str(token_id),
                            "default",
                            ip,
                            rid,
                            other_s,
                        ]
                    )
                    + "\n"
                )
                expected_rows += 1
                request_count += 1
                used_quota += q
                hour_ts = ts - (ts % 3600)
                m64 = model[:64]
                qd_map[(m64, hour_ts)]["quota"] += q
                qd_map[(m64, hour_ts)]["count"] += 1
                qd_map[(m64, hour_ts)]["token_used"] += tu

    tsv_mb = log_path.stat().st_size / (1024 * 1024)
    print(f"  tsv size={tsv_mb:.0f}MB rows={expected_rows}", flush=True)
    purge_binlogs()
    ensure_disk("before_load")

    remote_logs = f"{LOAD_DIR}/{log_path.name}"
    subprocess.check_call(["docker", "cp", str(log_path), f"mysql:{remote_logs}"])
    # free host copy ASAP
    try:
        log_path.unlink()
    except Exception:
        pass

    loaded = load_tsv(
        "logs",
        remote_logs,
        "user_id, created_at, type, content, username, token_name, model_name, quota, prompt_tokens, completion_tokens, use_time, is_stream, channel_id, token_id, `group`, ip, request_id, other",
    )
    subprocess.call(["docker", "exec", "mysql", "rm", "-f", remote_logs])
    purge_binlogs()

    cnt = int(
        mysql(
            f"USE `new-api`; SELECT COUNT(*) FROM logs WHERE username={sql_str(username)} AND type=2;"
        )
        .strip()
        .splitlines()[-1]
    )
    print(f"  LOAD ROW_COUNT={loaded} verify type=2={cnt} expected={expected_rows}", flush=True)
    if cnt < expected_rows * 0.98:
        raise RuntimeError(f"LOAD DATA incomplete for {username}: got {cnt} expected {expected_rows}")

    qd_path = WORKDIR / f"qd_{username}.tsv"
    with qd_path.open("w", encoding="utf-8", newline="\n") as f:
        for (model, hour_ts), v in qd_map.items():
            f.write(
                "\t".join(
                    [
                        str(user_id),
                        clean_tsv(username),
                        clean_tsv(model),
                        str(hour_ts),
                        str(v["token_used"]),
                        str(v["count"]),
                        str(v["quota"]),
                    ]
                )
                + "\n"
            )
    remote_qd = f"{LOAD_DIR}/{qd_path.name}"
    subprocess.check_call(["docker", "cp", str(qd_path), f"mysql:{remote_qd}"])
    try:
        qd_path.unlink()
    except Exception:
        pass
    load_tsv(
        "quota_data",
        remote_qd,
        "user_id, username, model_name, created_at, token_used, count, quota",
    )
    subprocess.call(["docker", "exec", "mysql", "rm", "-f", remote_qd])

    mysql(
        f"""USE `new-api`;
UPDATE users SET used_quota={used_quota}, request_count={request_count}, quota={remain} WHERE id={user_id};
UPDATE tokens SET used_quota={used_quota}, remain_quota={remain} WHERE id={token_id};
"""
    )
    for m in model_list:
        mysql(
            f"""USE `new-api`;
INSERT INTO abilities (`group`, model, channel_id, enabled, priority)
SELECT 'default', {sql_str(m)}, {ch_id}, 1, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM abilities WHERE `group`='default' AND model={sql_str(m)} AND channel_id={ch_id});
"""
        )

    def stat(xs):
        if not xs:
            return None
        return {"n": len(xs), "min": round(min(xs), 2), "max": round(max(xs), 2), "avg": round(sum(xs) / len(xs), 2)}

    # verify others untouched
    others_after = mysql(
        "USE `new-api`; SELECT username, "
        "(SELECT COUNT(*) FROM logs l WHERE l.username=u.username AND l.type=2) "
        "FROM users u WHERE username LIKE 'cust_%' ORDER BY username;"
    )
    print("all customers after:\n" + others_after, flush=True)

    summary = {
        "username": username,
        "token_key": token_key,
        "used_yuan": round(used_quota / QUOTA_PER_UNIT, 2),
        "expect_yuan": total_amount,
        "request_count": request_count,
        "loaded_logs": cnt,
        "video_price_stat": stat(price_stats["video"]),
        "text_price_stat": stat(price_stats["text"]),
    }
    Path("/tmp/settlement_bjyt_use_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2), flush=True)
    print("ALL DONE ONE USER", flush=True)


if __name__ == "__main__":
    main()
