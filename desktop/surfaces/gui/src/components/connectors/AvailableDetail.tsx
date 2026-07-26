import { useState } from "react";
import { type CloudStatus, type Connector } from "../../api";
import { ConnectorBadge } from "../../connectors/ConnectorIcon";
import { AddConnectionModal } from "./AddConnectionModal";
import { FOOT, GRP, GRP_H, PILL_ACCENT, ROW, TAG_QUIET } from "./ui";
import { useTranslation } from "react-i18next";

// Pre-connect detail page (UX-DECISIONS §38): what a connector is for and what
// access it gets, BEFORE any credentials exist. About paragraph, honest Access
// bullets, and the tool list behind a collapsed disclosure (advanced-reader
// detail — no enable/disable pre-connect; that lever lives on the connected
// page). Connect opens the same add-connection modal as the list's pill.

export function AvailableDetail({
  c,
  cloud,
  onChanged,
}: {
  c: Connector;
  cloud: CloudStatus | null;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [connecting, setConnecting] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const tools = c.tools || [];

  return (
    <div data-testid="available-detail">
      <div className="flex items-center gap-3.5 mb-5">
        <ConnectorBadge connector={c} size={44} title={c.title} />
        <div className="min-w-0 flex-1">
          <h2 className="text-[20px] font-semibold tracking-tight leading-tight">{c.title}</h2>
          <div className="text-[12.5px] text-muted">{c.blurb}</div>
        </div>
        <button
          className={PILL_ACCENT}
          data-testid="available-connect"
          onClick={() => setConnecting(true)}
        >
          {t("Connect")}
        </button>
      </div>

      {c.about && <p className="text-[13px] text-ink/90 leading-relaxed mb-1 px-0.5">{c.about}</p>}

      {(c.access?.length ?? 0) > 0 && (
        <>
          <div className={GRP_H}>{t("Access")}</div>
          <div className={GRP} data-testid="available-access">
            {c.access!.map((line) => (
              <div key={line} className={ROW + " !min-h-[36px] !py-2 text-[13px]"}>
                {line}
              </div>
            ))}
          </div>
          <div className={FOOT}>
            {t("Keys and tokens are stored only on this computer. Disconnect anytime.")}
          </div>
        </>
      )}

      {tools.length > 0 && (
        <>
          <div className={GRP_H}>{t("Tools")}</div>
          <div className={GRP}>
            <button
              className={ROW + " w-full text-left hover:bg-paper/60 text-[13px]"}
              data-testid="available-tools-toggle"
              onClick={() => setShowTools((v) => !v)}
            >
              <span className="min-w-0 flex-1 text-muted">
                {tools.length} tool{tools.length === 1 ? "" : "s"} {t("this connector adds")}
              </span>
              <span className="text-faint text-[13px] shrink-0">{showTools ? "Hide" : "View"}</span>
            </button>
            {showTools &&
              tools.map((tool) => (
                <div key={tool.name} className={ROW + " !min-h-[38px]"}>
                  <span className="min-w-0 flex-1">
                    <span className="text-[13px]">{tool.label}</span>
                    <span className="block text-[12px] text-muted">{tool.description}</span>
                  </span>
                  {tool.kind !== "read" && <span className={TAG_QUIET}>{t("asks first")}</span>}
                </div>
              ))}
          </div>
        </>
      )}

      {connecting && (
        <AddConnectionModal
          c={c}
          cloud={cloud}
          onClose={() => setConnecting(false)}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}
