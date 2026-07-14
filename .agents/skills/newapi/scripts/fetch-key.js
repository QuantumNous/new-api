/**
 * Shared token key fetcher for new-api scripts.
 *
 * Calls POST /api/token/{id}/key and returns the full "sk-..." key.
 * The key is returned in memory only — it is never logged, printed,
 * or written to any output by this module.
 *
 * @param {string|number} tokenId
 * @param {{ baseUrl: string, accessToken: string, userId: string }} config
 * @returns {Promise<string>} full key with "sk-" prefix
 */
async function fetchTokenKey(tokenId, { baseUrl, accessToken, userId }) {
  const res = await fetch(`${baseUrl}/api/token/${tokenId}/key`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "New-Api-User": userId,
    },
  });

  if (res.status >= 400) {
    const errText = await res.text();
    let msg = `HTTP ${res.status}`;
    try {
      const errJson = JSON.parse(errText);
      if (errJson.message) msg = errJson.message;
    } catch {}
    throw new Error(msg);
  }

  const body = await res.json();

  if (!body.success && !body.data) {
    throw new Error(body.message || "Unknown API error");
  }

  const rawKey = body.data?.key;
  if (!rawKey) {
    throw new Error("API response did not contain a key");
  }

  return "sk-" + rawKey;
}

module.exports = { fetchTokenKey };
