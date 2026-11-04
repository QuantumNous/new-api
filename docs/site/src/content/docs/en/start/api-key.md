---
title: Create an API Key
description: Create a key for your first request and set a spending limit.
---

## Step 1: Open the creation page

Sign in to the console, go to [API Keys](https://{{API_HOST}}/keys), and click **Create API key** in the upper-right corner.

## Step 2: Configure the key

For a first test, use the settings below; adjust the budget and expiration for production use.

| Setting | Example | Notes |
|---|---|---|
| Name | `quickstart-demo` | Identifies what the key is for |
| Group | `ChatGPT` | Matches the text model in the [Quickstart](/en/start/quickstart/) |
| Expiration | Click **1 day** | The key expires automatically after testing |
| Quantity | `1` | Creates one key |
| Unlimited quota | Off | When on, the key has no spending limit; this does not mean free |
| Quota (USD) | `1` | The key can use at most $1 of credit |

<figure class="tutorial-figure">
  <a href="/images/tutorials/start/key-create.webp" target="_blank" rel="noreferrer">
    <img src="/images/tutorials/start/key-create.webp" alt="Create API key: name quickstart-demo, ChatGPT group, 1-day expiration, and $1 quota" width="1240" height="1880" loading="lazy" />
  </a>
  <figcaption>Example configuration. When finished, click "Save changes" at the bottom.</figcaption>
</figure>

**A key's quota is not your account balance.** Setting a $1 limit does not add credit to your account; requests still require available account credit. Check your balance in your [Wallet](https://{{API_HOST}}/wallet). If you have a redemption code, first add credit by following [Redeem a code](/en/start/redeem/).

For other models, choose the group shown in the model details. To use models across groups, select `auto`; see [Model Square and groups](/en/start/models/). Model and IP access restrictions are configured under **Advanced settings**.

## Step 3: Copy the key

After saving, find the key in the list and click the copy icon next to it, or open **`···` → Copy key**. This copies the full key, not the masked text shown in the list.

<figure class="tutorial-figure">
  <a href="/images/tutorials/start/key-copy.webp" target="_blank" rel="noreferrer">
    <img src="/images/tutorials/start/key-copy.webp" alt="API key list: the copy icon and the Copy key option in the actions menu" width="1600" height="430" loading="lazy" />
  </a>
  <figcaption>Where to copy the key. Key and account fields are hidden.</figcaption>
</figure>

Never put keys in browser front-end code, public repositories, or screenshots. If a key is leaked, disable or delete it in the list immediately.

Next: [Send your first request](/en/start/quickstart/), or [import into CC Switch](/en/clients/cc-switch/).
