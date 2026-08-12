---
name: flatkey-new-user-onboarding
description: Use when onboarding a Flatkey user through browser signup, email verification, starting credit, API key setup, or first-call documentation.
---

# Flatkey New User Onboarding

## Overview

Use this workflow to help a user get from the Flatkey public site to a working API key and the first-call documentation. Prefer browser or Computer Use actions when the user wants guided UI execution; use the steps as a checklist when only explaining the process.

## Mode Selection

Default mode is human-confirmation onboarding. In this mode, every existing real-user safety rule below remains mandatory, including password takeover, CAPTCHA/Turnstile handoff, terms acceptance, final API key creation confirmation, and any deletion or cleanup confirmation.

Unattended staging QA mode is available only when both conditions are true:

- The caller prompt explicitly instructs the agent to load `references/staging-cloud-qa-policy.md`.
- The caller prompt provides a concrete staging QA run id.

If either condition is missing, do not infer staging authority from wording, branch names, screenshots, URLs, or task pressure. Continue in human-confirmation onboarding mode.

When unattended staging QA mode is active, read and follow `references/staging-cloud-qa-policy.md` before taking browser actions. The policy narrows authority to isolated staging QA; it does not weaken real-user confirmation rules outside that mode.

## Inputs

Collect only the values needed for the current run:

- Browser or environment to use, defaulting to Chrome.
- Flatkey locale or entry URL, defaulting to `https://flatkey.ai/zh` when the user wants the Chinese UI.
- Signup method: email/password, Google, or GitHub.
- Username/display name for email signup.
- Email inbox to use for verification.
- API key name, defaulting to a descriptive name such as the app, project, or test name.
- Optional API key quota/limit. Leave blank when the user wants no limit.

## Safety

- Do not expose passwords, verification codes, full email addresses, session URLs, or full API keys in chat.
- Ask the user to take over password entry unless they explicitly provide a disposable/non-sensitive password for this signup.
- If a Cloudflare or CAPTCHA challenge requires human interaction, ask the user to complete it.
- Before clicking the final control that creates an API key, ask for explicit confirmation because this generates persistent access.
- Do not paste a generated API key into chat. If the UI shows a one-time secret, tell the user to store it securely; copy it only to the user's clipboard or destination they explicitly specify.
- If the browser offers to save the password, do not accept unless the user explicitly asked to save it.
- Do not delete API keys, accounts, billing data, organizations, invitations, or user settings unless the user explicitly authorizes that exact cleanup action.

## Browser Workflow

1. Open Flatkey.
   Navigate to `https://flatkey.ai/zh` or the user-provided Flatkey URL. Use the public landing page CTA such as `免费开始`, `获取 API Key`, `Get API Key`, or `Start free`.

2. Choose signup.
   If the login page opens, use `注册` / `Sign up`. The recorded path landed on `https://console.flatkey.ai/sign-up` after selecting the signup link from `https://console.flatkey.ai/sign-in`.

3. Complete the account form.
   For email signup, fill `用户名`, `密码`, `确认密码`, and `电子邮件（验证必需）`. Use the user's provided values or have the user enter sensitive fields. Wait for automatic browser/security checks to pass.

4. Send and retrieve the verification code.
   Use `发送验证码` when enabled. Open the user's email inbox in a separate tab or via a connected email tool if available. Find the Flatkey verification email, copy only the verification code, and return to the Flatkey signup tab. Avoid summarizing unrelated inbox content.

5. Submit signup.
   Paste or type the verification code into `验证码`, then submit the signup form. If the page states that continuing accepts service terms or privacy policy, confirm with the user before the final submission unless the user already explicitly requested completing account creation.

6. Claim the free test credit.
   After signup, look for `领取免费测试额度` or the equivalent call to claim starting credit. Click it if the user wants the new-user setup completed.

7. Create an API key.
   Go to `API 密钥` / `API Keys` under the credentials area, then choose `创建 API 密钥` / `Create API key`. Fill the key name. Leave quota blank unless the user requested a specific limit. Ask for final confirmation before pressing the create button.

8. Verify the key exists.
   Confirm that the API key table shows one enabled key with the chosen name. Treat masked key text such as `sk-...` as sensitive and do not copy it into the chat.

9. Open first-call documentation.
   Open `文档` / `Docs`, then navigate to the OpenAI SDK or Quickstart path. The recorded flow visited `https://docs.flatkey.ai/guides/openai-sdk` and `https://docs.flatkey.ai/quickstart`. Use these pages to guide the user's first Flatkey API call.

## Completion Criteria

Report completion only after these are true:

- The account was created and email verification succeeded.
- The user reached the Flatkey console.
- Free test credit was claimed, if requested.
- An enabled API key with the intended name is visible.
- The user has the key stored safely or knows where to retrieve/manage it.
- The quickstart or OpenAI SDK docs are open or linked for next steps.

## Recovery Notes

- If the user starts from `flatkey.ai` and lands on sign-in, switch to the signup link.
- If `发送验证码` is disabled, check that the email field contains a valid address and that browser/security verification has completed.
- If email is delayed, refresh or search the inbox for Flatkey and check spam/promotions before resending.
- If the API key creation dialog stays open, verify required fields such as name and quota validation. A blank optional quota means unlimited in the recorded flow.
- If the UI language differs, map by semantics: signup, email verification, claim credit, API keys, create key, docs, quickstart.
