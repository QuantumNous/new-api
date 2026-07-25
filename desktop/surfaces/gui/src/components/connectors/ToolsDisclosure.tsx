import { updateConnectorTools, type Connector } from "../../api";
import { GRP, ROW, TAG_QUIET, TAG_WARN } from "./ui";

// Collapsed-by-default Tools group, shared by every connector detail page
// (UX-DECISIONS §21): the lever exists everywhere but stays quiet — expanding
// shows one row per tool with its read/write tag; writes always ask first.
export function ToolsDisclosure({ c, onChanged }: { c: Connector; onChanged: () => void }) {
  if (!c.tools?.length) return null;
  const enabled = c.tools.filter((t) => t.enabled).length;
  return (
    <div className={GRP + " mt-6"}>
      <details>
        <summary className={ROW + " cursor-pointer hover:bg-paper/60 list-none [&::-webkit-details-marker]:hidden"}>
          <span className="text-[12.5px] text-muted w-24 shrink-0">› Tools</span>
          <span className="min-w-0 flex-1 text-[12.5px] text-muted">
            {enabled} of {c.tools.length} enabled
          </span>
        </summary>
        {c.tools.map((tool) => (
          <label key={tool.name} className={ROW + " cursor-pointer"} title={`${tool.name} — ${tool.description}`}>
            <input
              type="checkbox"
              checked={tool.enabled}
              onChange={async (e) => {
                await updateConnectorTools(c.name, { [tool.name]: e.target.checked });
                onChanged();
              }}
            />
            <span className="min-w-0 flex-1 text-[13px] font-medium">{tool.label}</span>
            <span className={tool.kind === "write" ? TAG_WARN : TAG_QUIET}>
              {tool.kind === "write" ? "asks first" : "read"}
            </span>
          </label>
        ))}
      </details>
    </div>
  );
}
