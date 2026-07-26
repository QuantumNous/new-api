import { useState } from "react";
import { chooseFolder } from "../tauri";
import { Icon } from "./Icon";
import { useTranslation } from "react-i18next";

// A single "Give access to a folder" affordance. Collapsed it's one button; expanded it's a path
// field (Browse on desktop, paste anywhere) + an "Allow writing" checkbox that's OFF by default —
// so access is read-only unless explicitly granted. Used by the composer chip and the start panel.
export function AddFolderForm({
  onAdd,
  busy,
  compact,
  startOpen,
  onDismiss,
}: {
  onAdd: (path: string, writable: boolean) => Promise<boolean> | boolean | void;
  busy?: boolean;
  compact?: boolean;
  // Render the form expanded immediately (the caller owns the trigger); Cancel/success then
  // notify via onDismiss so the caller can collapse it.
  startOpen?: boolean;
  onDismiss?: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(!!startOpen);
  const [path, setPath] = useState("");
  const [writable, setWritable] = useState(false);

  const reset = () => {
    setOpen(false);
    setPath("");
    setWritable(false);
    onDismiss?.();
  };

  const browse = async () => {
    const p = await chooseFolder();
    if (p) setPath(p);
  };

  const submit = async () => {
    if (!path.trim()) return;
    const ok = await onAdd(path.trim(), writable);
    if (ok !== false) reset();
  };

  if (!open) {
    return (
      <button className={"addfolder-trigger" + (compact ? " compact" : "")} onClick={() => setOpen(true)}>
        <Icon name="folderPlus" size={15} /> {t("Give access to a folder")}
      </button>
    );
  }

  return (
    <div className="addfolder-form">
      <div className="addfolder-row">
        <input
          className="addfolder-path"
          autoFocus
          placeholder={t("Choose or paste a folder path…")}
          value={path}
          spellCheck={false}
          onChange={(e) => setPath(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            else if (e.key === "Escape") reset();
          }}
        />
        <button className="btn icon-only" onClick={browse} title={t("Choose location")} aria-label={t("Choose location")}>
          <Icon name="folder" size={15} />
        </button>
      </div>
      <div className="addfolder-actions">
        <label className="addfolder-write" title={t("Off = read-only. Tick to let the agent write here.")}>
          <input type="checkbox" checked={writable} onChange={(e) => setWritable(e.target.checked)} />
          {t("Allow writes")}
        </label>
        <span className="spacer" />
        <button className="btn" onClick={reset}>
          {t("Cancel")}
        </button>
        <button className="btn primary" disabled={busy || !path.trim()} onClick={submit}>
          {t("Add")}
        </button>
      </div>
    </div>
  );
}
