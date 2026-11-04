---
title: Cherry Studio
description: Add DeepPattern API as a provider and start chatting.
---

First [create an API key](/en/start/api-key/) and confirm the [available model IDs](/en/start/models/).

## Step 1: Add a provider

Open **Settings → Model Provider** and add a new provider:

| Setting | Value |
|---|---|
| Name | `DeepPattern API` |
| Type | `OpenAI` or `OpenAI Compatible` |
| API URL | `https://{{API_HOST}}/v1` |
| API Key | Your API key |

## Step 2: Add a model

Add a model under that provider by entering its model ID, then save and enable the provider. If the model list can't be fetched automatically, enter the model ID manually.

## Step 3: Verify the connection

Start a new chat, select the model you just added, and send `Hello`. After you get a reply, confirm the request in [Usage Logs](https://{{API_HOST}}/usage-logs/common).

If the error path contains `/v1/v1`, change the API URL to `https://{{API_HOST}}`; that client version appends `/v1` automatically.
