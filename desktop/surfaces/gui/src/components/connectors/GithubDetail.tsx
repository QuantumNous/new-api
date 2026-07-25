import { useEffect, useState } from "react";
import {
  disallowUser,
  disconnectGithubInstallation,
  getGithubStatus,
  getSubscriptions,
  resolveUnauthorized,
  unsubscribeChannel,
  type Connector,
  type GithubInstallation,
  type GithubStatus,
  type ParkedMessage,
  type Subscription,
} from "../../api";
import { ConnectorBadge } from "../../connectors/ConnectorIcon";
import { AddConnectionModal } from "./AddConnectionModal";
import type { DetailProps } from "./ConnectorsSection";
import { ToolsDisclosure } from "./ToolsDisclosure";
import { FOOT, GRP, GRP_H, PILL_ACCENT, PILL_LINE, ROW, TAG_WARN, XBTN } from "./ui";

// The GitHub detail page (github-relay-spec §8), the Slack page's shape: one
// group per App INSTALLATION (the allow-list scope) — People (sender logins
// allowed to trigger work) · Waiting (parked mentions) · per-installation
// disconnect — plus a page-level Listening group (a subscription names a repo
// thread, which the GUI can't map back to an installation). Adding an
// installation goes through the ONE entry point: header button → modal.

const LABEL = "text-[12.5px] text-muted w-24 shrink-0";

/** The relay status line, one honest layer at a time (the Slack rule). */
function relayHealth(gh: GithubStatus | null): { dot: string; text: string } {
  if (!gh) return { dot: "bg-ok", text: "Live · managed relay" };
  if (!gh.signed_in)
    return { dot: "bg-warnInk", text: "Sign-in needed — relaying is paused" };
  if (gh.relay.state === "offline")
    return { dot: "bg-faint/60", text: "Offline — can't reach the relay" };
  if (gh.relay.state === "reconnecting")
    return { dot: "bg-warnInk", text: "Reconnecting to the relay…" };
  return { dot: "bg-ok", text: "Live · managed relay" };
}

export function GithubDetail({ c, cloud, onChanged }: DetailProps) {
  const [adding, setAdding] = useState(false);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [status, setStatus] = useState<GithubStatus | null>(null);
  const load = () => {
    getSubscriptions().then(setSubs).catch(() => setSubs([]));
    getGithubStatus().then(setStatus).catch(() => setStatus(null));
  };
  useEffect(() => {
    load();
  }, [c.name]);

  const relay = c.mode === "relay";
  const installations = c.installations ?? [];
  const changed = () => {
    onChanged();
    load();
  };
  const listening = subs.filter((s) => s.channel.startsWith("github:"));

  return (
    <div data-testid="github-installations">
      <div className="flex items-center gap-3.5 mb-5">
        <ConnectorBadge connector={c} size={44} title="GitHub" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[20px] font-semibold tracking-tight leading-tight">GitHub</h2>
          <div className="text-[12.5px] text-muted flex items-center gap-1.5">
            {c.connected ? (
              <>
                <span
                  className={
                    "w-2 h-2 rounded-full " + (relay ? relayHealth(status).dot : "bg-ok")
                  }
                />
                <span data-testid="github-mode-badge">
                  {relay
                    ? relayHealth(status).text
                    : "Connected · personal access token"}
                </span>
              </>
            ) : (
              <span>Not connected</span>
            )}
          </div>
        </div>
        {(relay || !c.connected) && (
          <button
            className={PILL_ACCENT}
            data-testid="add-installation-btn"
            onClick={() => setAdding(true)}
          >
            ＋ Add installation
          </button>
        )}
      </div>

      {!c.connected && (
        <div className={GRP}>
          <div className={ROW + " text-[12.5px] text-muted"}>
            One @ocw-agent App, installed per account or org — you pick the repos on
            GitHub; each installation keeps its own allow-list.
            {cloud?.signed_in ? "" : " One-click needs cloud sign-in; a PAT works without it."}
          </div>
        </div>
      )}

      {relay &&
        installations.map((inst) => (
          <InstallationGroup
            key={inst.installation_id}
            c={c}
            inst={inst}
            tokenOk={status?.installs?.[inst.installation_id]?.token_ok !== false}
            onChanged={changed}
          />
        ))}

      {/* Manual PAT: request/response tools only — no inbound triggers. */}
      {c.connected && !relay && (
        <div className={GRP} data-testid="github-manual-card">
          <div className={ROW + " text-[12.5px] text-muted"}>
            Personal access token · tools only. Install the GitHub App to let
            @-mentions and the agent label reach this computer.
          </div>
        </div>
      )}

      {relay && listening.length > 0 && (
        <>
          <div className={GRP_H}>Listening</div>
          <div className={GRP}>
            <ListeningRows subs={listening} onChanged={changed} />
          </div>
        </>
      )}

      <ToolsDisclosure c={c} onChanged={onChanged} />
      {c.connected && relay && (
        <div className={FOOT + " mt-2"}>
          Triggers: @ocw-agent mentions and the “ocw-agent” label. The agent replies as
          ocw-agent[bot].
        </div>
      )}

      {adding && (
        <AddConnectionModal
          c={c}
          cloud={cloud}
          title="Add an installation"
          onClose={() => setAdding(false)}
          onChanged={changed}
        />
      )}
    </div>
  );
}

function InstallationGroup({
  c,
  inst,
  tokenOk,
  onChanged,
}: {
  c: Connector;
  inst: GithubInstallation;
  tokenOk: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const parked = (c.unauthorized ?? []).filter((m) => m.team_id === inst.installation_id);
  const empty = inst.allowed_users.length === 0 && parked.length === 0;

  const disconnect = async () => {
    setBusy(true);
    await disconnectGithubInstallation(inst.installation_id);
    setBusy(false);
    onChanged();
  };

  return (
    <div data-testid={`github-install-${inst.installation_id}`}>
      <div className={GRP_H + " flex items-center gap-2"}>
        <span>
          {inst.account_login}{" "}
          <span className="font-normal text-faint" title={`installation ${inst.installation_id}`}>
            · {inst.repo_selection === "all" ? "all repos" : "selected repos"}
          </span>
        </span>
        {!tokenOk && (
          <span className={TAG_WARN} data-testid={`token-warn-${inst.installation_id}`}>
            ⚠ Installation revoked — reinstall
          </span>
        )}
      </div>
      <div className={GRP}>
        {empty ? (
          <div className={ROW}>
            <span className="min-w-0 flex-1 text-[12.5px] text-muted">
              No one allowed yet — @ocw-agent mentions show up here for your OK.
            </span>
            <DisconnectBtn id={inst.installation_id} busy={busy} onClick={disconnect} />
          </div>
        ) : (
          <>
            <PeopleRow
              allowed={inst.allowed_users}
              installationId={inst.installation_id}
              onChanged={onChanged}
            />
            {parked.map((m) => (
              <WaitingRow key={m.id} m={m} onChanged={onChanged} />
            ))}
            <div className={ROW}>
              <span className="flex-1" />
              <DisconnectBtn id={inst.installation_id} busy={busy} onClick={disconnect} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DisconnectBtn({ id, busy, onClick }: { id: string; busy: boolean; onClick: () => void }) {
  return (
    <button
      className="text-[12.5px] text-danger/80 hover:text-danger shrink-0"
      data-testid={`disconnect-install-${id}`}
      title="Stops relaying this installation to this computer. The App stays installed on GitHub."
      onClick={onClick}
      disabled={busy}
    >
      {busy ? "Disconnecting…" : "Disconnect installation"}
    </button>
  );
}

function PeopleRow({
  allowed,
  installationId,
  onChanged,
}: {
  allowed: string[];
  installationId: string;
  onChanged: () => void;
}) {
  return (
    <div className={ROW}>
      <span className={LABEL}>People</span>
      <span className="min-w-0 flex-1 flex flex-wrap items-center gap-1.5">
        {allowed.length === 0 && (
          <span className="text-[12px] text-faint">nobody yet — approve a waiting sender below</span>
        )}
        {allowed.map((login) => (
          <span
            key={login}
            className="inline-flex items-center gap-1.5 pl-2 pr-2 py-0.5 rounded-full bg-paper border border-line text-[12.5px]"
          >
            {/* GitHub logins ARE the readable identity — no resolution needed. */}
            @{login}
            <button
              className={XBTN}
              title="remove"
              onClick={() => disallowUser("github", login, installationId).then(onChanged)}
            >
              ×
            </button>
          </span>
        ))}
      </span>
    </div>
  );
}

function WaitingRow({ m, onChanged }: { m: ParkedMessage; onChanged: () => void }) {
  const act = async (action: "dismiss" | "allow" | "allow_deliver") => {
    await resolveUnauthorized("github", m.id, action);
    onChanged();
  };
  return (
    <div className={ROW + " bg-warnSoft/25"} data-testid={`waiting-${m.id}`}>
      <span className={LABEL}>Waiting</span>
      <span className="min-w-0 flex-1">
        <span className="font-medium text-[13px]">@{m.user_name || m.user_id}</span>{" "}
        <span className="text-[12.5px] text-muted">in {m.chat_name || m.chat_id}</span>
        <span className="block text-[12.5px] text-muted truncate">“{m.text}”</span>
      </span>
      <button
        className={PILL_ACCENT + " !py-1"}
        data-testid={`parked-allow-deliver-${m.id}`}
        title="Allow the sender and deliver this mention now"
        onClick={() => act("allow_deliver")}
      >
        Allow & deliver
      </button>
      <button
        className={PILL_LINE + " !py-1"}
        data-testid={`parked-allow-${m.id}`}
        title="Allow the sender; this mention is discarded"
        onClick={() => act("allow")}
      >
        Allow
      </button>
      <button className={XBTN + " px-1"} data-testid={`parked-dismiss-${m.id}`} title="Dismiss" onClick={() => act("dismiss")}>
        ×
      </button>
    </div>
  );
}

function ListeningRows({ subs, onChanged }: { subs: Subscription[]; onChanged: () => void }) {
  return (
    <div className={ROW} data-testid="listening-github">
      <span className={LABEL}>Listening</span>
      <span className="min-w-0 flex-1 space-y-1">
        {subs.map((s) => (
          <span key={s.session_id + s.channel} className="flex items-center gap-2 text-[12.5px]">
            <span className="font-medium truncate" title={s.session_id}>
              {s.session_title || s.session_id}
            </span>
            <span className="text-faint">←</span>
            <span className="text-muted truncate" title={s.channel}>
              {s.channel.replace(/^github:/, "")}
            </span>
            <button
              className={XBTN + " ml-auto"}
              title="Unsubscribe this session"
              onClick={async () => {
                await unsubscribeChannel(s.session_id, s.channel);
                onChanged();
              }}
            >
              ×
            </button>
          </span>
        ))}
      </span>
    </div>
  );
}
