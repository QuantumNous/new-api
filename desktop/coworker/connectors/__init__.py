"""Messaging connectors — Slack/Telegram adapters, the gateway, and the send_message tool."""

from __future__ import annotations

from .base import (
    BasePlatformAdapter,
    MessageEvent,
    MessageSource,
    MessageType,
    SendResult,
    SessionSource,
    format_target,
    parse_target,
)
from .adapters import (
    SlackAdapter,
    TelegramAdapter,
    make_adapter,
    slack_event_to_event,
    telegram_message_to_event,
)
from .config import ConnectorSettings, TeamAuth, is_authorized, load_settings
from .relay_client import SlackRelayAdapter
from .slack_addr import qualify as slack_qualify, split as slack_split
from .descriptors import ConnectorDescriptor, get_descriptor, list_descriptors
from .fake import FakeAdapter
from .gateway import Gateway
from .senders import DEFAULT_SENDERS
from .setup import (
    connect_connector,
    connector_list,
    disconnect_connector,
    experimental_enabled,
    set_experimental_enabled,
    update_connector_tools,
)
from .integration_tools import make_integration_tools
from .tools import make_send_file_tool, make_send_message_tool
from .tool_defs import connector_for_tool

__all__ = [
    "BasePlatformAdapter",
    "MessageEvent",
    "MessageSource",
    "MessageType",
    "SendResult",
    "SessionSource",
    "format_target",
    "parse_target",
    "ConnectorSettings",
    "TeamAuth",
    "is_authorized",
    "load_settings",
    "ConnectorDescriptor",
    "get_descriptor",
    "list_descriptors",
    "FakeAdapter",
    "Gateway",
    "DEFAULT_SENDERS",
    "connect_connector",
    "connector_list",
    "disconnect_connector",
    "experimental_enabled",
    "set_experimental_enabled",
    "update_connector_tools",
    "make_integration_tools",
    "make_send_file_tool",
    "make_send_message_tool",
    "connector_for_tool",
    "SlackAdapter",
    "SlackRelayAdapter",
    "TelegramAdapter",
    "make_adapter",
    "slack_event_to_event",
    "telegram_message_to_event",
    "slack_qualify",
    "slack_split",
]
