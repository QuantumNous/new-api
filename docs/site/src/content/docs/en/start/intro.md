---
title: Introduction
description: Call models from clients or your own code, and manage keys, usage, and costs in one place.
---

DeepPattern API provides API access to Claude, GPT, Grok, and other models. Use it in Claude Code, Codex, and Cherry Studio, or integrate it into your own application. See the [Model Square](https://{{API_HOST}}/pricing) for available models and current pricing.

## Console overview

After signing in to the [console](https://{{API_HOST}}/dashboard), start from these four sections.

<div class="docs-entrance-grid">
<a class="docs-entrance-card" href="https://{{API_HOST}}/pricing"><strong>Model Square</strong><span>Find models and view group pricing, supported endpoints, and request examples.</span></a>
<a class="docs-entrance-card" href="/en/start/api-key/"><strong>API Keys</strong><span>Create access keys and set their group, spending limit, and expiration.</span></a>
<a class="docs-entrance-card" href="/en/start/quickstart/"><strong>Usage Logs</strong><span>View model, tokens, cost, and latency for each request.</span></a>
<a class="docs-entrance-card" href="/en/start/redeem/"><strong>Wallet</strong><span>Check your account balance. To add credit with a redemption code, follow the redeem guide.</span></a>
</div>

## Choose an integration

<div class="docs-path-grid">
<section class="docs-path-card">
<h3>Use a client</h3>
<p><a href="/en/start/api-key/">Create an API key</a>, then follow the matching guide.</p>
<ul>
<li><strong>Claude Code / Codex / Gemini CLI</strong>: <a href="/en/clients/cc-switch/">One-click import with CC Switch</a>.</li>
<li><strong>Desktop chat</strong>: <a href="/en/clients/cherry-studio/">Cherry Studio</a>.</li>
<li><strong>Workplace agent</strong>: <a href="/en/clients/workbuddy/">WorkBuddy</a>.</li>
<li><strong>Editor extensions</strong>: <a href="/en/clients/cursor-cline/">Cursor / Cline</a>.</li>
</ul>
</section>
<section class="docs-path-card">
<h3>Call from code</h3>
<p>Start by sending a request with the <a href="/en/start/quickstart/">Quickstart</a>, then integrate the <a href="/en/clients/sdk/">Python / Node.js SDK</a>. For all parameters, see the <a href="/en/api/relay/">API reference</a>.</p>
</section>
</div>

**The model name, service group, and API format must match.** For example, this guide calls `gpt-5.6-luna` in the `ChatGPT` group via `/v1/chat/completions`. Do not use an image model in a text chat request.
