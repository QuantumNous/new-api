#!/usr/bin/env python3.11
"""Backfill users.pay_country (Stripe card issuing country) for existing payers.

Run AFTER deploying the migration that adds the users.pay_country column.
Card country is the most reliable geography signal for paid users; the ops
report reads it as the 「付费国家」column and as the primary 「地区」source.

Prereqs: cloud-sql-proxy on 127.0.0.1:13306, gcloud (for db password secret),
stripe key at ~/.secrets/flatkey-stripe-rk or STRIPE_API_KEY.
"""
import base64, json, os, pathlib, subprocess, urllib.request, urllib.parse
import pymysql

def db_pw():
    pw = os.environ.get("NEWAPI_DB_PW")
    if pw:
        return pw.strip()
    r = subprocess.run(["gcloud", "secrets", "versions", "access", "latest",
        "--secret=newapi-db-app-password", "--project=vocai-gemini-prod"],
        capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(r.stderr)
    return r.stdout.strip()

SK = os.environ.get("STRIPE_API_KEY") or (pathlib.Path.home()/".secrets"/"flatkey-stripe-rk").read_text().strip()
def sg(path, params=None):
    url = f"https://api.stripe.com/v1/{path}" + ("?" + urllib.parse.urlencode(params, doseq=True) if params else "")
    req = urllib.request.Request(url, headers={"Authorization": "Basic " + base64.b64encode(f"{SK}:".encode()).decode()})
    try:
        return json.loads(urllib.request.urlopen(req, timeout=30).read())
    except urllib.error.HTTPError as e:
        # Fail loudly: a swallowed auth/rate-limit error would masquerade as
        # "no card country" and silently skip users.
        body = e.read().decode("utf-8", errors="replace")[:200]
        raise RuntimeError(f"Stripe API {path} failed: status={e.code} body={body}") from e

def card_country(customer):
    # Prefer the charge's card country (covers non-save-card payments); fall back
    # to saved payment methods. Mirrors controller/stripe_card.go fetchCardCountry.
    # Scans up to 100 charges / 100 saved PMs — far beyond any current payer's
    # history (current payers have <20 charges); a genuinely-empty result after
    # that scan is reported as "no card country" by the caller.
    if not customer:
        return ""
    ch = sg("charges", {"customer": customer, "limit": 100})
    for x in (ch.get("data") or []):
        cc = ((x.get("payment_method_details") or {}).get("card") or {}).get("country") or ""
        if cc:
            return cc.upper()
    d = sg("payment_methods", {"customer": customer, "type": "card", "limit": 100})
    for pm in (d.get("data") or []):
        cc = (pm.get("card") or {}).get("country") or ""
        if cc:
            return cc.upper()
    return ""

c = pymysql.connect(host="127.0.0.1", port=13306, user="newapi_app", database="newapi", password=db_pw())
cur = c.cursor()
cur.execute("""SELECT DISTINCT u.id, u.stripe_customer FROM users u
    JOIN top_ups t ON t.user_id = u.id AND t.status='success'
    WHERE u.stripe_customer <> '' AND (u.pay_country IS NULL OR u.pay_country='')""")
todo = cur.fetchall()
print(f"{len(todo)} payers to backfill")
for uid, cust in todo:
    cc = card_country(cust)
    if cc:
        cur.execute("UPDATE users SET pay_country=%s WHERE id=%s", (cc, uid))
        c.commit()
        print(f"  user {uid} -> {cc}")
    else:
        print(f"  user {uid} -> (no card country)")
print("done")
