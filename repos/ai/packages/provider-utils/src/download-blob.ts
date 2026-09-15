import { cancelResponseBody } from './cancel-response-body';
import { DownloadError } from './download-error';
import { fetchWithValidatedRedirects } from './fetch-with-validated-redirects';
import {
  readResponseWithSizeLimit,
  DEFAULT_MAX_DOWNLOAD_SIZE,
} from './read-response-with-size-limit';

/**
 * Download a file from a URL and return it as a Blob.
 *
 * @param url - The URL to download from.
 * @param options - Optional settings for the download.
 * @param options.maxBytes - Maximum allowed download size in bytes. Defaults to 100 MiB.
 * @param options.abortSignal - An optional abort signal to cancel the download.
 * @returns A Promise that resolves to the downloaded Blob.
 *
 * @throws DownloadError if the download fails or exceeds maxBytes.
 */
export async function downloadBlob(
  url: string,
  options?: { maxBytes?: number; abortSignal?: AbortSignal },
): Promise<Blob> {
  try {
    const response = await fetchWithValidatedRedirects({
      url,
      abortSignal: options?.abortSignal,
    });

    if (!response.ok) {
      // Release the connection before rejecting so an error status from an
      // attacker-controlled origin cannot leak open sockets.
      await cancelResponseBody(response);
      throw new DownloadError({
        url,
        statusCode: response.status,
        statusText: response.statusText,
      });
    }

    const data = await readResponseWithSizeLimit({
      response,
      url,
      maxBytes: options?.maxBytes ?? DEFAULT_MAX_DOWNLOAD_SIZE,
    });

    const contentType = response.headers.get('content-type') ?? undefined;
    return new Blob([data], contentType ? { type: contentType } : undefined);
  } catch (error) {
    if (DownloadError.isInstance(error)) {
      throw error;
    }

    throw new DownloadError({ url, cause: error });
  }
}
