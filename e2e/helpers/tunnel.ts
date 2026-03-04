/**
 * Cloudflared tunnel helper for webhook E2E tests.
 *
 * Uses cloudflared (Cloudflare Tunnel) to expose a local HTTP server to the internet,
 * allowing Waffo sandbox to send real webhook notifications to the local server.
 * No authentication required — uses free quick tunnels (trycloudflare.com).
 */

import { execSync, spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';

const CLOUDFLARED_BIN = '/opt/homebrew/bin/cloudflared';
const MAX_WAIT_MS = 90_000;
const POLL_INTERVAL_MS = 1_000;
const LOG_FILE = '/tmp/cloudflared-e2e.log';

let tunnelProcess: ChildProcess | null = null;

/**
 * Start a cloudflared tunnel for the given port.
 * Kills any existing cloudflared tunnel process first, then spawns a new one
 * and polls the log file until the public URL appears.
 *
 * @param port - Local port to tunnel (e.g. 3000)
 * @returns The public HTTPS URL of the tunnel (e.g. https://xxx.trycloudflare.com)
 */
export async function startTunnel(port: number): Promise<string> {
  console.log(`[tunnel] Starting cloudflared tunnel for localhost:${port}...`);

  // Kill any existing cloudflared tunnel processes to avoid conflicts
  try {
    execSync('pkill -f "cloudflared tunnel" 2>/dev/null || true', {
      stdio: 'ignore',
    });
    console.log('[tunnel] Killed existing cloudflared tunnel processes');
  } catch {
    // Ignore errors — no existing process is fine
  }

  await sleep(1000);

  // Remove old log file to avoid matching stale URLs
  try {
    fs.unlinkSync(LOG_FILE);
    console.log(`[tunnel] Removed old log file: ${LOG_FILE}`);
  } catch {
    // Ignore — file may not exist
  }

  // Start cloudflared tunnel, writing stderr (where URL appears) to log file
  // Use --protocol http2 because QUIC often fails with timeout errors
  console.log(
    `[tunnel] Spawning: ${CLOUDFLARED_BIN} tunnel --url http://localhost:${port} --protocol http2`
  );
  const logFd = fs.openSync(LOG_FILE, 'w');
  tunnelProcess = spawn(
    CLOUDFLARED_BIN,
    ['tunnel', '--url', `http://localhost:${port}`, '--protocol', 'http2'],
    {
      stdio: ['ignore', 'ignore', logFd],
      detached: true,
    }
  );

  tunnelProcess.unref();
  fs.closeSync(logFd);

  console.log(`[tunnel] Process spawned (PID: ${tunnelProcess.pid}), waiting for URL...`);

  // Poll log file for the tunnel URL
  const urlPattern = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_WAIT_MS) {
    await sleep(POLL_INTERVAL_MS);

    try {
      const logContent = fs.readFileSync(LOG_FILE, 'utf-8');
      const match = logContent.match(urlPattern);
      if (match) {
        const tunnelUrl = match[0];
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(
          `[tunnel] URL found in ${elapsed}s: ${tunnelUrl} -> localhost:${port}`
        );

        // Verify the tunnel actually forwards by checking the log for
        // "Registered tunnel connection" which confirms edge connectivity
        if (logContent.includes('Registered tunnel connection')) {
          console.log('[tunnel] Tunnel connection registered, waiting for DNS propagation...');
          await sleep(15000);
          console.log('[tunnel] Verifying forwarding...');
          try {
            const resp = await fetch(`${tunnelUrl}/api/status`, { signal: AbortSignal.timeout(10000) });
            if (resp.ok) {
              console.log(`[tunnel] Forwarding verified: ${tunnelUrl} -> localhost:${port}`);
              return tunnelUrl;
            }
            console.log(`[tunnel] Forwarding check returned status ${resp.status}, retrying...`);
          } catch (verifyErr) {
            console.log(`[tunnel] Forwarding check failed: ${verifyErr}, retrying...`);
          }
        } else {
          console.log('[tunnel] URL assigned but connection not yet registered, waiting...');
        }
      }
    } catch {
      // Log file not ready yet, keep polling
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(`[tunnel] Waiting for URL... (${elapsed}s elapsed)`);
  }

  // Timed out — clean up and throw
  console.log(`[tunnel] Timed out after ${MAX_WAIT_MS / 1000}s`);
  stopTunnel();
  throw new Error(
    `cloudflared tunnel failed to start within ${MAX_WAIT_MS / 1000}s. Check ${LOG_FILE} for details.`
  );
}

/**
 * Stop the cloudflared tunnel.
 * Sends SIGTERM to the process group and also runs pkill as a safety net.
 */
export function stopTunnel(): void {
  console.log('[tunnel] Stopping cloudflared tunnel...');

  if (tunnelProcess) {
    try {
      process.kill(-tunnelProcess.pid!, 'SIGTERM');
      console.log(`[tunnel] Sent SIGTERM to process group (PID: ${tunnelProcess.pid})`);
    } catch {
      // Process may already be dead
      console.log('[tunnel] Process already terminated');
    }
    tunnelProcess = null;
  }

  // Safety net: kill any remaining cloudflared tunnel processes
  try {
    execSync('pkill -f "cloudflared tunnel" 2>/dev/null || true', {
      stdio: 'ignore',
    });
    console.log('[tunnel] Cleaned up remaining cloudflared processes');
  } catch {
    // Ignore
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
