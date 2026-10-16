/**
 * Bridges Ctrl+C (SIGINT) to an `AbortController` so an in-flight AI SDK call
 * can run its cancel/teardown logic before the process exits.
 *
 * Without this, Ctrl+C terminates the Node process immediately and any
 * provider-side cancel request (e.g. Gemini's
 * `POST /interactions/{id}/cancel`) never goes out -- the run keeps billing
 * on the server until it completes naturally.
 *
 * Usage:
 *   const ac = cancelOnSigint();
 *   await generateText({ ..., abortSignal: ac.signal });
 *
 * Pressing Ctrl+C once aborts the call (giving the SDK time to fire its
 * server-side cancel); a second Ctrl+C exits hard. A `gracePeriodMs` backstop
 * also force-exits if the cancel hangs.
 */
export function cancelOnSigint({
  gracePeriodMs = 5000,
}: { gracePeriodMs?: number } = {}): AbortController {
  const ac = new AbortController();

  const onSigint = () => {
    if (ac.signal.aborted) {
      console.log('\nSecond SIGINT received, exiting hard.');
      process.exit(130);
    }
    console.log(
      `\nSIGINT received, cancelling (up to ${gracePeriodMs}ms grace)...`,
    );
    ac.abort();
    setTimeout(() => process.exit(130), gracePeriodMs).unref();
  };

  process.on('SIGINT', onSigint);
  return ac;
}
