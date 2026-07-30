import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface ClientModel {
  app: string;
  selected: string | null;
}

export interface ModelProfiles {
  available: string[];
  clients: ClientModel[];
}

/**
 * Which models the connected account may run, and what each client is set to.
 *
 * The catalog is never assembled here: Connect asks BoxAI, because the
 * answer is account-scoped and a desktop build cannot know it.
 */
export function useBoxAIModels(enabled: boolean) {
  const [profiles, setProfiles] = useState<ModelProfiles | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setProfiles(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setProfiles(await invoke<ModelProfiles>("boxai_model_profiles"));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const select = useCallback(
    async (app: string, model: string) => {
      setError(null);
      try {
        await invoke("boxai_model_select", { app, model });
        await refresh();
      } catch (e) {
        setError(String(e));
      }
    },
    [refresh],
  );

  return { profiles, loading, error, select, refresh };
}
