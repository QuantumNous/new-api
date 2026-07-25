"""Pre-connect catalog copy: what each connector is for and what access it gets.

Served with every /v1/connectors entry so the GUI's pre-connect detail page
(UX-DECISIONS §38) can show About / Access before any credentials exist. Plain
statements of behavior, not marketing: every bullet must stay true to the
connector's actual tools (tool_defs.py) and, for managed connectors, the scopes
the OpenWorker Cloud app requests. Overclaiming here is a product bug.

ABOUT is optional (the list blurb is the fallback subtitle); ACCESS is required
for every available connector — tests/test_connectors.py enforces it.
"""

from __future__ import annotations

ABOUT: dict[str, str] = {
    "telegram": "Chat with your coworker from Telegram. Messages to your bot "
    "reach the agent and replies come back to the same chat — only senders on "
    "your allow-list get through.",
    "slack": "Bring your coworker into Slack: mention it in a channel or DM it, "
    "and replies land in-thread. Any number of workspaces can be connected, "
    "each with its own allow-list of who may talk to the agent.",
    "email": "Read, search, and send mail on any IMAP account — Gmail, iCloud, "
    "Fastmail, or your own server — using an app password instead of your "
    "account password.",
    "gmail": "Search, summarize, and send over your Gmail. Multiple accounts "
    "connect side by side, and privacy filters can hide chosen senders or "
    "labels from agents entirely.",
    "google_calendar": "Check availability, summarize your week, and manage "
    "events. Multiple Google accounts connect side by side.",
    "browser": "A built-in browser agents drive to read pages and act on "
    "websites — separate from your personal browser, with actions subject to "
    "approval.",
    "github": "Work with issues, pull requests, repository files, and CI "
    "status. One click installs the OpenWorker GitHub App on the repositories "
    "you pick; mention the agent on an issue or PR and it answers from your "
    "desktop.",
    "outlook": "Search, summarize, and send Microsoft 365 mail, and run your "
    "calendar — create and move meetings, respond to invites. Multiple "
    "mailboxes connect side by side.",
    "hubspot": "Search and read your CRM; optionally log notes and tasks and "
    "update records. Read-only vs read & write is chosen at consent time, and "
    "chosen properties can be hidden from agents entirely.",
    "notion": "Search and read the pages and databases you share with the "
    "connection, and create new pages. You choose exactly which pages it can "
    "see.",
    "attio": "Read your Attio CRM — objects, records, and lists — to prep "
    "meetings and answer pipeline questions, and log notes as you work.",
    "google_drive": "Search, browse, and read files across your Drive. "
    "Multiple accounts connect side by side.",
    "monday": "Work with your monday.com boards — read items, summarize and "
    "aggregate board data, create items, and post updates. One-click sign-in "
    "runs entirely on this Mac against monday.com's own agent service; agents "
    "get a small curated set of its tools, never the full catalog.",
    "asana": "Keep up with your Asana work — search and read tasks and "
    "projects, create tasks, and comment. Connects with a personal access "
    "token from the Asana developer console.",
}

# What connecting actually grants, as short honest bullets. Write powers always
# name themselves; reads state their boundary ("…your account can see").
ACCESS: dict[str, list[str]] = {
    "telegram": [
        "Reads messages sent to your bot — never your personal chats.",
        "Sends messages as the bot.",
        "Only senders on your allow-list are answered.",
    ],
    "slack": [
        "Reads channels the bot is invited to, and its DMs.",
        "Posts messages and uploads files as the bot.",
        "Reads files shared in those channels.",
        "Reads member and channel names to resolve who's talking.",
    ],
    "email": [
        "Reads and searches mail over IMAP.",
        "Sends mail as your address, and saves attachments locally.",
        "Signs in with an app password — never your account password.",
    ],
    "gmail": [
        "Reads and searches your mail.",
        "Sends email as you.",
        "Never deletes mail or changes account settings.",
    ],
    "google_calendar": [
        "Reads events and availability across your calendars.",
        "Creates, updates, and deletes events.",
    ],
    "browser": [
        "Opens and reads web pages in its own browser session.",
        "Clicks, types, and uploads files only inside that session.",
        "Never touches your personal browser or its logins.",
    ],
    "github": [
        "Reads code, issues, pull requests, and CI on repositories you grant.",
        "Creates issues, replies, and reviews pull requests.",
        "You pick the repositories on GitHub — one, several, or all.",
    ],
    "outlook": [
        "Reads and searches your mail.",
        "Sends mail as you.",
        "Reads your calendar.",
        "Creates, changes, and cancels events; responds to invites as you.",
    ],
    "jira": [
        "Reads and searches issues your account can see.",
        "Creates, updates, and transitions issues; comments as you.",
    ],
    "monday": [
        "Reads boards, items, and updates your account can see.",
        "Creates items, changes item values, and posts updates as you.",
    ],
    "asana": [
        "Reads and searches tasks your account can see.",
        "Creates tasks as you.",
    ],
    "confluence": [
        "Reads and searches spaces and pages your account can see.",
        "Creates pages as you.",
    ],
    "zendesk": [
        "Reads and searches tickets your agent account can see.",
        "Creates tickets as you.",
    ],
    "linear": [
        "Reads and searches issues your account can see.",
        "Creates issues as you.",
    ],
    "gitlab": [
        "Reads issues and merge requests within your token's scope.",
        "Creates issues (needs the api scope; read_api stays read-only).",
    ],
    "discord": [
        "Reads channels the bot can see.",
        "Sends messages as the bot.",
    ],
    "stripe": [
        "Reads customers, charges, and invoices — read-only.",
        "A restricted read-only key means write access isn't even possible.",
    ],
    "hubspot": [
        "Reads contacts, companies, deals, and tickets.",
        "Read & write adds: log notes and tasks, update records, create "
        "contacts — never delete.",
        "Properties you hide are stripped before an agent ever sees a record.",
    ],
    "dropbox": [
        "Reads file names and contents — read-only.",
    ],
    "box": [
        "Reads file names and contents — read-only.",
    ],
    "whatsapp": [
        "Sends messages from your Cloud API number.",
        "Outbound only — it cannot read your chats.",
    ],
    "quickbooks": [
        "Reads customers, invoices, and reports — read-only.",
    ],
    "docusign": [
        "Reads envelopes and their signing status.",
        "Sends documents for signature as you.",
    ],
    "clickup": [
        "Reads and searches tasks and docs your account can see.",
        "Creates and updates tasks, and comments, as you.",
    ],
    "google_drive": [
        "Reads and searches your files — read-only.",
        "Never edits or deletes anything in your Drive.",
    ],
    "canva": [
        "Browses your designs and exports them — read-only.",
    ],
    "figma": [
        "Reads design files and comments; exports assets.",
        "Comments as you — never edits a design.",
    ],
    "close": [
        "Reads leads, contacts, and opportunities.",
        "Creates leads, updates opportunities, and logs notes as you.",
    ],
    "notion": [
        "Reads only the pages and databases shared with the connection.",
        "Creates pages — never edits or deletes existing ones.",
    ],
    "attio": [
        "Reads objects, records, lists, and notes.",
        "Logs notes — records are never created or changed.",
    ],
    "posthog": [
        "Runs read-only queries on the connected project: events, funnels, "
        "insights.",
    ],
    "mixpanel": [
        "Runs read-only queries on the connected project.",
    ],
    "amplitude": [
        "Runs read-only chart queries: active users, event totals.",
    ],
    "apollo": [
        "Searches and enriches people and companies, using your Apollo " "credits.",
    ],
    "hunter": [
        "Finds and verifies email addresses, using your Hunter quota.",
    ],
}

# Experimental / future connectors fall back to this rather than shipping
# without an access statement.
_DEFAULT_ACCESS = [
    "Access is limited to what the credentials you provide allow.",
]


def about_for(name: str) -> str:
    return ABOUT.get(name, "")


def access_for(name: str) -> list[str]:
    return list(ACCESS.get(name) or _DEFAULT_ACCESS)
