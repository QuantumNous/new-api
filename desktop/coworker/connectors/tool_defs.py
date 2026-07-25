"""Connector tool catalog and local enablement policy."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from ..secrets import SecretStore


@dataclass(frozen=True)
class ConnectorToolDef:
    connector: str
    name: str
    label: str
    kind: str
    description: str
    default_enabled: bool = True
    # Which argument names the external object this tool acts ON (channel, recipient, …).
    # Declaring it makes the tool eligible for a task-scoped standing rule (UX-DECISIONS §25):
    # "this automation may call this tool against this exact target without asking". Only
    # single-argument targets are declarable in v1 (no wildcards, no composite targets), and
    # only write tools should declare one — reads never gate, so a rule would be meaningless.
    target_arg: Optional[str] = None


TOOL_DEFS: tuple[ConnectorToolDef, ...] = (
    ConnectorToolDef(
        "browser",
        "browser_read_url",
        "Read public URL",
        "read",
        "Fetch readable text from a public URL.",
    ),
    ConnectorToolDef(
        "browser",
        "browser_open_url",
        "Open URL",
        "read",
        "Open a URL in the Playwright browser.",
    ),
    ConnectorToolDef(
        "browser",
        "browser_snapshot",
        "Snapshot page",
        "read",
        "Read page text and visible controls.",
    ),
    ConnectorToolDef(
        "browser",
        "browser_get_text",
        "Read page text",
        "read",
        "Read visible text from the current browser page.",
    ),
    ConnectorToolDef(
        "browser",
        "browser_click",
        "Click page",
        "write",
        "Click a visible browser element.",
    ),
    ConnectorToolDef(
        "browser",
        "browser_type",
        "Fill field",
        "write",
        "Type into or fill a browser field.",
    ),
    ConnectorToolDef(
        "browser",
        "browser_select",
        "Select option",
        "write",
        "Select a dropdown option.",
    ),
    ConnectorToolDef(
        "browser",
        "browser_upload_file",
        "Upload file",
        "write",
        "Upload a local file through a file input.",
    ),
    ConnectorToolDef(
        "browser", "browser_wait", "Wait", "read", "Wait for time or an element."
    ),
    ConnectorToolDef(
        "browser",
        "browser_screenshot",
        "Screenshot",
        "read",
        "Capture a browser screenshot.",
    ),
    ConnectorToolDef(
        "browser",
        "browser_close",
        "Close browser",
        "write",
        "Close the browser session.",
    ),
    ConnectorToolDef(
        "github",
        "github_search",
        "Search GitHub",
        "read",
        "Search issues, pull requests, or repositories.",
    ),
    ConnectorToolDef(
        "github",
        "github_get_issue",
        "Read issue",
        "read",
        "Read a GitHub issue or pull request.",
    ),
    ConnectorToolDef(
        "github",
        "github_create_issue",
        "Create issue",
        "write",
        "Create a GitHub issue.",
    ),
    ConnectorToolDef(
        "github",
        "github_reply",
        "Reply on issue/PR",
        "write",
        "Comment on an issue or pull request.",
    ),
    ConnectorToolDef(
        "github",
        "github_review",
        "Review a PR",
        "write",
        "Submit a pull-request review (approve / request changes / comment).",
    ),
    ConnectorToolDef(
        "github",
        "github_list_commits",
        "List commits",
        "read",
        "List a repository's recent commits (for activity summaries).",
    ),
    ConnectorToolDef(
        "github",
        "github_clone",
        "Clone a repo",
        "read",
        "Clone a repository into a session folder to explore the code.",
    ),
    ConnectorToolDef(
        "github",
        "github_pull",
        "Update a clone",
        "read",
        "Fast-forward an existing clone to the latest commits.",
    ),
    ConnectorToolDef(
        "email",
        "email_list_folders",
        "List folders",
        "read",
        "List mailbox folders and message counts.",
    ),
    ConnectorToolDef(
        "email",
        "email_search",
        "Search mail",
        "read",
        "Search the mailbox; returns envelopes, never marks messages read.",
    ),
    ConnectorToolDef(
        "email",
        "email_read",
        "Read message",
        "read",
        "Read one email's headers, body, and attachment list.",
    ),
    ConnectorToolDef(
        "email",
        "email_download_attachment",
        "Save attachment",
        "write",
        "Save one attachment into the session folder (requires approval).",
    ),
    ConnectorToolDef(
        "email",
        "email_send",
        "Send email",
        "write",
        "Send or reply to an email via SMTP (requires approval).",
        target_arg="to",
    ),
    ConnectorToolDef(
        "gmail",
        "gmail_search_messages",
        "Search Gmail",
        "read",
        "Search Gmail messages.",
    ),
    ConnectorToolDef(
        "gmail", "gmail_get_message", "Read message", "read", "Read a Gmail message."
    ),
    ConnectorToolDef(
        "gmail",
        "gmail_send_email",
        "Send email",
        "write",
        "Send an email through Gmail.",
        target_arg="to",
    ),
    ConnectorToolDef(
        "google_calendar",
        "gcal_list_events",
        "List events",
        "read",
        "List Google Calendar events.",
    ),
    ConnectorToolDef(
        "google_calendar",
        "gcal_free_busy",
        "Check availability",
        "read",
        "Look up busy intervals across calendars.",
    ),
    ConnectorToolDef(
        "google_calendar",
        "gcal_create_event",
        "Create event",
        "write",
        "Create a Google Calendar event.",
    ),
    ConnectorToolDef(
        "google_calendar",
        "gcal_update_event",
        "Update event",
        "write",
        "Change fields of an existing event.",
    ),
    ConnectorToolDef(
        "google_calendar",
        "gcal_delete_event",
        "Delete event",
        "write",
        "Delete a calendar event.",
    ),
    ConnectorToolDef(
        "outlook",
        "outlook_search_messages",
        "Search Outlook",
        "read",
        "Search Outlook messages.",
    ),
    ConnectorToolDef(
        "outlook",
        "outlook_send_mail",
        "Send mail",
        "write",
        "Send mail through Outlook.",
        target_arg="to",
    ),
    ConnectorToolDef(
        "outlook",
        "outlook_list_events",
        "List events",
        "read",
        "List upcoming Outlook calendar events.",
    ),
    ConnectorToolDef(
        "outlook",
        "outlook_create_event",
        "Create event",
        "write",
        "Create an Outlook calendar event.",
    ),
    ConnectorToolDef(
        "outlook",
        "outlook_update_event",
        "Update event",
        "write",
        "Change fields of an existing event.",
    ),
    ConnectorToolDef(
        "outlook",
        "outlook_delete_event",
        "Delete event",
        "write",
        "Delete a calendar event.",
    ),
    ConnectorToolDef(
        "outlook",
        "outlook_respond_event",
        "Respond to invite",
        "write",
        "Accept, decline, or tentatively accept a meeting invite.",
    ),
    ConnectorToolDef(
        "jira", "jira_search_issues", "Search issues", "read", "Search Jira issues."
    ),
    ConnectorToolDef(
        "jira", "jira_get_issue", "Read issue", "read", "Read a Jira issue."
    ),
    ConnectorToolDef(
        "jira", "jira_create_issue", "Create issue", "write", "Create a Jira issue."
    ),
    # -- jira via the Atlassian hosted MCP server (one-click path) ---------------
    # PINNED allowlist (UX-DECISIONS §42): tool names are `mcp__<connector>__<vendor
    # tool>` exactly as mcp/tools.py builds them; anything the vendor ships that is
    # not listed here never reaches a session. Which set is live (these vs the
    # jira_* REST tools above) follows the profile's mode — see tool_dicts.
    ConnectorToolDef(
        "jira",
        "mcp__jira__getVisibleJiraProjects",
        "List projects",
        "read",
        "List Jira projects you can access.",
    ),
    ConnectorToolDef(
        "jira",
        "mcp__jira__searchJiraIssuesUsingJql",
        "Search issues",
        "read",
        "Search Jira issues using JQL.",
    ),
    ConnectorToolDef(
        "jira",
        "mcp__jira__getJiraIssue",
        "Read issue",
        "read",
        "Read a Jira issue.",
    ),
    ConnectorToolDef(
        "jira",
        "mcp__jira__getTransitionsForJiraIssue",
        "List transitions",
        "read",
        "List available workflow transitions for an issue.",
    ),
    ConnectorToolDef(
        "jira",
        "mcp__jira__createJiraIssue",
        "Create issue",
        "write",
        "Create a Jira issue.",
    ),
    ConnectorToolDef(
        "jira",
        "mcp__jira__editJiraIssue",
        "Update issue",
        "write",
        "Update fields on an existing issue.",
    ),
    ConnectorToolDef(
        "jira",
        "mcp__jira__addCommentToJiraIssue",
        "Comment",
        "write",
        "Add a comment to an issue.",
    ),
    ConnectorToolDef(
        "jira",
        "mcp__jira__transitionJiraIssue",
        "Transition issue",
        "write",
        "Move an issue through its workflow.",
    ),
    # -- monday.com (MCP-backed only; pinned subset of their 60+ tool catalog) ----
    ConnectorToolDef(
        "monday",
        "mcp__monday__get_user_context",
        "Who am I",
        "read",
        "Read the signed-in user, account, and their boards.",
    ),
    ConnectorToolDef(
        "monday",
        "mcp__monday__search",
        "Search",
        "read",
        "Search boards, docs, forms, and folders.",
    ),
    ConnectorToolDef(
        "monday",
        "mcp__monday__get_board_info",
        "Read board",
        "read",
        "Read a board's columns, groups, views, and owners.",
    ),
    ConnectorToolDef(
        "monday",
        "mcp__monday__get_board_items_page",
        "List items",
        "read",
        "Page through the items on a board.",
    ),
    ConnectorToolDef(
        "monday",
        "mcp__monday__board_insights",
        "Board insights",
        "read",
        "Aggregate, filter, and group board data.",
    ),
    ConnectorToolDef(
        "monday",
        "mcp__monday__get_updates",
        "Read updates",
        "read",
        "Read updates (comments) from an item or board.",
    ),
    ConnectorToolDef(
        "monday",
        "mcp__monday__create_item",
        "Create item",
        "write",
        "Create an item on a board.",
    ),
    ConnectorToolDef(
        "monday",
        "mcp__monday__change_item_column_values",
        "Update item",
        "write",
        "Change column values on an item.",
    ),
    ConnectorToolDef(
        "monday",
        "mcp__monday__create_update",
        "Post update",
        "write",
        "Post a comment or reply on an item.",
    ),
    # -- asana via their hosted V2 MCP server (one-click path; the asana_* REST
    # tools below stay the manual-token set — profile mode picks, as with jira) ---
    ConnectorToolDef(
        "asana",
        "mcp__asana__get_me",
        "Who am I",
        "read",
        "Read the signed-in Asana user.",
    ),
    ConnectorToolDef(
        "asana",
        "mcp__asana__search_tasks",
        "Search tasks",
        "read",
        "Search tasks across the workspace.",
    ),
    ConnectorToolDef(
        "asana",
        "mcp__asana__get_task",
        "Read task",
        "read",
        "Read a task with its fields and comments.",
    ),
    ConnectorToolDef(
        "asana",
        "mcp__asana__get_my_tasks",
        "My tasks",
        "read",
        "List the signed-in user's tasks.",
    ),
    ConnectorToolDef(
        "asana",
        "mcp__asana__get_project",
        "Read project",
        "read",
        "Read a project's details.",
    ),
    ConnectorToolDef(
        "asana",
        "mcp__asana__get_status_overview",
        "Status overview",
        "read",
        "Read status updates for projects and portfolios.",
    ),
    ConnectorToolDef(
        "asana",
        "mcp__asana__create_tasks",
        "Create tasks",
        "write",
        "Create one or more tasks.",
    ),
    ConnectorToolDef(
        "asana",
        "mcp__asana__update_tasks",
        "Update tasks",
        "write",
        "Update fields on existing tasks.",
    ),
    ConnectorToolDef(
        "asana",
        "mcp__asana__add_comment",
        "Comment",
        "write",
        "Add a comment to a task.",
    ),
    ConnectorToolDef(
        "confluence",
        "confluence_search",
        "Search pages",
        "read",
        "Search Confluence pages.",
    ),
    ConnectorToolDef(
        "confluence",
        "confluence_get_page",
        "Read page",
        "read",
        "Read a Confluence page.",
    ),
    ConnectorToolDef(
        "confluence",
        "confluence_create_page",
        "Create page",
        "write",
        "Create a Confluence page.",
    ),
    ConnectorToolDef(
        "zendesk", "zendesk_search", "Search Zendesk", "read", "Search Zendesk."
    ),
    ConnectorToolDef(
        "zendesk", "zendesk_get_ticket", "Read ticket", "read", "Read a Zendesk ticket."
    ),
    ConnectorToolDef(
        "zendesk",
        "zendesk_create_ticket",
        "Create ticket",
        "write",
        "Create a Zendesk ticket.",
    ),
    ConnectorToolDef(
        "linear",
        "linear_search_issues",
        "Search issues",
        "read",
        "Search Linear issues.",
    ),
    ConnectorToolDef(
        "linear", "linear_get_issue", "Read issue", "read", "Read a Linear issue."
    ),
    ConnectorToolDef(
        "linear", "linear_list_teams", "List teams", "read", "List Linear teams."
    ),
    ConnectorToolDef(
        "linear",
        "linear_create_issue",
        "Create issue",
        "write",
        "Create a Linear issue.",
    ),
    ConnectorToolDef(
        "gitlab",
        "gitlab_search",
        "Search GitLab",
        "read",
        "Search projects, issues, or merge requests.",
    ),
    ConnectorToolDef(
        "gitlab", "gitlab_get_issue", "Read issue", "read", "Read a GitLab issue."
    ),
    ConnectorToolDef(
        "gitlab",
        "gitlab_get_merge_request",
        "Read merge request",
        "read",
        "Read a GitLab merge request.",
    ),
    ConnectorToolDef(
        "gitlab",
        "gitlab_create_issue",
        "Create issue",
        "write",
        "Create a GitLab issue.",
    ),
    ConnectorToolDef(
        "discord",
        "discord_list_channels",
        "List channels",
        "read",
        "List channels in a Discord server.",
    ),
    ConnectorToolDef(
        "discord",
        "discord_read_messages",
        "Read messages",
        "read",
        "Read recent Discord channel messages.",
    ),
    ConnectorToolDef(
        "discord",
        "discord_send_message",
        "Send message",
        "write",
        "Send a Discord channel message.",
        target_arg="channel_id",
    ),
    ConnectorToolDef(
        "stripe",
        "stripe_search_customers",
        "Search customers",
        "read",
        "Search Stripe customers.",
    ),
    ConnectorToolDef(
        "stripe",
        "stripe_list_charges",
        "List charges",
        "read",
        "List Stripe charges.",
    ),
    ConnectorToolDef(
        "stripe",
        "stripe_list_invoices",
        "List invoices",
        "read",
        "List Stripe invoices.",
    ),
    ConnectorToolDef(
        "asana",
        "asana_list_workspaces",
        "List workspaces",
        "read",
        "List Asana workspaces.",
    ),
    ConnectorToolDef(
        "asana", "asana_search_tasks", "Search tasks", "read", "Search Asana tasks."
    ),
    ConnectorToolDef(
        "asana", "asana_get_task", "Read task", "read", "Read an Asana task."
    ),
    ConnectorToolDef(
        "asana", "asana_create_task", "Create task", "write", "Create an Asana task."
    ),
    ConnectorToolDef(
        "hubspot",
        "hubspot_search",
        "Search CRM",
        "read",
        "Search HubSpot contacts, companies, deals, or tickets.",
    ),
    ConnectorToolDef(
        "hubspot",
        "hubspot_get_object",
        "Read record",
        "read",
        "Read a HubSpot CRM record.",
    ),
    ConnectorToolDef(
        "hubspot",
        "hubspot_create_contact",
        "Create contact",
        "write",
        "Create a HubSpot contact.",
    ),
    ConnectorToolDef(
        "hubspot",
        "hubspot_update_object",
        "Update record",
        "write",
        "Update properties on a CRM record (no deletes).",
    ),
    ConnectorToolDef(
        "hubspot",
        "hubspot_log_note",
        "Log note",
        "write",
        "Log a note on a record's timeline.",
    ),
    ConnectorToolDef(
        "hubspot",
        "hubspot_create_task",
        "Create task",
        "write",
        "Create a HubSpot task.",
    ),
    ConnectorToolDef(
        "dropbox", "dropbox_search", "Search files", "read", "Search Dropbox files."
    ),
    ConnectorToolDef(
        "dropbox",
        "dropbox_list_folder",
        "List folder",
        "read",
        "List a Dropbox folder.",
    ),
    ConnectorToolDef(
        "dropbox",
        "dropbox_read_file",
        "Read file",
        "read",
        "Read a text file from Dropbox.",
    ),
    ConnectorToolDef("box", "box_search", "Search files", "read", "Search Box files."),
    ConnectorToolDef(
        "box", "box_list_folder", "List folder", "read", "List a Box folder."
    ),
    ConnectorToolDef(
        "box", "box_read_file", "Read file", "read", "Read a text file from Box."
    ),
    ConnectorToolDef(
        "quickbooks",
        "quickbooks_query",
        "Query records",
        "read",
        "Run a QuickBooks Online query.",
    ),
    ConnectorToolDef(
        "quickbooks",
        "quickbooks_list_customers",
        "List customers",
        "read",
        "List QuickBooks customers.",
    ),
    ConnectorToolDef(
        "quickbooks",
        "quickbooks_list_invoices",
        "List invoices",
        "read",
        "List recent QuickBooks invoices.",
    ),
    ConnectorToolDef(
        "quickbooks",
        "quickbooks_get_report",
        "Run report",
        "read",
        "Run a QuickBooks financial report.",
    ),
    ConnectorToolDef(
        "whatsapp",
        "whatsapp_send_message",
        "Send message",
        "write",
        "Send a WhatsApp text message.",
        target_arg="to",
    ),
    ConnectorToolDef(
        "whatsapp",
        "whatsapp_send_template",
        "Send template",
        "write",
        "Send an approved WhatsApp template message.",
        target_arg="to",
    ),
    ConnectorToolDef(
        "notion",
        "notion_search",
        "Search",
        "read",
        "Search Notion pages and databases.",
    ),
    ConnectorToolDef(
        "notion",
        "notion_read_page",
        "Read page",
        "read",
        "Read a page's properties and content.",
    ),
    ConnectorToolDef(
        "notion",
        "notion_query_database",
        "Query database",
        "read",
        "Query a Notion database.",
    ),
    ConnectorToolDef(
        "notion",
        "notion_create_page",
        "Create page",
        "write",
        "Create a page under a parent page.",
    ),
    ConnectorToolDef(
        "attio",
        "attio_list_objects",
        "List objects",
        "read",
        "List Attio object types.",
    ),
    ConnectorToolDef(
        "attio",
        "attio_query_records",
        "Query records",
        "read",
        "List/filter records of an object.",
    ),
    ConnectorToolDef(
        "attio",
        "attio_get_record",
        "Read record",
        "read",
        "Read one record by id.",
    ),
    ConnectorToolDef(
        "attio",
        "attio_create_note",
        "Log note",
        "write",
        "Log a note on a record.",
    ),
    ConnectorToolDef(
        "posthog",
        "posthog_query",
        "Run query",
        "read",
        "Run a HogQL analytics query.",
    ),
    ConnectorToolDef(
        "posthog",
        "posthog_list_insights",
        "List insights",
        "read",
        "List saved PostHog insights.",
    ),
    ConnectorToolDef(
        "mixpanel",
        "mixpanel_segmentation",
        "Event counts",
        "read",
        "Mixpanel event counts over a date range.",
    ),
    ConnectorToolDef(
        "mixpanel",
        "mixpanel_top_events",
        "Top events",
        "read",
        "Today's top Mixpanel events.",
    ),
    ConnectorToolDef(
        "amplitude",
        "amplitude_active_users",
        "Active users",
        "read",
        "Amplitude daily active/new users.",
    ),
    ConnectorToolDef(
        "amplitude",
        "amplitude_event_totals",
        "Event totals",
        "read",
        "Daily totals for one Amplitude event.",
    ),
    ConnectorToolDef(
        "apollo",
        "apollo_enrich_person",
        "Enrich person",
        "read",
        "Enrich a person by email or name.",
    ),
    ConnectorToolDef(
        "apollo",
        "apollo_enrich_company",
        "Enrich company",
        "read",
        "Enrich a company by domain.",
    ),
    ConnectorToolDef(
        "apollo",
        "apollo_search_people",
        "Search people",
        "read",
        "Keyword-search Apollo's B2B database.",
    ),
    ConnectorToolDef(
        "hunter",
        "hunter_domain_search",
        "Domain search",
        "read",
        "Find published emails for a domain.",
    ),
    ConnectorToolDef(
        "hunter",
        "hunter_find_email",
        "Find email",
        "read",
        "Find a person's likely email address.",
    ),
    ConnectorToolDef(
        "hunter",
        "hunter_verify_email",
        "Verify email",
        "read",
        "Check whether an email is deliverable.",
    ),
    ConnectorToolDef(
        "clickup",
        "clickup_list_teams",
        "List workspaces",
        "read",
        "List ClickUp workspaces.",
    ),
    ConnectorToolDef(
        "clickup",
        "clickup_list_spaces",
        "List spaces",
        "read",
        "List spaces in a workspace.",
    ),
    ConnectorToolDef(
        "clickup",
        "clickup_list_lists",
        "List lists",
        "read",
        "List task lists in a space.",
    ),
    ConnectorToolDef(
        "clickup",
        "clickup_list_tasks",
        "List tasks",
        "read",
        "List tasks in a list.",
    ),
    ConnectorToolDef(
        "clickup",
        "clickup_get_task",
        "Read task",
        "read",
        "Read one task with subtasks.",
    ),
    ConnectorToolDef(
        "clickup",
        "clickup_create_task",
        "Create task",
        "write",
        "Create a task in a list.",
        target_arg="list_id",
    ),
    ConnectorToolDef(
        "clickup",
        "clickup_update_task",
        "Update task",
        "write",
        "Update a task's name, description, or status.",
        target_arg="task_id",
    ),
    ConnectorToolDef(
        "clickup",
        "clickup_add_comment",
        "Comment",
        "write",
        "Comment on a task.",
        target_arg="task_id",
    ),
    ConnectorToolDef(
        "close",
        "close_search_leads",
        "Search leads",
        "read",
        "Search leads with Close's query syntax.",
    ),
    ConnectorToolDef(
        "close",
        "close_get_lead",
        "Read lead",
        "read",
        "Read one lead with contacts and opportunities.",
    ),
    ConnectorToolDef(
        "close",
        "close_list_opportunities",
        "List opportunities",
        "read",
        "List opportunities, optionally per lead.",
    ),
    ConnectorToolDef(
        "close",
        "close_create_lead",
        "Create lead",
        "write",
        "Create a lead, optionally with a contact.",
    ),
    ConnectorToolDef(
        "close",
        "close_update_opportunity",
        "Update opportunity",
        "write",
        "Update an opportunity's status or note.",
        target_arg="opportunity_id",
    ),
    ConnectorToolDef(
        "close",
        "close_log_note",
        "Log note",
        "write",
        "Log a note on a lead's timeline.",
        target_arg="lead_id",
    ),
    ConnectorToolDef(
        "figma",
        "figma_get_file",
        "Read file",
        "read",
        "Read a file's pages and frames.",
    ),
    ConnectorToolDef(
        "figma",
        "figma_get_comments",
        "List comments",
        "read",
        "List comments on a file.",
    ),
    ConnectorToolDef(
        "figma",
        "figma_post_comment",
        "Comment",
        "write",
        "Comment on a file.",
        target_arg="file_key",
    ),
    ConnectorToolDef(
        "figma",
        "figma_export_images",
        "Export images",
        "read",
        "Render nodes to image URLs.",
    ),
    ConnectorToolDef(
        "google_drive",
        "drive_search_files",
        "Search files",
        "read",
        "Search Drive files by name or content.",
    ),
    ConnectorToolDef(
        "google_drive",
        "drive_list_folder",
        "List folder",
        "read",
        "List a Drive folder's contents.",
    ),
    ConnectorToolDef(
        "google_drive",
        "drive_read_file",
        "Read file",
        "read",
        "Read a Drive file as text.",
    ),
    ConnectorToolDef(
        "docusign",
        "docusign_list_envelopes",
        "List envelopes",
        "read",
        "List recent envelopes by status.",
    ),
    ConnectorToolDef(
        "docusign",
        "docusign_get_envelope",
        "Read envelope",
        "read",
        "Read an envelope's signer progress.",
    ),
    ConnectorToolDef(
        "docusign",
        "docusign_list_templates",
        "List templates",
        "read",
        "List signature templates.",
    ),
    ConnectorToolDef(
        "docusign",
        "docusign_send_from_template",
        "Send for signature",
        "write",
        "Send a template to a signer.",
        target_arg="recipient_email",
    ),
    ConnectorToolDef(
        "canva",
        "canva_list_designs",
        "List designs",
        "read",
        "List or search designs.",
    ),
    ConnectorToolDef(
        "canva",
        "canva_get_design",
        "Read design",
        "read",
        "Read a design's metadata.",
    ),
    ConnectorToolDef(
        "canva",
        "canva_export_design",
        "Export design",
        "read",
        "Start rendering a design to pdf/png/jpg.",
    ),
    ConnectorToolDef(
        "canva",
        "canva_get_export",
        "Check export",
        "read",
        "Poll an export job for download URLs.",
    ),
)

_KIND_BY_NAME = {d.name: d.kind for d in TOOL_DEFS}


# §36: the registry's read/write kind is the SINGLE source of truth for whether a
# connector tool gates. Reads on a service the user explicitly connected never ask
# (the §25 design note — "reads never gate" — made law); writes always do. Tools
# without a registry entry keep their call-site default (MCP/experimental stay
# conservative).
def approval_for_tool(name: str, default: bool = True) -> bool:
    kind = _KIND_BY_NAME.get(name)
    if kind is None:
        return default
    return kind != "read"


TOOL_TO_CONNECTOR = {d.name: d.connector for d in TOOL_DEFS}
TOOLS_BY_CONNECTOR: dict[str, list[ConnectorToolDef]] = {}
for _def in TOOL_DEFS:
    TOOLS_BY_CONNECTOR.setdefault(_def.connector, []).append(_def)

# Standing-rule target arguments (§25). Declared on connector tool defs above, plus the
# always-available messaging tool `send_message` (its `target` is the reply handle
# "platform:chat_id" — exactly the address a rule pins). This dict is the single source of
# which tools can EVER carry a standing rule: exec/destructive tools must never appear here.
TARGET_ARGS: dict[str, str] = {d.name: d.target_arg for d in TOOL_DEFS if d.target_arg}
TARGET_ARGS["send_message"] = "target"


def target_arg_for(tool_name: str) -> Optional[str]:
    """The argument that names this tool's standing-rule target, or None if the tool
    isn't eligible for standing rules."""
    return TARGET_ARGS.get(tool_name)


def connector_for_tool(tool_name: str) -> str | None:
    return TOOL_TO_CONNECTOR.get(tool_name)


def load_tool_settings(secrets: SecretStore, connector: str) -> dict[str, bool]:
    raw = secrets.get(f"{connector}:tools") or {}
    enabled = raw.get("enabled") if isinstance(raw, dict) else None
    return {str(k): bool(v) for k, v in (enabled or {}).items()}


def tool_enabled(secrets: SecretStore, connector: str, tool_name: str) -> bool:
    overrides = load_tool_settings(secrets, connector)
    if tool_name in overrides:
        return overrides[tool_name]
    for tool in TOOLS_BY_CONNECTOR.get(connector, []):
        if tool.name == tool_name:
            return tool.default_enabled
    return False


def patch_tool_settings(
    secrets: SecretStore, connector: str, enabled: dict[str, Any]
) -> dict[str, Any]:
    known = {t.name for t in TOOLS_BY_CONNECTOR.get(connector, [])}
    if not known:
        return {"ok": False, "error": "unknown connector or no tools"}
    current = load_tool_settings(secrets, connector)
    for name, value in enabled.items():
        if name in known:
            current[name] = bool(value)
    secrets.put(f"{connector}:tools", {"enabled": current})
    return {"ok": True, "tools": current}


def mcp_tool_defs(connector: str) -> list[ConnectorToolDef]:
    """The connector's PINNED MCP tools (names `mcp__<connector>__<vendor tool>`)."""
    return [
        t for t in TOOLS_BY_CONNECTOR.get(connector, []) if t.name.startswith("mcp__")
    ]


def mcp_pinned_tools(connector: str) -> list[str]:
    """Vendor-side tool names of the pinned allowlist (prefix stripped) — what goes
    into the seeded server config's `include_tools`."""
    prefix = f"mcp__{connector}__"
    return [t.name.removeprefix(prefix) for t in mcp_tool_defs(connector)]


def active_tool_defs(secrets: SecretStore, connector: str) -> list[ConnectorToolDef]:
    """The defs live for this connector's CURRENT profile. A connector with both an
    API tool set and a pinned MCP set (jira) exposes exactly one of them, following
    the profile's mode; single-set connectors are unaffected."""
    defs = TOOLS_BY_CONNECTOR.get(connector, [])
    mcp = [t for t in defs if t.name.startswith("mcp__")]
    api = [t for t in defs if not t.name.startswith("mcp__")]
    if not mcp or not api:
        return defs
    profile = secrets.get(f"{connector}:default") or {}
    return mcp if profile.get("mode") == "mcp" else api


def tool_dicts(secrets: SecretStore, connector: str) -> list[dict[str, Any]]:
    overrides = load_tool_settings(secrets, connector)
    out = []
    for tool in active_tool_defs(secrets, connector):
        out.append(
            {
                "name": tool.name,
                "label": tool.label,
                "kind": tool.kind,
                "description": tool.description,
                "enabled": bool(overrides.get(tool.name, tool.default_enabled)),
                "requires_approval": True,
            }
        )
    return out
