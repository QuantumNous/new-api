---
title: Redeem a Code
description: Enter a redemption code in your Wallet to add credit to your account, then verify the result.
---

Once you have a redemption code, redeem it in your [Wallet](https://{{API_HOST}}/wallet) to add the code's credit to the **account you are signed in to** for future API calls.

:::caution[Confirm your account and keep the code safe]
A redemption code is a top-up voucher, and each code can be redeemed successfully only once. Before redeeming, make sure you are signed in to the account you want to top up. Do not share unused codes in group chats, documents, or screenshots.

A redemption code is **not an API key**. Do not paste it into a client's API key field. The screenshots on this page show placeholder text instead of real codes; enter the full code you received.
:::

## Step 1: Open your Wallet and find the redemption section

1. Sign in to the [DeepPattern API console](https://{{API_HOST}}/dashboard) and click **Personal → Wallet** in the left sidebar, or open the [Wallet page](https://{{API_HOST}}/wallet) directly.
2. Find the **Add funds** card and scroll down to the **Have a redemption code?** section.

<figure class="tutorial-figure">
  <a href="/images/tutorials/start/redemption-entry.webp" target="_blank" rel="noreferrer">
    <img src="/images/tutorials/start/redemption-entry.webp" alt="Redemption entry, numbered: 1 open Wallet in the Personal menu, 2 find the Have a redemption code? section at the bottom of the Add funds card" width="2000" height="1160" loading="lazy" />
  </a>
  <figcaption>Follow steps 1–2 to find the entry. Redemption happens in Wallet, not on the admin Redemption Codes management page. Click the image to enlarge.</figcaption>
</figure>

## Step 2: Paste the code and click Redeem

Follow steps **3–4** in the image below:

1. Paste your **full redemption code** into the **Enter your redemption code** field. Make sure there are no leading or trailing spaces or line breaks.
2. Click **Redeem** to the right of the field and wait for the result. Do not submit again while it is processing.

**You do not need to select a top-up amount above or click a payment method such as Card.** The credit added is determined by the code itself and is unrelated to the page's "Custom amount" field.

<figure class="tutorial-figure">
  <a href="/images/tutorials/start/redemption-submit.webp" target="_blank" rel="noreferrer">
    <img src="/images/tutorials/start/redemption-submit.webp" alt="Redemption steps, numbered: 3 paste the full code into the field, 4 click the Redeem button on the right; no need to choose a top-up amount or Card" width="2000" height="840" loading="lazy" />
  </a>
  <figcaption>The text "Paste your own full redemption code" in the image is a placeholder, not a valid code. The image only shows where to enter it; no real redemption was performed.</figcaption>
</figure>

## Step 3: Verify the credit

After a successful redemption, the page shows **Redeemed successfully! Added: …**, clears the input field, and refreshes your account information.

1. Check the amount added in the success message.
2. Return to the top of the Wallet and verify your **Current balance**. If it has not updated, refresh the Wallet page.
3. Once the balance is updated, follow [Create an API key](/en/start/api-key/) and the [Quickstart](/en/start/quickstart/) to start calling models. Existing API keys do not need to be recreated after a top-up.

**Your account balance and an API key's spending limit are separate.** Redeeming increases your account balance but does not raise any API key's spending limit. If you still see an insufficient quota error, check whether the key has remaining quota. See [Billing and usage](/en/guides/billing/).

## Troubleshooting

| Symptom | What to check |
|---|---|
| Can't find the redemption section | Make sure you are in Wallet and have scrolled to the bottom of Add funds. If the page says redemption is disabled or requires accepting compliance terms, contact your administrator |
| Redemption fails | Check that the code was copied in full with no extra spaces. The code may have been used, expired, or disabled; contact the issuer to verify. The error message may not distinguish between these causes |
| Not sure whether redemption succeeded | Check the success message and your Wallet balance, and refresh if needed. Do not resubmit the same code to find out |
| Redeemed, but the API still reports insufficient quota | Check both your account balance and the API key's remaining quota; top-ups do not change a key's spending limit |

The images on this page are based on partial screenshots of the Wallet interface and the actual page layout, cropped, annotated, and with sensitive information replaced. They contain no real redemption codes or account balances and do not represent a completed top-up.
