import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getConnectors } from "../api";
import { McpTab } from "./ManageTabs";
import { ConnectorsSection } from "./connectors/ConnectorsSection";
import { SkillsTab } from "./SkillsTab";
import { Icon } from "./Icon";

// The Connectors surface (renamed from "Integrations", §26) keeps the left sub-nav:
// Connectors · Skills · MCP. Messaging routing lives under Inbox ▸ Configure (§28).
type IntTab = "connectors" | "skills" | "mcp";

export function IntegrationsView({
  initialTab,
}: {
  /** Deep-link from the account menu "Skills" entry. */
  initialTab?: IntTab;
} = {}) {
  const { t } = useTranslation();
  const intTabs: { key: IntTab; label: string; icon: "plug" | "sparkle" | "code" }[] = [
    { key: "connectors", label: t("Connectors"), icon: "plug" },
    { key: "skills", label: t("Skills"), icon: "sparkle" },
    { key: "mcp", label: t("MCP servers"), icon: "code" },
  ];
  const [tab, setTab] = useState<IntTab>(initialTab || "connectors");
  // Sub-nav count: how many connectors exist. Polled so the badge stays live.
  const [connCount, setConnCount] = useState<number | null>(null);

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const load = () => {
      getConnectors().then((cs) => setConnCount(cs.length)).catch(() => {});
    };
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="flex-1 min-w-0 flex bg-paper">
      <nav className="page-subnav w-[208px] shrink-0 border-r border-line bg-panel/40 px-3 py-4">
        <div className="px-2 text-[13.5px] font-semibold mb-3 flex items-center gap-2">
          <Icon name="plug" size={16} /> {t("Connectors")}
        </div>
        {intTabs.map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              className={
                "w-full text-left px-2.5 py-2 rounded-lg text-[13px] flex items-center justify-between " +
                (active
                  ? "bg-paper text-accent font-medium"
                  : "text-muted hover:bg-paper hover:text-ink")
              }
              onClick={() => setTab(item.key)}
            >
              <span className="flex items-center gap-2 min-w-0">
                <Icon name={item.icon} size={15} /> {item.label}
              </span>
              {item.key === "connectors" && connCount != null && (
                <span className={"text-[11px] shrink-0 " + (active ? "text-accent" : "text-faint")}>
                  {connCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex-1 min-w-0 overflow-y-auto hairline-scroll">
        <div className="max-w-4xl mx-auto px-7 py-6">
          {tab === "connectors" ? (
            <section>
              <PanelHead
                title={t("Connectors")}
                sub={t("Apps and tools your coworkers can use. Connected ones come first.")}
              />
              <ConnectorsSection />
            </section>
          ) : tab === "skills" ? (
            <section>
              <PanelHead
                title={t("Skills")}
                sub={t(
                  "Reusable instruction packs (SKILL.md) your coworkers load on demand. Built-in skills ship with the app; install more from a folder, GitHub, or the marketplace. Changes apply to new sessions.",
                )}
              />
              <SkillsTab />
            </section>
          ) : (
            <section>
              <PanelHead
                title={t("MCP servers")}
                sub={t("External tool servers (stdio or HTTP), shared across all agents.")}
              />
              <McpTab />
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

export function PanelHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-[18px] font-semibold tracking-tight">{title}</h2>
      <p className="text-[12.5px] text-muted mt-0.5">{sub}</p>
    </div>
  );
}
