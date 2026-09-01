from pathlib import Path
import subprocess


PROJECT_ROOT = Path(__file__).resolve().parents[3]


def run_go_test(test_name: str) -> None:
    result = subprocess.run(
        ["go", "test", "./router", "-run", f"^{test_name}$", "-count=1"],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_happy_path() -> None:
    run_go_test("TestDesktopBootstrapHappyPath")


def test_unsupported_method() -> None:
    run_go_test("TestDesktopBootstrapUnsupportedMethod")


def test_replay() -> None:
    run_go_test("TestDesktopBootstrapReplay")


def test_version_is_closed() -> None:
    run_go_test("TestDesktopBootstrapVersionIsClosed")


def test_concurrent_reads() -> None:
    run_go_test("TestDesktopBootstrapConcurrentReads")


def test_recovery_after_bad_method() -> None:
    run_go_test("TestDesktopBootstrapRecoveryAfterBadMethod")
