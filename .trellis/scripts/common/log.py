"""
Terminal output utilities: colors and structured logging.

Single source of truth for Colors and log_* functions
used across all Trellis scripts.
"""

from __future__ import annotations


class Colors:
    """ANSI color codes for terminal output."""

    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    BLUE = "\033[0;34m"
    CYAN = "\033[0;36m"
    DIM = "\033[2m"
    NC = "\033[0m"  # No Color / Reset


def colored(text: str, color: str) -> str:
    """Apply ANSI color to text."""
    return f"{color}{text}{Colors.NC}"


def log_info(msg: str) -> None:
    """Print info-level message with [INFO] prefix."""
    print(f"{Colors.BLUE}[INFO]{Colors.NC} {msg}")


def log_success(msg: str) -> None:
    """Print success message with [SUCCESS] prefix."""
    print(f"{Colors.GREEN}[SUCCESS]{Colors.NC} {msg}")


def log_warn(msg: str) -> None:
    """Print warning message with [WARN] prefix."""
    print(f"{Colors.YELLOW}[WARN]{Colors.NC} {msg}")


def log_error(msg: str) -> None:
    """Print error message with [ERROR] prefix."""
    print(f"{Colors.RED}[ERROR]{Colors.NC} {msg}")
