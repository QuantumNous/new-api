---
name: "send-to-figma"
description: "Send to Figma\nExport as an editable Figma design"
---
# Send to Figma

Export the current design to Figma using the Figma MCP. (This is the export direction — to **import** a local `.fig` file, see [import-from-figma.md](import-from-figma.md).)

This only works with static designs; if you have a deck or prototype, you will need to duplicate the file and reformat it as a horizontal scroll of fixed-size frames for each slide or screen.

## Process

1. **Identify the design file** the user wants to send (the currently open HTML file).
2. **Read the file** so you have the full content.
3. **If not static**, duplicate the file and reformat it as a horizontal scroll of fixed-size frames for each slide or screen.
4. **Call the `generate_figma_design` tool** from the Figma MCP to export it into Figma.
   - Pass the design content / structure as the tool expects.
   - If Figma is not connected, tell the user to connect it first (via the Figma button in the sidebar or the `connect_figma` tool on web).
5. The tool may ask you to embed a code snippet in the page and open it with a specific hash. Once you've embedded the snippet, surface/preview the file through your selected harness reference with the file path or URL **including the requested hash** (e.g. `index.html#figmacapture=…`) — the capture script only runs when the page loads in the user's preview pane. Use the user-facing preview surface, not a private self-only preview. Don't ask the user to open the URL themselves — just let them click the export button if one is needed.
6. Don't sleep or poll for status — the capture runs in the user's browser, not yours, so you won't see its output. Leave the page showing so the user can continue the flow.

## Notes

- If the tool is not available, explain that the Figma MCP connection is required.
