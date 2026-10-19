#!/usr/bin/env python3
"""Parse Excels → compact spec for server-side realistic log generation."""
from __future__ import annotations

import json
import re
from pathlib import Path

import openpyxl

FILES = [
    {
        "path": r"e:\资料\结算单---9月北京云天&新疆逸炫.xlsx",
        "username": "cust_bjyt",
        "display": "北京云天",
        "remark": "结算:北京云天&新疆逸炫(完整)",
    },
    {
        "path": r"e:\资料\结算单---9月新疆逸炫&安徽曦腾.xlsx",
        "username": "cust_ahxt",
        "display": "安徽曦腾",
        "remark": "结算:新疆逸炫&安徽曦腾",
    },
    {
        "path": r"e:\资料\结算单---9月新疆逸炫&耘链.xlsx",
        "username": "cust_yunlian",
        "display": "耘链科技",
        "remark": "结算:新疆逸炫&耘链",
    },
    {
        "path": r"e:\资料\结算单---9月新疆逸炫&浙江天铁.xlsx",
        "username": "cust_zjtt",
        "display": "浙江天铁",
        "remark": "结算:新疆逸炫&浙江天铁",
    },
    {
        "path": r"e:\资料\用于结算单---9月_北京云天&新疆逸炫.xlsx",
        "username": "cust_bjyt_use",
        "display": "云天-用于结算",
        "remark": "用于结算单:北京云天&新疆逸炫",
    },
]


def parse_num(v):
    if v is None or v == "" or v == "/":
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace(",", "")
    if s in ("", "/", "-", "—"):
        return None
    return float(s)


def excel_model_name(raw) -> str:
    parts = [p.strip() for p in str(raw).replace("\r", "\n").split("\n") if p.strip()]
    if not parts:
        return ""
    s = parts[0]
    for p in parts[1:]:
        s += p if p.startswith(("（", "(")) else (" " + p)
    while "  " in s:
        s = s.replace("  ", " ")
    return s.strip()


def is_video_model(name: str, qty_out, qty_cache) -> bool:
    n = name.lower()
    if "seedance" in n or "seedance" in n:
        return True
    if qty_out is None and qty_cache is None:
        return True
    return False


def parse_sheet(path: str):
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.active
    items = []
    for row in ws.iter_rows(values_only=True):
        if not row or row[0] is None or str(row[1]).strip() != "月":
            continue
        name = excel_model_name(row[0])
        if not name or name.startswith(("资源", "合计")):
            continue
        context = "" if row[2] is None or str(row[2]).strip() == "/" else str(row[2]).strip()
        qty_in = parse_num(row[3])
        qty_out = parse_num(row[4])
        qty_cache = parse_num(row[5])
        price_in = parse_num(row[6]) or 0.0
        price_out = parse_num(row[7]) or 0.0
        price_cache = parse_num(row[8]) or 0.0
        amount = parse_num(row[9])
        if amount is None or amount <= 0 or qty_in is None:
            continue
        video = is_video_model(name, qty_out, qty_cache)
        items.append(
            {
                "model": name,
                "context": context,
                "qty_in_m": float(qty_in),
                "qty_out_m": float(qty_out or 0),
                "qty_cache_m": float(qty_cache or 0),
                "price_in": float(price_in),
                "price_out": float(price_out),
                "price_cache": float(price_cache),
                "amount": float(amount),
                "is_video": video,
            }
        )
    return items


def main():
    customers = []
    model_ratio = {}
    completion_ratio = {}
    cache_ratio = {}
    for meta in FILES:
        items = parse_sheet(meta["path"])
        total = sum(i["amount"] for i in items)
        for it in items:
            if it["price_in"] > 0:
                model_ratio[it["model"]] = it["price_in"] / 2.0
            if it["price_in"] > 0 and it["price_out"] > 0:
                completion_ratio[it["model"]] = it["price_out"] / it["price_in"]
            if it["price_in"] > 0 and it["price_cache"] > 0:
                cache_ratio[it["model"]] = it["price_cache"] / it["price_in"]
        customers.append({**meta, "path": Path(meta["path"]).name, "items": items, "total_amount": total})
        print(meta["username"], f"¥{total:,.2f}", f"lines={len(items)}")
    out = Path(r"d:\nodejs\newapi\new-api\.tmp_settlement_gen\settlement_spec_v3.json")
    out.parent.mkdir(exist_ok=True)
    spec = {
        "password": "YxzSep2026!",
        "quota_per_unit": 500000.0,
        "video_price_range": [5.0, 20.0],
        "text_price_range": [1.0, 8.0],
        "model_ratio": model_ratio,
        "completion_ratio": completion_ratio,
        "cache_ratio": cache_ratio,
        "customers": customers,
    }
    out.write_text(json.dumps(spec, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", out, "size", out.stat().st_size)


if __name__ == "__main__":
    main()
