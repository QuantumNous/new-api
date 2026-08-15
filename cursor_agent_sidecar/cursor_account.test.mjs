import assert from "node:assert/strict";
import test from "node:test";

import { fetchCursorAccount } from "./cursor_account.mjs";

test("normalizes Cursor SDK user metadata without exposing the api key", async () => {
  const calls = [];
  const cursor = {
    me: async (options) => {
      calls.push(["me", options]);
      return {
        apiKeyName: "new-api test",
        userId: 1234,
        userEmail: "owner@example.com",
        userFirstName: "Sunny",
        userLastName: "Ender",
        createdAt: "2026-08-14T01:02:03.000Z",
      };
    },
    models: {
      list: async (options) => {
        calls.push(["models", options]);
        return [{ id: "grok-4.6" }, { id: "claude-fable-5" }];
      },
    },
  };

  const result = await fetchCursorAccount("secret-cursor-key", cursor);

  assert.deepEqual(calls, [
    ["me", { apiKey: "secret-cursor-key" }],
    ["models", { apiKey: "secret-cursor-key" }],
  ]);
  assert.deepEqual(result.account, {
    api_key_name: "new-api test",
    user_id: 1234,
    email: "owner@example.com",
    first_name: "Sunny",
    last_name: "Ender",
    display_name: "Sunny Ender",
    api_key_created_at: "2026-08-14T01:02:03.000Z",
    account_kind: "user",
  });
  assert.equal(result.catalog.model_count, 2);
  assert.equal(result.quota.available, false);
  assert.equal(result.quota.reason, "account_quota_not_exposed");
  assert.equal(JSON.stringify(result).includes("secret-cursor-key"), false);
});

test("marks SDK service-account keys without inventing a user identity", async () => {
  const cursor = {
    me: async () => ({
      apiKeyName: "Service key",
      createdAt: "2026-08-14T01:02:03.000Z",
    }),
    models: { list: async () => [] },
  };

  const result = await fetchCursorAccount("secret", cursor);

  assert.equal(result.account.account_kind, "service_account");
  assert.equal(result.account.user_id, null);
  assert.equal(result.account.email, null);
  assert.equal(result.catalog.model_count, 0);
});
