import { useCallback, useEffect, useState } from "react";
import { addRoot, getRoots, removeRoot, type RootInfo } from "./api";

// Shared roots state for a session — used by the Session settings drawer's Working-directories
// section, the settings row's folder glance, and the session start panel. Reads are live;
// mutations go through the manager, which applies them to the running engine and persists them.
// `reloadKey` bumps force a refetch (e.g. when the drawer reopens).
export function useRoots(sessionId: string, reloadKey?: number) {
  const [roots, setRoots] = useState<RootInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(
    () => getRoots(sessionId).then(setRoots).catch(() => setRoots([])),
    [sessionId],
  );
  useEffect(() => {
    reload();
  }, [reload, reloadKey]);

  // Several components hold their own instance of this hook (composer chip, start panel) — a
  // mutation in one broadcasts so the others refetch and stay in sync.
  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent).detail === sessionId) reload();
    };
    window.addEventListener("coworker:roots-changed", onChanged);
    return () => window.removeEventListener("coworker:roots-changed", onChanged);
  }, [sessionId, reload]);

  const apply = (res: { ok: boolean; error?: string; roots?: RootInfo[] }): boolean => {
    if (res.ok && res.roots) {
      setRoots(res.roots);
      setError("");
      window.dispatchEvent(new CustomEvent("coworker:roots-changed", { detail: sessionId }));
      return true;
    }
    setError(res.error || "could not update directories");
    reload();
    return false;
  };

  const add = useCallback(
    async (path: string, writable: boolean): Promise<boolean> => {
      setBusy(true);
      const ok = apply(await addRoot(sessionId, path, writable));
      setBusy(false);
      return ok;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId],
  );

  const toggleAccess = useCallback(
    async (r: RootInfo) => {
      if (r.primary) return;
      setBusy(true);
      apply(await addRoot(sessionId, r.path, !r.writable)); // re-add updates access in place
      setBusy(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId],
  );

  const remove = useCallback(
    async (path: string) => {
      setBusy(true);
      apply(await removeRoot(sessionId, path));
      setBusy(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId],
  );

  return { roots, busy, error, reload, addRoot: add, toggleAccess, removeRoot: remove };
}
