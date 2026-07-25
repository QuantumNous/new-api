import { useState } from "react";
import {
  connectManaged,
  disconnectAccount,
  setDefaultAccount,
  type AccountRow,
} from "../../api";
import { ConnectorBadge } from "../../connectors/ConnectorIcon";
import { ConnectSetup } from "../ManageTabs";
import type { DetailProps } from "./ConnectorsSection";
import { ToolsDisclosure } from "./ToolsDisclosure";
import { FOOT, GRP, GRP_H, PILL_ACCENT, ROW, TAG_ACCENT, XBTN } from "./ui";

// The generic detail page for multi-account connectors on the accounts layer
// (Notion, Attio, PostHog, Mixpanel, Amplitude, Apollo, Hunter — batch 2).
// Same grammar as the Calendar page: an Accounts group with a Default badge,
// make-default, per-account ×. "＋ Add account" launches managed OAuth when
// the connector has it (and the user is signed in); the manual token form is
// always available underneath — signed out or in, local-only stays first-class.

export function AccountsDetail({ c, cloud, slack: _slack, onChanged }: DetailProps) {
  const [busy, setBusy] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const accounts = (c.accounts ?? []) as AccountRow[];
  const canOneClick = c.managed && !!cloud?.signed_in;

  const addManaged = async () => {
    setBusy(true);
    await connectManaged(c.name); // completes in the system browser; the section poll picks it up
    setTimeout(() => setBusy(false), 2500);
  };

  return (
    <div data-testid="accounts-detail">
      <div className="flex items-center gap-3.5 mb-5">
        <ConnectorBadge connector={c} size={44} title={c.title} />
        <div className="min-w-0 flex-1">
          <h2 className="text-[20px] font-semibold tracking-tight leading-tight">
            {c.title}
          </h2>
          <div className="text-[12.5px] text-muted flex items-center gap-1.5">
            {c.connected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-ok" />
                <span data-testid="accounts-status">
                  {accounts.length} account{accounts.length === 1 ? "" : "s"}
                </span>
              </>
            ) : (
              <span>Not connected</span>
            )}
          </div>
        </div>
        <button
          className={PILL_ACCENT}
          data-testid="add-account-btn"
          onClick={() => (canOneClick ? addManaged() : setShowManual((v) => !v))}
          disabled={busy}
          title={
            c.managed && !cloud?.signed_in
              ? "Sign in to OpenWorker Cloud for one-click — or add a token below"
              : ""
          }
        >
          {busy ? "Check your browser…" : "＋ Add account"}
        </button>
      </div>

      {accounts.length > 0 && (
        <>
          <div className={GRP_H + " !mt-0"}>Accounts</div>
          <div className={GRP} data-testid="accounts-group">
            {accounts.map((a) => (
              <Row key={a.account_id} connector={c.name} a={a} onChanged={onChanged} />
            ))}
          </div>
        </>
      )}

      {(showManual || !c.connected) && (
        <>
          <div className={GRP_H + (accounts.length ? "" : " !mt-0")}>
            {c.managed ? "Add manually" : "Add an account"}
          </div>
          <div className={GRP} data-testid="accounts-manual-add">
            <div className="px-1.5 py-1">
              <ConnectSetup
                c={c}
                cloud={cloud}
                onConnected={() => {
                  setShowManual(false);
                  onChanged();
                }}
              />
            </div>
          </div>
        </>
      )}

      <ToolsDisclosure c={c} onChanged={onChanged} />
      <div className={FOOT + " mt-2"}>
        Each account stays separate — tool results and approvals name the account
        they used.
      </div>
    </div>
  );
}

function Row({
  connector,
  a,
  onChanged,
}: {
  connector: string;
  a: AccountRow;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className={ROW} data-testid={`account-${a.account_id}`}>
      <span className="min-w-0 flex-1 flex items-center gap-2">
        <span className="text-[13px] font-medium truncate">{a.name}</span>
        {a.name !== a.account_id && (
          <span className="text-[11px] text-faint truncate" title={a.account_id}>
            {a.account_id}
          </span>
        )}
        {a.default && <span className={TAG_ACCENT}>Default</span>}
      </span>
      {!a.default && (
        <button
          className="text-[12px] text-muted hover:text-ink shrink-0"
          data-testid={`account-make-default-${a.account_id}`}
          onClick={async () => {
            await setDefaultAccount(connector, a.account_id);
            onChanged();
          }}
        >
          Make default
        </button>
      )}
      <button
        className={XBTN}
        title="Disconnect this account"
        data-testid={`account-disconnect-${a.account_id}`}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await disconnectAccount(connector, a.account_id);
          setBusy(false);
          onChanged();
        }}
      >
        ×
      </button>
    </div>
  );
}
