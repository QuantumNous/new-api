"""Standalone FakeSlack runner — drive the live dev app against a fake Slack.

    python -m coworker.testing.fake_slack --port 8910

Prints the ``SLACK_API_URL`` to export plus curl examples for the control API, then serves
until interrupted. Point the dev server at it by exporting ``SLACK_API_URL`` before starting
``openworker-server`` and connecting Slack with any fake ``xoxb-``/``xapp-`` tokens.
"""

from __future__ import annotations

import argparse

import uvicorn

from .server import FakeSlack


def main() -> None:
    parser = argparse.ArgumentParser(prog="coworker.testing.fake_slack")
    parser.add_argument(
        "--port", type=int, default=8910, help="port to bind (default 8910)"
    )
    parser.add_argument(
        "--host", default="127.0.0.1", help="host to bind (default 127.0.0.1)"
    )
    args = parser.parse_args()

    fake = FakeSlack(host=args.host, port=args.port)
    base = f"http://{args.host}:{args.port}"
    ctl = f"{base}/control"

    print("FakeSlack — standalone Slack test double")
    print(f"  listening on {base}")
    print()
    print("Point the app at it:")
    print(f"  export SLACK_API_URL={base}/api/")
    print(
        "  # then start openworker-server and connect Slack with any xoxb-/xapp- tokens"
    )
    print()
    print("Drive scenarios via the control API:")
    print(f"  curl -X POST {ctl}/users -H 'content-type: application/json' \\")
    print('       -d \'{"id":"U1","name":"alice","real_name":"Alice"}\'')
    print(f"  curl -X POST {ctl}/channels -H 'content-type: application/json' \\")
    print('       -d \'{"id":"C1","name":"general","is_im":false}\'')
    print(f"  curl -X POST {ctl}/inbound -H 'content-type: application/json' \\")
    print('       -d \'{"channel":"C1","user":"U1","text":"hello there"}\'')
    print(f"  curl -X POST {ctl}/interaction -H 'content-type: application/json' \\")
    print(
        '       -d \'{"channel":"C1","user":"U1","username":"alice",'
        '"message_ts":"1700000001.000001","action_id":"ocw_0","value":"..."}\''
    )
    print(
        f"  curl {ctl}/outbound          # inspect recorded chat.postMessage/chat.update"
    )
    print(f"  curl -X POST {ctl}/reset     # clean slate")
    print(f"  curl {ctl}/health")
    print()

    # Port is fixed here, so apps.connections.open can answer with the right ws:// URL without
    # waiting on an ephemeral bind. Serve blocking (handles signals).
    uvicorn.run(
        fake.app, host=args.host, port=args.port, log_level="info", lifespan="off"
    )


if __name__ == "__main__":
    main()
