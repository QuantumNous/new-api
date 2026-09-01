import json
import os
import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]


def run(command: list[str], cwd: Path = ROOT) -> None:
    executable = shutil.which(command[0])
    assert executable, f"required executable not found: {command[0]}"
    environment = os.environ.copy()
    environment.setdefault("GOPROXY", "https://goproxy.cn,direct")
    subprocess.run(
        [executable, *command[1:]],
        cwd=cwd,
        env=environment,
        check=True,
        text=True,
    )


def go_test(package: str, pattern: str) -> None:
    run(["go", "test", package, "-run", pattern, "-count=1"])


def test_contract_and_v1_compatibility() -> None:
    schema_path = ROOT / "docs/contracts/desktop-integration.v2.schema.json"
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    properties = schema["properties"]["data"]["properties"]
    assert properties["schema_version"] == {"const": 2}
    assert properties["contract_id"] == {"const": "desktop-integration-v2"}
    assert properties["official_usd_cny_rate"] == {"const": 6.75}
    assert properties["account_path"] == {"const": "/api/user/self"}
    assert properties["usage_summary_path"] == {"const": "/api/log/self/stat"}
    assert properties["usage_records_path"] == {"const": "/api/log/self"}
    assert properties["models_path"] == {"const": "/api/user/models"}
    assert properties["pricing_path"] == {"const": "/api/pricing"}
    assert properties["tool_keys_path"] == {"const": "/api/token/"}
    go_test("./router", "TestDesktopV2BootstrapAdvertisesExistingOwnersWithoutChangingV1")


def test_device_authorization_happy_path() -> None:
    go_test("./service", "TestDesktopDeviceAuthorizationHappyPathAndReplay")


def test_device_authorization_failure_paths() -> None:
    go_test(
        "./service",
        "TestDesktopDeviceAuthorization(PendingSlowDownDeniedAndExpiry|RequiresRedis)",
    )
    go_test("./router", "TestDesktopV2SensitiveRoutesRequireExpectedAuthority")


def test_device_authorization_replay_and_race() -> None:
    go_test(
        "./service",
        "TestDesktopDeviceAuthorizationConcurrentExchangeCreatesOneSession",
    )


def test_refresh_revoke_and_recovery() -> None:
    go_test("./controller", "Test(RefreshDesktop|RevokeCurrentDesktop)")
    go_test("./model", "TestRotateUserSessionRefreshRaceAndReuse")


def test_browser_approval_surface() -> None:
    run(
        [
            "bun",
            "x",
            "vitest",
            "run",
            "src/features/desktop-authorization/__tests__/authorization.test.tsx",
            "--configLoader",
            "runner",
        ],
        cwd=ROOT / "web",
    )
