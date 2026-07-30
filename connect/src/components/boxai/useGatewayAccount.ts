import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { invoke } from "@tauri-apps/api/core";

export interface GatewayAccount {
  id: number;
  username: string;
  display_name: string;
  email: string;
  quota: number;
}

export interface GatewayStatus {
  connected: boolean;
  account: GatewayAccount | null;
  portalHost: string;
  aiHost: string;
  message: string | null;
}

export interface GatewayAccountState {
  status: GatewayStatus | null;
  /** True until the stored credential has been read for the first time. */
  loading: boolean;
  /** True while the browser sign-in is waiting for the user to approve. */
  pending: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * BoxAI sign-in state.
 *
 * Signing in opens the system browser and waits for the loopback callback the
 * backend is listening on. The authorization code, the PKCE verifier and the
 * resulting access token are deliberately absent here: the whole exchange
 * happens in Rust and only the outcome crosses into the renderer.
 */
export function useGatewayAccountState(): GatewayAccountState {
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await invoke<GatewayStatus>("gateway_auth_status"));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(async () => {
    setError(null);
    setPending(true);
    try {
      const result = await invoke<GatewayStatus>("gateway_browser_login");
      setStatus(result);
      if (!result.connected && result.message) setError(result.message);
    } catch (e) {
      setError(String(e));
    } finally {
      setPending(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      await invoke("gateway_logout");
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }, [refresh]);

  return { status, loading, pending, error, signIn, signOut, refresh };
}

const GatewayAccountContext = createContext<GatewayAccountState | null>(null);

export const GatewayAccountProvider = GatewayAccountContext.Provider;

/**
 * The one account state the app shares.
 *
 * The sign-in gate and the account panel must never disagree about whether an
 * account is connected — signing out inside the app has to put the gate back up.
 */
export function useGatewayAccount(): GatewayAccountState {
  const state = useContext(GatewayAccountContext);
  if (!state) {
    throw new Error("useGatewayAccount requires GatewayAccountProvider");
  }
  return state;
}
