/**
 * Cancels a response body to release the underlying connection.
 *
 * When a fetch Response is rejected without consuming its body (e.g. a failed
 * status code, an open-redirect rejection, or a Content-Length that exceeds the
 * size limit), the underlying TCP socket is not returned to the connection pool
 * and may stay open until the process runs out of file descriptors. Cancelling
 * the body avoids this leak.
 *
 * Errors thrown while cancelling are ignored: the body may already be locked,
 * disturbed, or absent, none of which should mask the original rejection.
 */
export async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Ignore cancel errors so the original rejection is preserved.
  }
}
