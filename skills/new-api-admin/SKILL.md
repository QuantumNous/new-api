---
name: new-api-admin
description: Locate the current new-api routes, authorization checks and handlers for an administrative request, derive its API contract, and execute within the supplied account's permissions.
---

# new-api administrator source navigation

Start from the administrator's request. Use this guide to find its implementation in the official [QuantumNous/new-api repository](https://github.com/QuantumNous/new-api). Determine the available operation from the current code and account permissions.

## Common capability entrypoints

Choose a matching entry before searching the whole repository. Each row points to where the current interface, input construction and validation live. Follow the actual route to establish permission and response semantics.

| Capability | Find the client call / input construction | Confirm the implementation |
| --- | --- | --- |
| Model prices and billing mode | [model-pricing/api.ts](https://raw.githubusercontent.com/QuantumNous/new-api/main/web/src/features/model-pricing/api.ts): `getModelPricing`, `saveModelPricing`, `buildPricingChanges`; [pricing.ts](https://raw.githubusercontent.com/QuantumNous/new-api/main/web/src/features/model-pricing/pricing.ts): `pricingFromDraft` | [controller/model_pricing_config.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/controller/model_pricing_config.go) → [model/model_pricing_config.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/model/model_pricing_config.go) |
| Group pricing and availability | [group-ratio-form.tsx](https://raw.githubusercontent.com/QuantumNous/new-api/main/web/src/features/system-settings/models/group-ratio-form.tsx) and the caller that saves it; [system-settings/api.ts](https://raw.githubusercontent.com/QuantumNous/new-api/main/web/src/features/system-settings/api.ts) | [controller/option.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/controller/option.go) → [setting/ratio_setting/group_ratio.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/setting/ratio_setting/group_ratio.go) |
| Channels and routing | [channels/api.ts](https://raw.githubusercontent.com/QuantumNous/new-api/main/web/src/features/channels/api.ts) | [router/channel-router.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/router/channel-router.go) → [controller/channel.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/controller/channel.go); follow the specific handler named by the route |
| Users and permissions | [users/api.ts](https://raw.githubusercontent.com/QuantumNous/new-api/main/web/src/features/users/api.ts) and its imported types | [controller/user.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/controller/user.go), [controller/authz.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/controller/authz.go), and the referenced [service/authz](https://github.com/QuantumNous/new-api/tree/main/service/authz) definitions |
| Model metadata | [models/api.ts](https://raw.githubusercontent.com/QuantumNous/new-api/main/web/src/features/models/api.ts) | [controller/model_meta.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/controller/model_meta.go) |
| Subscription plans and redemption codes | [subscriptions/api.ts](https://raw.githubusercontent.com/QuantumNous/new-api/main/web/src/features/subscriptions/api.ts) or [redemption-codes/api.ts](https://raw.githubusercontent.com/QuantumNous/new-api/main/web/src/features/redemption-codes/api.ts) | [controller/subscription.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/controller/subscription.go) or [controller/redemption.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/controller/redemption.go) |
| Usage and audit records | [usage-logs/api.ts](https://raw.githubusercontent.com/QuantumNous/new-api/main/web/src/features/usage-logs/api.ts) or [audit/api.ts](https://raw.githubusercontent.com/QuantumNous/new-api/main/web/src/features/usage-logs/audit/api.ts) | [controller/log.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/controller/log.go) or `GetAuditLogs` in [controller/access_token.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/controller/access_token.go) |
| General system settings | [system-settings/api.ts](https://raw.githubusercontent.com/QuantumNous/new-api/main/web/src/features/system-settings/api.ts) and the calling settings section | [controller/option.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/controller/option.go): `OptionUpdateRequest`, `GetOptions`, `UpdateOption`; follow the selected option into its setting implementation |

### Model price lookup path

For a request to change model prices, read this chain in order:

1. In `model-pricing/api.ts`, inspect `getModelPricing` and `saveModelPricing` to find the current read/write endpoints and payload wrapper. Inspect `ModelPricingChange` and `buildPricingChanges` to see how the frontend builds a change from the current snapshot.
2. In `model-pricing/pricing.ts`, inspect `PRICING_KEYS` and `pricingFromDraft` to identify the fields for the requested billing mode. Follow the calling editor and [currency.ts](https://raw.githubusercontent.com/QuantumNous/new-api/main/web/src/features/model-pricing/currency.ts) if display-currency conversion matters. For an expression, read [pkg/billingexpr/expr.md](https://raw.githubusercontent.com/QuantumNous/new-api/main/pkg/billingexpr/expr.md) for its units and semantics.
3. Find those endpoints in [router/api-router.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/router/api-router.go), then read `UpdateModelPricingConfig` and the model's `ModelPricingChange`, `ValidateModelPricing`, `UpdateModelPricing`. Resolve the actual role requirement, concurrency check, configured/default distinction, and replacement/merge behavior from this code.
4. Use that contract to construct only the requested model changes. Derive success/conflict handling from the controller and use the read implementation to verify the resulting configuration. For user-visible price presentation, follow [controller/pricing.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/controller/pricing.go).

## Find the relevant implementation

1. **Locate the route.** Start with [router/api-router.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/router/api-router.go) and follow the relevant registration or route table in [router/](https://github.com/QuantumNous/new-api/tree/main/router). Search using the object or action from the request. If the terminology is unclear, locate the matching frontend call in [web/src/features](https://github.com/QuantumNous/new-api/tree/main/web/src/features) first. Continue once the full grouped path, method, handler and middleware chain are known.
2. **Resolve authority.** Follow that chain through [middleware/auth.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/middleware/auth.go). When it invokes fine-grained authorization, read the referenced definitions and resolver in [service/authz](https://github.com/QuantumNous/new-api/tree/main/service/authz). Follow target-ownership, role and verification checks inside the handler too. Use the identity/capability flow found in the code to establish the current account's authority; an administrator label alone does not determine it.
3. **Read the contract.** Open the handler in [controller/](https://github.com/QuantumNous/new-api/tree/main/controller), following its request types, validation, service/model calls and response helpers as needed. Use the matching frontend API call and its callers to understand how inputs are assembled. Continue once the accepted parameters, defaults, units, fields changed, side effects and success/error response are clear from the implementation.
4. **Perform the request.** Call the supplied instance with the supplied token for the user's authorized action. Interpret the actual response using the code just read and verify the resulting state. If the current account cannot perform it, report the concrete permission or browser-verification requirement found in that flow.

## Source-reading shortcuts

- Fetch any known file as plain text with `https://raw.githubusercontent.com/QuantumNous/new-api/main/<path>`.
- If the route moved or the feature is unclear, inspect the [repository tree](https://api.github.com/repos/QuantumNous/new-api/git/trees/main?recursive=1), then search for the object, route fragment or handler symbol. With a checkout, use `rg -n '<symbol-or-path-fragment>' router controller service/authz web/src/features`.
- To resolve frontend payload construction or defaults, follow the feature's API function into its page, form or hook. Follow shared request/response behavior into [web/src/lib/http-client.ts](https://raw.githubusercontent.com/QuantumNous/new-api/main/web/src/lib/http-client.ts) when relevant.
- For delegated pagination and response formatting, read `GetPageQuery` in [common/page_info.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/common/page_info.go) and the referenced helpers in [common/gin.go](https://raw.githubusercontent.com/QuantumNous/new-api/main/common/gin.go).
- Use the deployment's tag or commit when known; otherwise start from `main`. Keep the route, permission definitions and implementation on the same revision. A live/source mismatch needs resolution before retrying a write.

Fetch GitHub source without the instance access token. Keep authenticated calls on the supplied instance and credentials out of files and output. Determine side effects from the handler, regardless of HTTP method; if a write's outcome is uncertain, inspect the state before retrying.

For a request confined to the administrator's own account, use [new-api-user](../new-api-user/SKILL.md).
