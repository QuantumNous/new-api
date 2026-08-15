import { Cursor } from "@cursor/sdk";

function optionalString(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

export async function fetchCursorAccount(apiKey, cursor = Cursor) {
  const [user, models] = await Promise.all([
    cursor.me({ apiKey }),
    cursor.models.list({ apiKey }),
  ]);

  const firstName = optionalString(user?.userFirstName);
  const lastName = optionalString(user?.userLastName);
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || null;

  return {
    account: {
      api_key_name: optionalString(user?.apiKeyName),
      user_id: Number.isFinite(Number(user?.userId))
        ? Number(user.userId)
        : null,
      email: optionalString(user?.userEmail),
      first_name: firstName,
      last_name: lastName,
      display_name: displayName,
      api_key_created_at: optionalString(user?.createdAt),
      account_kind: user?.userId == null ? "service_account" : "user",
    },
    catalog: {
      model_count: Array.isArray(models) ? models.length : 0,
    },
    quota: {
      available: false,
      source: "cursor_sdk",
      reason: "account_quota_not_exposed",
    },
  };
}
