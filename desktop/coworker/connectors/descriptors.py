"""Connector descriptors — data that drives the guided setup wizard.

Adding a connector is (mostly) data, not UI code: a descriptor declares its auth method,
the fields the user pastes, step-by-step instructions, and a `validate` that confirms the
token by a real API call (and returns the bot identity to show back). Designed so a managed
one-click OAuth (`auth="oauth"`) can slot in later for the cloud product without changing the
data model — only the connect action differs.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Optional


@dataclass
class Field:
    key: str
    label: str
    secret: bool = False
    required: bool = True
    help: str = ""
    placeholder: str = ""

    def to_dict(self) -> dict:
        return {
            "key": self.key,
            "label": self.label,
            "secret": self.secret,
            "required": self.required,
            "help": self.help,
            "placeholder": self.placeholder,
        }


@dataclass
class ValidationResult:
    ok: bool
    identity: Optional[str] = (
        None  # e.g. "@mybot" — shown back to the user, never a secret
    )
    error: Optional[str] = None


@dataclass
class ConnectorDescriptor:
    name: str
    title: str
    icon: str
    blurb: str
    auth: str  # "bot_token" | "socket_app" | "oauth" | "token" | "api_token" | "none"
    two_way: bool
    fields: list[Field]
    instructions: list[str]
    available: bool = True  # False → shown as "soon"
    # Chat-platform capability, narrower than two_way: sessions can SUBSCRIBE to this
    # connector's channels (Sources ▸ Channels, listening-sessions block). GitHub is
    # two_way via the relay (inbound mentions) but has no channel semantics.
    channels: bool = False
    validate: Optional[Callable[[dict], ValidationResult]] = None
    # Registry metadata (UI-Refresh §1): the connector's brand color (hex; fallback gray) and a
    # stable logo id (e.g. "slack") the frontend maps to a bundled SVG. Empty logo → UI fallback.
    brand_color: str = "#6b7280"
    logo: str = ""
    # Extra search terms for the catalog typeahead — capability words the title
    # doesn't carry (e.g. "calendar" must surface Outlook, not just Google Calendar).
    aliases: tuple = ()
    # Vendor-hosted MCP server URL → this connector is MCP-BACKED: one-click connect
    # runs the local MCP OAuth flow (DCR, tokens on this Mac — no broker), and the
    # tool surface is the PINNED subset in tool_defs (names `mcp__<name>__<tool>`),
    # never the vendor's full catalog (drift can only shrink capability, not grow it).
    # A connector may carry BOTH mcp_url and manual fields (jira): the profile's
    # mode decides which tool set is live.
    mcp_url: str = ""
    # Experimental connectors are hidden unless the user enables them in settings, require an
    # explicit risk acknowledgment to connect, and ship in a separate package
    # (connectors/experimental/) that release builds exclude entirely.
    experimental: bool = False
    risk_notice: str = ""
    # One-click managed OAuth via OpenWorker Cloud (requires cloud sign-in).
    # Manual token paste ALWAYS remains available — signed out or in — managed
    # is an extra path, never a replacement (local-only open-source flow is
    # sacred).
    managed: bool = False
    # One-click temporarily unavailable (e.g. Google pending CASA verification):
    # the GUI shows a disabled button with a "Coming soon" badge, the server
    # refuses begin_managed_connect, and the manual path is unaffected.
    managed_paused: bool = False
    # Multi-account (accounts.py generic layer): the creds field that names an
    # account (e.g. "project_id"), or "@identity" = the validator's identity
    # string. Non-empty → profiles live at `<name>:account:<id>` and the
    # `:default` profile is pointer-only. Empty → single-profile connector.
    account_field: str = ""


# -- validators (sync httpx, one-shot) -----------------------------------------
def _validate_telegram(creds: dict) -> ValidationResult:
    import httpx

    token = creds.get("bot_token", "")
    try:
        data = httpx.get(
            f"https://api.telegram.org/bot{token}/getMe", timeout=15
        ).json()
    except Exception as exc:
        return ValidationResult(False, error=str(exc))
    if data.get("ok"):
        return ValidationResult(
            True, identity="@" + str(data["result"].get("username", "bot"))
        )
    return ValidationResult(False, error=data.get("description") or "invalid bot token")


def _validate_email(creds: dict) -> ValidationResult:
    from .email_tools import validate_email_account

    ok, identity, error = validate_email_account(creds)
    return ValidationResult(ok, identity=identity or None, error=error or None)


def _validate_slack(creds: dict) -> ValidationResult:
    import httpx

    token = creds.get("bot_token", "")
    try:
        data = httpx.post(
            "https://slack.com/api/auth.test",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        ).json()
    except Exception as exc:
        return ValidationResult(False, error=str(exc))
    if data.get("ok"):
        return ValidationResult(
            True, identity=f"{data.get('team', '?')} / {data.get('user', 'bot')}"
        )
    return ValidationResult(False, error=data.get("error") or "invalid bot token")


def _validate_whoami(
    method: str,
    url: str,
    *,
    headers: dict,
    identity: Callable[[dict], str],
    json: Optional[dict] = None,
) -> ValidationResult:
    """Shared one-shot whoami check: 2xx + extractable identity, else a failure."""
    import httpx

    try:
        resp = httpx.request(method, url, headers=headers, json=json, timeout=15)
        data = resp.json()
    except Exception as exc:
        return ValidationResult(False, error=str(exc))
    if resp.status_code >= 400:
        detail = (
            (data.get("message") or data.get("error") or data.get("error_summary"))
            if isinstance(data, dict)
            else None
        )
        return ValidationResult(False, error=str(detail or f"HTTP {resp.status_code}"))
    try:
        return ValidationResult(True, identity=str(identity(data)))
    except Exception:
        return ValidationResult(False, error="unexpected response from API")


def _validate_notion(creds: dict) -> ValidationResult:
    return _validate_whoami(
        "GET",
        "https://api.notion.com/v1/users/me",
        headers={
            "Authorization": f"Bearer {creds.get('access_token', '')}",
            "Notion-Version": "2022-06-28",
        },
        identity=lambda d: (d.get("bot") or {}).get("workspace_name") or d["name"],
    )


def _validate_attio(creds: dict) -> ValidationResult:
    return _validate_whoami(
        "GET",
        "https://api.attio.com/v2/self",
        headers={"Authorization": f"Bearer {creds.get('access_token', '')}"},
        identity=lambda d: d.get("workspace_name") or d["workspace_id"],
    )


def _validate_posthog(creds: dict) -> ValidationResult:
    base = str(creds.get("base_url") or "https://us.posthog.com").rstrip("/")
    return _validate_whoami(
        "GET",
        f"{base}/api/users/@me/",
        headers={"Authorization": f"Bearer {creds.get('api_key', '')}"},
        identity=lambda d: d["email"],
    )


def _validate_mixpanel(creds: dict) -> ValidationResult:
    import base64 as _b64

    pair = f"{creds.get('username', '')}:{creds.get('secret', '')}"
    return _validate_whoami(
        "GET",
        "https://mixpanel.com/api/app/me",
        headers={"Authorization": "Basic " + _b64.b64encode(pair.encode()).decode()},
        identity=lambda d, u=creds.get("username", ""): u,
    )


def _validate_amplitude(creds: dict) -> ValidationResult:
    import base64 as _b64

    pair = f"{creds.get('api_key', '')}:{creds.get('secret_key', '')}"
    return _validate_whoami(
        "GET",
        "https://amplitude.com/api/2/annotations",
        headers={"Authorization": "Basic " + _b64.b64encode(pair.encode()).decode()},
        # No user identity on this API — name the account by the key's tail so
        # two projects stay tellable-apart in the accounts list.
        identity=lambda d, k=str(creds.get("api_key", "")): f"key …{k[-6:]}",
    )


def _validate_apollo(creds: dict) -> ValidationResult:
    return _validate_whoami(
        "GET",
        "https://api.apollo.io/api/v1/auth/health",
        headers={"X-Api-Key": creds.get("api_key", "")},
        identity=lambda d: str(creds.get("label") or "").strip() or "default",
    )


def _validate_hunter(creds: dict) -> ValidationResult:
    return _validate_whoami(
        "GET",
        f"https://api.hunter.io/v2/account?api_key={creds.get('api_key', '')}",
        headers={},
        identity=lambda d: d["data"]["email"],
    )


def _validate_linear(creds: dict) -> ValidationResult:
    return _validate_whoami(
        "POST",
        "https://api.linear.app/graphql",
        headers={
            "Authorization": creds.get("api_key", ""),
            "Content-Type": "application/json",
        },
        json={"query": "{ viewer { name } }"},
        identity=lambda d: d["data"]["viewer"]["name"],
    )


def _validate_gitlab(creds: dict) -> ValidationResult:
    base = str(creds.get("base_url") or "https://gitlab.com").rstrip("/")
    return _validate_whoami(
        "GET",
        f"{base}/api/v4/user",
        headers={"PRIVATE-TOKEN": creds.get("token", "")},
        identity=lambda d: "@" + d["username"],
    )


def _validate_discord(creds: dict) -> ValidationResult:
    return _validate_whoami(
        "GET",
        "https://discord.com/api/v10/users/@me",
        headers={"Authorization": f"Bot {creds.get('bot_token', '')}"},
        identity=lambda d: d["username"],
    )


def _validate_asana(creds: dict) -> ValidationResult:
    return _validate_whoami(
        "GET",
        "https://app.asana.com/api/1.0/users/me",
        headers={"Authorization": f"Bearer {creds.get('token', '')}"},
        identity=lambda d: d["data"]["name"],
    )


def _validate_hubspot(creds: dict) -> ValidationResult:
    return _validate_whoami(
        "GET",
        "https://api.hubapi.com/account-info/v3/details",
        headers={"Authorization": f"Bearer {creds.get('token', '')}"},
        identity=lambda d: f"portal {d['portalId']}",
    )


def _validate_dropbox(creds: dict) -> ValidationResult:
    return _validate_whoami(
        "POST",
        "https://api.dropboxapi.com/2/users/get_current_account",
        headers={"Authorization": f"Bearer {creds.get('access_token', '')}"},
        identity=lambda d: d["email"],
    )


def _quickbooks_host(creds: dict) -> str:
    env = str(creds.get("environment", "")).lower()
    return (
        "sandbox-quickbooks.api.intuit.com"
        if env.startswith("sand")
        else "quickbooks.api.intuit.com"
    )


def _validate_quickbooks(creds: dict) -> ValidationResult:
    realm = creds.get("realm_id", "")
    return _validate_whoami(
        "GET",
        f"https://{_quickbooks_host(creds)}/v3/company/{realm}/companyinfo/{realm}",
        headers={
            "Authorization": f"Bearer {creds.get('access_token', '')}",
            "Accept": "application/json",
        },
        identity=lambda d: d["CompanyInfo"]["CompanyName"],
    )


def _validate_box(creds: dict) -> ValidationResult:
    return _validate_whoami(
        "GET",
        "https://api.box.com/2.0/users/me",
        headers={"Authorization": f"Bearer {creds.get('access_token', '')}"},
        identity=lambda d: d["login"],
    )


def _validate_whatsapp(creds: dict) -> ValidationResult:
    return _validate_whoami(
        "GET",
        f"https://graph.facebook.com/v21.0/{creds.get('phone_number_id', '')}",
        headers={"Authorization": f"Bearer {creds.get('access_token', '')}"},
        identity=lambda d: d["display_phone_number"],
    )


def _validate_clickup(creds: dict) -> ValidationResult:
    return _validate_whoami(
        "GET",
        "https://api.clickup.com/api/v2/user",
        headers={"Authorization": creds.get("api_token", "")},
        identity=lambda d: d["user"]["username"],
    )


def _validate_close(creds: dict) -> ValidationResult:
    import base64 as _b64

    # Close authenticates with HTTP basic auth: the API key is the username, blank password.
    pair = f"{creds.get('api_key', '')}:"
    return _validate_whoami(
        "GET",
        "https://api.close.com/api/v1/me/",
        headers={"Authorization": "Basic " + _b64.b64encode(pair.encode()).decode()},
        identity=lambda d: d["email"],
    )


def _validate_figma(creds: dict) -> ValidationResult:
    return _validate_whoami(
        "GET",
        "https://api.figma.com/v1/me",
        headers={"X-Figma-Token": creds.get("access_token", "")},
        identity=lambda d: d["email"],
    )


def _validate_google_drive(creds: dict) -> ValidationResult:
    return _validate_whoami(
        "GET",
        "https://www.googleapis.com/drive/v3/about?fields=user",
        headers={"Authorization": f"Bearer {creds.get('access_token', '')}"},
        identity=lambda d: d["user"]["emailAddress"],
    )


def _validate_docusign(creds: dict) -> ValidationResult:
    # userinfo also carries accounts[] (account_id + base_uri); the tool layer
    # re-fetches and caches those on first use, so validation only needs identity.
    return _validate_whoami(
        "GET",
        "https://account.docusign.com/oauth/userinfo",
        headers={"Authorization": f"Bearer {creds.get('access_token', '')}"},
        identity=lambda d: d["email"],
    )


def _validate_canva(creds: dict) -> ValidationResult:
    return _validate_whoami(
        "GET",
        "https://api.canva.com/rest/v1/users/me/profile",
        headers={"Authorization": f"Bearer {creds.get('access_token', '')}"},
        identity=lambda d: d["profile"]["display_name"],
    )


def _validate_outlook(creds: dict) -> ValidationResult:
    return _validate_whoami(
        "GET",
        "https://graph.microsoft.com/v1.0/me",
        headers={"Authorization": f"Bearer {creds.get('access_token', '')}"},
        identity=lambda d: d.get("mail") or d["userPrincipalName"],
    )


_ALLOWED_FIELD = Field(
    key="allowed_users",
    label="Allowed user IDs",
    required=False,
    help="Comma-separated IDs allowed to message the bot. Leave empty, then DM the bot and use Capture.",
    placeholder="123456789",
)

DESCRIPTORS: list[ConnectorDescriptor] = [
    ConnectorDescriptor(
        name="telegram",
        title="Telegram",
        icon="✈",
        blurb="Two-way messaging with a Telegram bot.",
        auth="bot_token",
        two_way=True,
        channels=True,
        brand_color="#229ed9",
        logo="telegram",
        fields=[
            Field(
                "bot_token",
                "Bot token",
                secret=True,
                help="From @BotFather.",
                placeholder="123456:ABC-DEF…",
            ),
            _ALLOWED_FIELD,
        ],
        instructions=[
            "Open Telegram and message @BotFather.",
            "Send /newbot and pick a name + username.",
            "Copy the HTTP API token it gives you and paste it below.",
            "After connecting, DM your new bot once, then use Capture to grab your user ID.",
        ],
        validate=_validate_telegram,
    ),
    ConnectorDescriptor(
        name="slack",
        title="Slack",
        icon="💬",
        blurb="Two-way messaging — one-click via OpenWorker Cloud, or a manual Slack app (Socket Mode).",
        auth="socket_app",
        two_way=True,
        channels=True,
        brand_color="#611f69",
        logo="slack",
        # One-click managed OAuth (the cloud relay): signed in, the GUI shows
        # "Connect Slack with one click" (no tokens). The manual Socket-Mode
        # fields below stay as the always-available fallback (slack → slack in
        # PROVIDER_FOR_CONNECTOR drives the broker start).
        managed=True,
        fields=[
            Field(
                "bot_token",
                "Bot token",
                secret=True,
                help="Bot User OAuth Token.",
                placeholder="xoxb-…",
            ),
            Field(
                "app_token",
                "App token",
                secret=True,
                help="App-level token for Socket Mode.",
                placeholder="xapp-…",
            ),
            _ALLOWED_FIELD,
        ],
        instructions=[
            "Go to api.slack.com/apps → Create New App (from scratch).",
            "Settings → Socket Mode: enable it and generate an app-level token (xapp-) with connections:write.",
            "Features → Interactivity & Shortcuts: turn Interactivity ON (no Request URL needed in Socket Mode) — required for Approve/Deny buttons.",
            "OAuth & Permissions: add bot scopes chat:write, files:write, app_mentions:read, im:history, channels:history, groups:history, users:read, channels:read, groups:read (files:write lets the agent send files; the last three resolve sender/channel display names).",
            "Install to workspace and copy the Bot User OAuth Token (xoxb-).",
            "Paste both tokens below and Connect, then invite the bot to a channel or DM it.",
        ],
        validate=_validate_slack,
    ),
    ConnectorDescriptor(
        name="email",
        title="Email (IMAP)",
        icon="✉",
        blurb="Read, search, and send mail from any IMAP account — Gmail, iCloud, Fastmail, or custom.",
        auth="app_password",
        two_way=False,
        logo="email",
        fields=[
            Field("address", "Email address", placeholder="you@gmail.com"),
            Field(
                "app_password",
                "App password",
                secret=True,
                help="Gmail/iCloud: generate an app password (requires 2-step verification). Not your account password.",
            ),
            Field(
                "display_name",
                "Display name",
                required=False,
                help="Shown as the From name on sent mail.",
            ),
            Field(
                "imap_host",
                "IMAP host (advanced)",
                required=False,
                help="Only needed for providers we don't auto-detect.",
                placeholder="imap.example.com",
            ),
            Field(
                "imap_port", "IMAP port (advanced)", required=False, placeholder="993"
            ),
            Field(
                "smtp_host",
                "SMTP host (advanced)",
                required=False,
                placeholder="smtp.example.com",
            ),
            Field(
                "smtp_port", "SMTP port (advanced)", required=False, placeholder="587"
            ),
        ],
        instructions=[
            "Gmail: turn on 2-Step Verification, then create an app password at myaccount.google.com/apppasswords.",
            "iCloud: generate an app-specific password at account.apple.com → Sign-In and Security.",
            "Enter your address and the app password below. Gmail, iCloud, and Fastmail servers are detected automatically; for other providers fill in the IMAP/SMTP hosts.",
            "Note: Google Workspace and Microsoft 365 accounts often have IMAP or app passwords disabled by the org admin.",
        ],
        validate=_validate_email,
    ),
    ConnectorDescriptor(
        name="gmail",
        title="Gmail",
        icon="✉",
        blurb="Search, summarize, draft, and send email.",
        auth="oauth",
        two_way=False,
        brand_color="#ea4335",
        aliases=("email", "mail", "google"),
        logo="gmail",
        fields=[
            Field(
                "access_token",
                "OAuth access token",
                secret=True,
                help="Google OAuth token with Gmail scopes.",
            ),
        ],
        instructions=[
            "Use a Google OAuth access token with Gmail readonly and send scopes.",
            "Paste the access token below.",
        ],
        available=True,
        managed=True,
        # Google OAuth verification (CASA) pending — one-click off until it clears.
        managed_paused=True,
    ),
    ConnectorDescriptor(
        name="google_calendar",
        title="Google Calendar",
        icon="◷",
        blurb="Read availability, summarize schedules, and create events.",
        auth="oauth",
        two_way=False,
        brand_color="#4285f4",
        logo="google_calendar",
        fields=[
            Field(
                "access_token",
                "OAuth access token",
                secret=True,
                help="Google OAuth token with Calendar scopes.",
            ),
        ],
        instructions=[
            "Use a Google OAuth access token with Calendar read/write scopes.",
            "Paste the access token below.",
        ],
        available=True,
        managed=True,
        managed_paused=True,  # same Google app as Gmail — paused until CASA clears
    ),
    ConnectorDescriptor(
        name="browser",
        title="Browser",
        icon="⌕",
        blurb="Let agents navigate, read, and act on websites with approval.",
        auth="none",
        two_way=False,
        brand_color="#0ea5e9",
        logo="browser",
        fields=[],
        instructions=[
            "No setup required. Browser tools are available to Cowork sessions."
        ],
        available=True,
    ),
    ConnectorDescriptor(
        name="github",
        title="GitHub",
        icon="⌘",
        blurb="Work with issues, pull requests, repository files, and CI status.",
        auth="token",
        # Managed relay makes GitHub two-way: @-mentions and the agent label
        # reach the desktop through the cloud relay (github-relay-spec §2.3);
        # the manual PAT path stays request/response only.
        two_way=True,
        brand_color="#1f2328",
        logo="github",
        fields=[
            Field(
                "token",
                "Personal access token",
                secret=True,
                help="Fine-grained or classic GitHub token.",
            ),
        ],
        instructions=[
            "Create a GitHub personal access token with access to the target repositories.",
            "For write actions, include Issues or Pull Requests write permissions as needed.",
        ],
        available=True,
        # One-click managed path: install the GitHub App — no tokens typed.
        managed=True,
    ),
    ConnectorDescriptor(
        name="outlook",
        title="Outlook",
        icon="◎",
        blurb="Microsoft 365 mail and calendar: search, draft, and send email; "
        "manage events and respond to invites.",
        auth="oauth",
        two_way=False,
        brand_color="#0078d4",
        logo="outlook",
        aliases=("calendar", "email", "mail", "microsoft", "office"),
        fields=[
            Field(
                "access_token",
                "OAuth access token",
                secret=True,
                help="Microsoft Graph access token.",
            ),
        ],
        instructions=[
            "One click connects via OpenWorker Cloud (recommended).",
            "Manual: paste a Microsoft Graph access token with Mail and Calendar scopes.",
        ],
        validate=_validate_outlook,
        available=True,
        managed=True,
        # Key each connected mailbox by its email (the broker's `account` field,
        # from the Microsoft id_token) — same multi-account shape as Gmail/Drive.
        account_field="@identity",
    ),
    ConnectorDescriptor(
        name="jira",
        title="Jira",
        icon="◆",
        blurb="Search, summarize, create, and update issues.",
        auth="api_token",
        two_way=False,
        brand_color="#0052cc",
        logo="jira",
        aliases=("issues", "tickets", "atlassian", "project management"),
        mcp_url="https://mcp.atlassian.com/v1/mcp",
        fields=[
            Field(
                "base_url",
                "Atlassian site URL",
                secret=False,
                help="Example: https://example.atlassian.net",
            ),
            Field("email", "Account email", secret=False),
            Field("api_token", "API token", secret=True, help="Atlassian API token."),
        ],
        instructions=[
            "One click connects via Atlassian sign-in in your browser (recommended).",
            "Manual: create an Atlassian API token and paste your site URL, account email, and token below.",
        ],
        available=True,
    ),
    ConnectorDescriptor(
        name="monday",
        title="monday.com",
        icon="▦",
        blurb="Read boards and items, track work, create items and post updates.",
        auth="oauth",
        two_way=False,
        brand_color="#6161ff",
        logo="monday",
        aliases=("project management", "tasks", "boards", "work management"),
        mcp_url="https://mcp.monday.com/mcp",
        fields=[],
        instructions=[
            "One click connects via monday.com sign-in in your browser.",
            "Sign-in is fully local — tokens stay on this Mac.",
        ],
        available=True,
    ),
    ConnectorDescriptor(
        name="confluence",
        title="Confluence",
        icon="◫",
        blurb="Search spaces, read pages, and draft documentation.",
        auth="api_token",
        two_way=False,
        brand_color="#172b4d",
        logo="confluence",
        fields=[
            Field(
                "base_url",
                "Atlassian site URL",
                secret=False,
                help="Example: https://example.atlassian.net",
            ),
            Field("email", "Account email", secret=False),
            Field("api_token", "API token", secret=True, help="Atlassian API token."),
        ],
        instructions=[
            "Create an Atlassian API token for your account.",
            "Paste your site URL, account email, and API token below.",
        ],
        available=True,
    ),
    ConnectorDescriptor(
        name="zendesk",
        title="Zendesk",
        icon="◇",
        blurb="Search tickets, summarize customer context, and draft replies.",
        auth="api_token",
        two_way=False,
        brand_color="#03363d",
        logo="zendesk",
        fields=[
            Field(
                "subdomain",
                "Zendesk subdomain",
                secret=False,
                help="For example, 'acme' for acme.zendesk.com.",
            ),
            Field("email", "Agent email", secret=False),
            Field("api_token", "API token", secret=True),
        ],
        instructions=[
            "Create a Zendesk API token.",
            "Paste your subdomain, agent email, and API token below.",
        ],
        available=True,
    ),
    ConnectorDescriptor(
        name="linear",
        title="Linear",
        icon="⟋",
        blurb="Search, read, and create Linear issues.",
        auth="api_token",
        two_way=False,
        brand_color="#5e6ad2",
        logo="linear",
        fields=[
            Field(
                "api_key",
                "API key",
                secret=True,
                help="Personal API key from Linear settings.",
                placeholder="lin_api_…",
            ),
        ],
        instructions=[
            "In Linear, open Settings → Security & access → Personal API keys.",
            "Create a key and paste it below.",
        ],
        validate=_validate_linear,
    ),
    ConnectorDescriptor(
        name="gitlab",
        title="GitLab",
        icon="▲",
        blurb="Work with issues and merge requests on GitLab.com or self-hosted.",
        auth="token",
        two_way=False,
        brand_color="#fc6d26",
        logo="gitlab",
        fields=[
            Field(
                "base_url",
                "GitLab URL",
                required=False,
                help="Leave empty for gitlab.com.",
                placeholder="https://gitlab.example.com",
            ),
            Field(
                "token",
                "Personal access token",
                secret=True,
                help="Token with read_api scope (api for write actions).",
                placeholder="glpat-…",
            ),
        ],
        instructions=[
            "Create a GitLab personal access token with the read_api scope (api for write actions).",
            "For self-hosted GitLab, enter your instance URL; leave empty for gitlab.com.",
        ],
        validate=_validate_gitlab,
    ),
    ConnectorDescriptor(
        name="discord",
        title="Discord",
        icon="✦",
        blurb="Read channels and send messages through a Discord bot.",
        auth="bot_token",
        two_way=False,
        brand_color="#5865f2",
        logo="discord",
        fields=[
            Field(
                "bot_token",
                "Bot token",
                secret=True,
                help="From the Bot tab of your Discord application.",
            ),
        ],
        instructions=[
            "Go to discord.com/developers/applications → New Application → Bot.",
            "Copy the bot token and paste it below.",
            "Use the OAuth2 URL generator to invite the bot to your server with Read/Send Messages permissions.",
        ],
        validate=_validate_discord,
    ),
    ConnectorDescriptor(
        name="stripe",
        title="Stripe",
        icon="≋",
        blurb="Read-only access to customers, charges, and invoices.",
        auth="api_token",
        two_way=False,
        brand_color="#635bff",
        logo="stripe",
        fields=[
            Field(
                "api_key",
                "Restricted API key",
                secret=True,
                help="Read-only restricted key recommended.",
                placeholder="rk_live_…",
            ),
        ],
        instructions=[
            "In the Stripe Dashboard, create a restricted API key with read access to Customers, Charges, and Invoices.",
            "Paste the key below. The connector only exposes read tools.",
        ],
    ),
    ConnectorDescriptor(
        name="asana",
        title="Asana",
        icon="⊙",
        blurb="Search and read tasks and projects; create, update, and comment.",
        auth="token",
        two_way=False,
        brand_color="#f06a6a",
        logo="asana",
        aliases=("project management", "tasks", "work management"),
        # NO mcp_url (2026-07-20): Asana's V2 MCP server rejects Dynamic Client
        # Registration — it needs a pre-registered "MCP app" with an EXACT redirect
        # URI, which our dynamic sidecar port can't provide. One-click returns when
        # the broker-routed callback lands; the pinned mcp__asana__* defs sit
        # dormant until then. Manual token stays the connect path.
        fields=[
            Field(
                "token",
                "Personal access token",
                secret=True,
                help="From the Asana developer console.",
            ),
        ],
        instructions=[
            "In Asana, open My Settings → Apps → Manage developer apps.",
            "Create a personal access token and paste it below.",
        ],
        validate=_validate_asana,
    ),
    ConnectorDescriptor(
        name="hubspot",
        title="HubSpot",
        icon="⊚",
        blurb="Search CRM records; log notes and tasks, update records. No deletes.",
        auth="token",
        two_way=False,
        brand_color="#ff7a59",
        logo="hubspot",
        fields=[
            Field(
                "token",
                "Private app token",
                secret=True,
                help="Access token of a HubSpot private app.",
                placeholder="pat-…",
            ),
        ],
        instructions=[
            "In HubSpot, go to Settings → Integrations → Private Apps and create an app.",
            "Grant CRM object read scopes (add the .write scopes for notes, tasks, and updates).",
            "Copy the access token and paste it below.",
        ],
        validate=_validate_hubspot,
        managed=True,
    ),
    ConnectorDescriptor(
        name="dropbox",
        title="Dropbox",
        icon="▣",
        blurb="Search, browse, and read files in Dropbox.",
        auth="oauth",
        two_way=False,
        brand_color="#0061ff",
        logo="dropbox",
        fields=[
            Field(
                "access_token",
                "OAuth access token",
                secret=True,
                help="Dropbox token with files.metadata.read and files.content.read scopes.",
            ),
        ],
        instructions=[
            "Create an app in the Dropbox App Console with files.metadata.read and files.content.read scopes.",
            "Generate an access token and paste it below. Managed sign-in will replace this manual step later.",
        ],
        validate=_validate_dropbox,
    ),
    ConnectorDescriptor(
        name="box",
        title="Box",
        icon="▢",
        blurb="Search, browse, and read files in Box.",
        auth="oauth",
        two_way=False,
        brand_color="#0061d5",
        logo="box",
        fields=[
            Field(
                "access_token",
                "OAuth access token",
                secret=True,
                help="Box developer token or OAuth access token.",
            ),
        ],
        instructions=[
            "Create a Box app at app.box.com/developers/console.",
            "Generate a developer token (or OAuth access token) and paste it below. Managed sign-in will replace this manual step later.",
        ],
        validate=_validate_box,
    ),
    ConnectorDescriptor(
        name="whatsapp",
        title="WhatsApp",
        icon="◌",
        blurb="Send WhatsApp messages through Meta's official Cloud API (outbound only).",
        auth="token",
        two_way=False,
        brand_color="#25d366",
        logo="whatsapp",
        fields=[
            Field(
                "access_token",
                "Access token",
                secret=True,
                help="From your Meta app's WhatsApp setup page (a system-user token for long-lived access).",
            ),
            Field(
                "phone_number_id",
                "Phone number ID",
                help="The Cloud API phone number ID (not the phone number itself).",
            ),
        ],
        instructions=[
            "Create a Meta app at developers.facebook.com and add the WhatsApp product.",
            "Copy the access token and the phone number ID from the API setup page.",
            "The free test number can message up to 5 verified recipients without business verification.",
            "Free-form messages only reach people who messaged your number in the last 24 hours; outside that window only approved templates are delivered.",
        ],
        validate=_validate_whatsapp,
    ),
    ConnectorDescriptor(
        name="quickbooks",
        title="QuickBooks",
        icon="◴",
        blurb="Read-only access to customers, invoices, and financial reports.",
        auth="oauth",
        two_way=False,
        brand_color="#2ca01c",
        logo="quickbooks",
        fields=[
            Field(
                "access_token",
                "OAuth access token",
                secret=True,
                help="Intuit OAuth token with the com.intuit.quickbooks.accounting scope. Expires hourly.",
            ),
            Field(
                "realm_id",
                "Company ID (realm ID)",
                help="Shown during OAuth authorization and in the developer playground.",
            ),
            Field(
                "environment",
                "Environment",
                required=False,
                help="production (default) or sandbox.",
                placeholder="production",
            ),
        ],
        instructions=[
            "Create an app at developer.intuit.com and authorize it against your company (the OAuth playground works for testing).",
            "Copy the access token and the company ID (realm ID) and paste them below.",
            "Intuit access tokens expire after about an hour. Managed sign-in will replace this manual step later.",
        ],
        validate=_validate_quickbooks,
    ),
    # -- placeholders (available=False) --------------------------------------------
    # Not yet shipped, but referenced by persona `recommends` (e.g. Ops → datadog/pagerduty) so
    # the GUI can render a brand badge + a "connect to enable" state. A placeholder has no fields,
    # no validate, and `available=False`, so there is no connect path (connect_connector rejects an
    # unavailable connector and _profile_connected reports it disconnected). github/hubspot are NOT
    # placeholders here — they already ship as real connectors above.
    ConnectorDescriptor(
        name="datadog",
        title="Datadog",
        icon="◍",
        blurb="Pull firing alerts, monitors, and the incident timeline.",
        auth="none",
        two_way=False,
        fields=[],
        instructions=[],
        available=False,
        brand_color="#632ca6",
        logo="datadog",
    ),
    ConnectorDescriptor(
        name="salesforce",
        title="Salesforce",
        icon="☁",
        blurb="Read and update cases, accounts, and opportunities in the CRM.",
        auth="none",
        two_way=False,
        fields=[],
        instructions=[],
        available=False,
        brand_color="#00a1e0",
        logo="salesforce",
    ),
    ConnectorDescriptor(
        name="docusign",
        title="Docusign",
        icon="✍",
        blurb="Track agreements, check envelope status, and send documents for signature.",
        auth="oauth",
        two_way=False,
        brand_color="#4c00ff",
        logo="docusign",
        fields=[
            Field(
                "access_token",
                "OAuth access token",
                secret=True,
                help="Access token from a Docusign app (JWT or authorization-code grant).",
            ),
        ],
        instructions=[
            "Create an app in the Docusign developer console and complete an OAuth grant.",
            "Paste the access token below; the account and API base are discovered automatically.",
        ],
        validate=_validate_docusign,
        available=True,
    ),
    ConnectorDescriptor(
        name="clickup",
        title="ClickUp",
        icon="⌃",
        blurb="Search tasks and docs; create and update items.",
        auth="api_token",
        two_way=False,
        brand_color="#7b68ee",
        logo="clickup",
        fields=[
            Field(
                "api_token",
                "Personal API token",
                secret=True,
                help="ClickUp → Settings → Apps → API Token.",
                placeholder="pk_…",
            ),
        ],
        instructions=[
            "In ClickUp, open Settings → Apps and generate a personal API token.",
            "Paste it below.",
        ],
        validate=_validate_clickup,
        available=True,
    ),
    ConnectorDescriptor(
        name="google_drive",
        title="Google Drive",
        icon="◬",
        blurb="Search, browse, and read files in Google Drive.",
        auth="oauth",
        two_way=False,
        brand_color="#4285f4",
        logo="google_drive",
        fields=[
            Field(
                "access_token",
                "OAuth access token",
                secret=True,
                help="Google OAuth token with Drive read scopes.",
            ),
        ],
        instructions=[
            "Use a Google OAuth access token with Drive readonly scope.",
            "Paste the access token below.",
        ],
        validate=_validate_google_drive,
        available=True,
        managed=True,
        managed_paused=True,  # same Google app as Gmail — paused until CASA clears
        # Key each connected account by its Google email (the broker's `account`
        # field) so multiple Drive accounts list the same way Gmail's do, rather
        # than by the opaque `sub` that account_field="account_id" would use.
        account_field="@identity",
    ),
    ConnectorDescriptor(
        name="canva",
        title="Canva",
        icon="◠",
        blurb="Browse, create, and export designs.",
        auth="oauth",
        two_way=False,
        brand_color="#00c4cc",
        logo="canva",
        fields=[
            Field(
                "access_token",
                "OAuth access token",
                secret=True,
                help="Access token from a Canva Connect integration.",
            ),
        ],
        instructions=[
            "Create a Connect integration at canva.com/developers and complete an OAuth grant.",
            "Paste the access token below.",
        ],
        validate=_validate_canva,
        available=True,
    ),
    ConnectorDescriptor(
        name="figma",
        title="Figma",
        icon="◐",
        blurb="Read design files and comments; export assets.",
        auth="api_token",
        two_way=False,
        brand_color="#f24e1e",
        logo="figma",
        fields=[
            Field(
                "access_token",
                "Personal access token",
                secret=True,
                help="Figma → Settings → Security → Personal access tokens.",
                placeholder="figd_…",
            ),
        ],
        instructions=[
            "In Figma, open Settings → Security and generate a personal access token.",
            "Paste it below.",
        ],
        validate=_validate_figma,
        available=True,
    ),
    ConnectorDescriptor(
        name="descript",
        title="Descript",
        icon="≣",
        blurb="Read and edit audio and video projects through their transcripts.",
        auth="none",
        two_way=False,
        fields=[],
        instructions=[],
        available=False,
        brand_color="#0062ff",
        logo="descript",
    ),
    ConnectorDescriptor(
        name="clay",
        title="Clay",
        icon="⌒",
        blurb="Enrich people and companies; run outbound research workflows.",
        auth="none",
        two_way=False,
        fields=[],
        instructions=[],
        available=False,
        brand_color="#1f2328",
        logo="clay",
    ),
    ConnectorDescriptor(
        name="close",
        title="Close",
        icon="❋",
        blurb="Read and update leads, contacts, and opportunities in the CRM.",
        auth="api_token",
        two_way=False,
        brand_color="#276392",
        logo="close",
        fields=[
            Field(
                "api_key",
                "API key",
                secret=True,
                help="Close → Settings → Developer → API Keys.",
                placeholder="api_…",
            ),
        ],
        instructions=[
            "In Close, open Settings → Developer → API Keys and create a key.",
            "Paste it below.",
        ],
        validate=_validate_close,
        available=True,
    ),
    ConnectorDescriptor(
        name="notion",
        title="Notion",
        icon="◰",
        blurb="Search pages, read content, query databases, create pages.",
        auth="oauth",
        two_way=False,
        fields=[
            Field(
                "access_token",
                "Integration secret",
                secret=True,
                help="From an internal integration at notion.so/my-integrations; "
                "share the pages it should see with the integration.",
                placeholder="ntn_…",
            ),
        ],
        instructions=[
            "One click connects via OpenWorker Cloud (recommended).",
            "Manual: create an internal integration at notion.so/my-integrations,",
            "copy its secret, and share the relevant pages with the integration.",
        ],
        validate=_validate_notion,
        brand_color="#1f2328",
        logo="notion",
        managed=True,
        # Managed profiles key by the workspace id the broker sends
        # (account_id); a manual integration token falls back to the
        # validator's workspace name.
        account_field="account_id",
    ),
    ConnectorDescriptor(
        name="attio",
        title="Attio",
        icon="◵",
        blurb="Read your Attio CRM: objects, records, notes.",
        auth="oauth",
        two_way=False,
        fields=[
            Field(
                "access_token",
                "API key",
                secret=True,
                help="Workspace Settings → Developers → API keys.",
            ),
        ],
        instructions=[
            "One click connects via OpenWorker Cloud (recommended).",
            "Manual: create an API key under Workspace Settings → Developers.",
        ],
        validate=_validate_attio,
        brand_color="#2d7ff9",
        logo="attio",
        managed=True,
        account_field="account_id",
    ),
    ConnectorDescriptor(
        name="posthog",
        title="PostHog",
        icon="◫",
        blurb="Query product analytics: events, funnels, saved insights.",
        auth="api_token",
        two_way=False,
        fields=[
            Field(
                "base_url",
                "PostHog URL",
                required=False,
                help="Leave empty for US cloud; set for EU cloud or self-hosted.",
                placeholder="https://us.posthog.com",
            ),
            Field(
                "api_key",
                "Personal API key",
                secret=True,
                help="Settings → Personal API keys (read access is enough).",
                placeholder="phx_…",
            ),
            Field(
                "project_id",
                "Project ID",
                help="Settings → Project → Project ID. Add more projects as extra accounts.",
            ),
        ],
        instructions=[
            "In PostHog, open Settings → Personal API keys and create a key.",
            "Copy your Project ID from Settings → Project.",
            "One project per account — connect again to add another project.",
        ],
        validate=_validate_posthog,
        brand_color="#f54e00",
        logo="posthog",
        account_field="project_id",
    ),
    ConnectorDescriptor(
        name="mixpanel",
        title="Mixpanel",
        icon="◭",
        blurb="Query Mixpanel events and segmentation.",
        auth="api_token",
        two_way=False,
        fields=[
            Field("username", "Service account username", secret=False),
            Field("secret", "Service account secret", secret=True),
            Field(
                "project_id",
                "Project ID",
                help="Add more projects as extra accounts.",
            ),
        ],
        instructions=[
            "In Mixpanel, open Organization Settings → Service Accounts and create one.",
            "Copy the username, the secret, and your Project ID (Project Settings).",
        ],
        validate=_validate_mixpanel,
        brand_color="#7856ff",
        logo="mixpanel",
        account_field="project_id",
    ),
    ConnectorDescriptor(
        name="amplitude",
        title="Amplitude",
        icon="∿",
        blurb="Query Amplitude charts data: active users, event totals.",
        auth="api_token",
        two_way=False,
        fields=[
            Field(
                "api_key", "API key", secret=True, help="Project Settings → API Keys."
            ),
            Field("secret_key", "Secret key", secret=True),
        ],
        instructions=[
            "In Amplitude, open Settings → Projects → your project → API Keys.",
            "Copy the API key and secret key. One project per account.",
        ],
        validate=_validate_amplitude,
        brand_color="#1e61f0",
        logo="amplitude",
        account_field="@identity",
    ),
    ConnectorDescriptor(
        name="apollo",
        title="Apollo.io",
        icon="☄",
        blurb="Enrich people and companies; search the B2B database.",
        auth="api_token",
        two_way=False,
        fields=[
            Field(
                "api_key", "API key", secret=True, help="Settings → Integrations → API."
            ),
            Field(
                "label",
                "Account label",
                required=False,
                help="Name this account (used if you connect more than one).",
                placeholder="work",
            ),
        ],
        instructions=[
            "In Apollo, open Settings → Integrations → API and create an API key.",
            "Enrichment and search endpoints require a paid Apollo plan.",
        ],
        validate=_validate_apollo,
        brand_color="#fbbf24",
        logo="apollo",
        account_field="@identity",
    ),
    ConnectorDescriptor(
        name="hunter",
        title="Hunter",
        icon="✉",
        blurb="Find and verify professional email addresses by domain.",
        auth="api_token",
        two_way=False,
        fields=[
            Field(
                "api_key", "API key", secret=True, help="hunter.io → API → API keys."
            ),
        ],
        instructions=[
            "In Hunter, open API → API keys and copy your key.",
        ],
        validate=_validate_hunter,
        brand_color="#fa5320",
        logo="hunter",
        account_field="@identity",
    ),
    ConnectorDescriptor(
        name="pagerduty",
        title="PagerDuty",
        icon="◔",
        blurb="See who's on-call and review active incidents before paging.",
        auth="none",
        two_way=False,
        fields=[],
        instructions=[],
        available=False,
        brand_color="#06ac38",
        logo="pagerduty",
    ),
]

_BY_NAME = {d.name: d for d in DESCRIPTORS}


def register_descriptor(descriptor: ConnectorDescriptor) -> None:
    """Register an extra connector (used by the experimental package and tests)."""
    DESCRIPTORS.append(descriptor)
    _BY_NAME[descriptor.name] = descriptor


# Experimental connectors live in a separate package so release builds can exclude the code
# entirely (see packaging/openworker-server.spec). When the package is absent this is a no-op.
try:
    from .experimental import EXPERIMENTAL_DESCRIPTORS as _EXPERIMENTAL
except ImportError:
    _EXPERIMENTAL = []
for _exp in _EXPERIMENTAL:
    _exp.experimental = True  # enforced here, not trusted from the author
    register_descriptor(_exp)


def list_descriptors() -> list[ConnectorDescriptor]:
    return list(DESCRIPTORS)


def get_descriptor(name: str) -> Optional[ConnectorDescriptor]:
    return _BY_NAME.get(name)
