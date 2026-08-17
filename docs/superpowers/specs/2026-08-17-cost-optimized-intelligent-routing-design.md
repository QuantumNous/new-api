# Cost-Optimized Intelligent Routing Design

## 1. Objective

Add a backend-only intelligent routing layer that keeps the client-selected model identifier stable while selecting an eligible model and provider endpoint for each request. The router minimizes expected total inference cost subject to explicit capability, quality, reliability, latency, retry-budget, and billing-safety constraints.

The router must not treat the client-selected model as the automatic final fallback. It builds a request-specific candidate graph and can move between provider endpoints and model tiers until the request succeeds or the retry budget is exhausted.

## 2. Scope

### Included

- OpenAI-compatible chat and response relay requests.
- Model and provider capability filtering.
- Four model capability/cost tiers.
- Local deterministic request classification.
- Learned quality prediction after sufficient observations exist.
- Expected-cost ranking.
- Provider health, circuit breaking, retry budgets, and cross-model fallback.
- Conditional session stickiness for prompt-cache savings.
- Deterministic response validation.
- Routing decision, token, cost, and saturation audit data.
- Shadow traffic and progressive rollout for new candidates.

### Excluded from the first release

- A general-purpose external router service.
- Per-request online LLM judging for ordinary traffic.
- Automatic model onboarding without benchmark approval.
- Automatic price changes exposed to clients.
- Routing for non-text generation endpoints until their billing and validation boundaries are designed separately.

## 3. Architectural Boundaries

The implementation follows the existing Router -> Controller -> Service -> Model layering.

1. The relay request parser preserves the requested model as the client-facing model identifier.
2. A routing service derives requirements and produces an immutable route plan.
3. Relay execution consumes the plan one attempt at a time.
4. Provider adapters remain responsible only for protocol conversion and upstream execution.
5. The routing service receives endpoint observations without importing provider-specific behavior.
6. Billing uses the actual successful execution node and the existing checked quota-conversion helpers.
7. Logs persist both the requested model and actual execution node for administrative audit.

The router is not added to `relaykit/` unless its interfaces can remain independent of the root module. Any later public API change in `relaykit/` requires an independent `GOWORK=off go build ./...` verification.

## 4. Core Data Model

### Route request

The routing input contains:

- Requested model identifier.
- Normalized request modality and parameters.
- Estimated input and maximum output tokens.
- Conversation fingerprint or explicit session identifier.
- Required capabilities.
- Account, group, region, and policy constraints.
- A request-correlated deadline and maximum cost budget.

### Candidate node

A candidate node is the tuple `(model, channel, endpoint)` and contains:

- Model tier and capabilities.
- Context and output limits.
- Input, output, cache-read, and cache-write prices.
- Rolling success, latency, and throughput observations.
- Circuit state and available concurrency.
- Predicted success probability and output length for the current request.
- Expected total cost for the current request.

### Route plan

A route plan is immutable after execution starts and contains:

- The feature snapshot used for the decision.
- Quality threshold and eligible model set.
- Ordered model groups.
- Ordered endpoints inside each model group.
- Maximum attempts, elapsed time, and cost multiplier.
- Validation requirements.
- Explanation codes suitable for administrative audit.

## 5. Four Model Tiers

The tier is a capability and quality prior, not a mandatory linear retry sequence.

| Tier | Purpose | Typical workloads |
|---|---|---|
| L0 | Extraction and transformation at minimum cost | classification, rewriting, short translation, field extraction |
| L1 | Low-cost general work | summaries, routine questions, simple code explanation |
| L2 | Reliable structured and reasoning work | tools, JSON Schema, code generation, long context, multimodal input |
| L3 | Highest-quality eligible candidates | complex reasoning, difficult coding, strict tool use, high-value workloads |

Each request receives a tailored candidate graph. Ineligible tiers or models are omitted rather than attempted.

## 6. Routing Algorithm

### 6.1 Local feature extraction

Feature extraction performs no model call and targets a P95 latency below 1 ms. It derives token estimates, conversation depth, context utilization, modality, tool and schema requirements, task hints, output constraints, language, streaming mode, and session state.

### 6.2 Hard capability filtering

A node is eligible only if it:

- Supports every required modality and request parameter.
- Has sufficient context and output capacity.
- Supports required tool or structured-output semantics.
- Satisfies region and data-policy constraints.
- Has an available channel and is not in an open circuit.
- Fits the absolute request cost ceiling.

Hard-filter failures are not retryable attempts.

### 6.3 Quality prediction

The cold-start router uses deterministic task rules plus conservative model-tier priors. After sufficient observations, a local predictor estimates:

`P(answer meets quality threshold | request features, model)`

Initial learned routing uses embedding nearest neighbors with 30 neighbors and beta smoothing:

`p_success = (successes + 8) / (samples + 10)`

A trained model may replace nearest-neighbor estimation only after the dataset has at least 10,000 valid observations, at least 500 observations for each principal model, and at least 200 observations for each supported task category.

Initial minimum success probabilities are:

| Task | Minimum probability |
|---|---:|
| Translation, rewriting, summarization | 0.88 |
| General question answering | 0.90 |
| Code generation | 0.93 |
| Information extraction | 0.94 |
| Mathematics and complex reasoning | 0.95 |
| JSON Schema output | 0.97 |
| Tool calling | 0.98 |

If no candidate meets the threshold, the router selects by descending predicted success probability rather than by cost.

### 6.4 Expected total cost

For each eligible model:

`expected_cost = input_cost + output_cost + cache_cost + retry_risk_cost + router_cost`

Output cost uses a model-specific output-length estimate. Retry risk cost is the endpoint failure probability multiplied by the expected cost of the next eligible attempt. All quota conversions use the checked helpers in `common/quota_math.go`; clamp information must reach the existing saturation audit path before the consume log is written.

### 6.5 Model selection

1. Keep only models whose predicted success probability meets the task threshold.
2. Sort the remaining models by expected total cost.
3. Preserve the highest-success remaining model as the final-attempt candidate.
4. If the qualified set is empty, sort all eligible models by predicted success probability.

### 6.6 Endpoint selection

Endpoint sorting uses a lexicographic tuple rather than a blended scalar:

`(health_tier, expected_total_cost, p95_latency, recent_failure_rate, queue_depth)`

Health tiers are:

- `HEALTHY`: rolling 60-second success rate at least 99%.
- `DEGRADED`: rolling success rate from 95% to below 99%.
- `PROBATION`: insufficient samples or newly enabled endpoint.
- `OPEN`: rolling success rate below 95% or a fatal configuration failure.

Endpoints in `OPEN` state are excluded until their circuit permits a probe.

## 7. Execution and Fallback Graph

The normal order is:

1. Selected model's cheapest healthy endpoint.
2. A second healthy endpoint for the same model.
3. Another qualified model in the same capability tier.
4. A higher-quality eligible model.
5. The preserved highest-success candidate as the final attempt.

Retryable conditions include connection failure, pre-stream disconnect, timeout, 408, 429, 502, 503, and 504. Authentication failure, exhausted channel balance, unsupported parameters, and context overflow mutate endpoint eligibility instead of repeating the same request unchanged.

The first release uses these budgets:

- At most four total upstream attempts.
- At most two endpoint attempts for one model.
- At most 30 seconds accumulated routing time for non-streaming requests.
- At most 12 seconds to first byte for streaming requests.
- At most 2.5 times the first node's expected cost.

When any budget is reached, the router performs at most one final attempt using the remaining candidate with the highest predicted success probability.

## 8. Response Validation

Every successful transport response receives deterministic validation appropriate to the request:

- Non-empty and not unexpectedly truncated.
- Valid JSON and JSON Schema when requested.
- Valid tool name and arguments.
- Required fields present.
- Requested output language and basic format present.
- No obvious incomplete code fence or malformed structured output.

Validation failure updates the observation as a model-quality failure and moves to the next compatible node.

Semantic judging is limited to new-model evaluation, boundary predictions within 0.03 of the quality threshold, explicitly high-value workloads, and sampled quality measurement. Mature models use a 1% sample, newly enabled models use 10%, and their first 200 requests use full evaluation.

## 9. Session Stickiness and Cache Economics

The router derives a conversation fingerprint or accepts an explicit session identifier. A successful model and provider remain preferred only while:

- The node remains healthy.
- It supports the current task.
- Its expected cost is no more than 1.15 times the cheapest qualified alternative.
- The task category has not materially changed.

The route is recomputed when the task changes, context utilization exceeds 70%, the node degrades, another node offers more than 15% expected savings, or two consecutive validations fail.

## 10. Observability and Feedback

Each request records:

- Requested model.
- Ordered candidate graph and explanation codes.
- Every attempted model, channel, and endpoint.
- Failure or rejection reason for each attempt.
- Predicted quality and expected cost.
- Actual token usage, latency, and charged cost.
- Cache usage and route stickiness.
- Validation outcome and quota-saturation marker.

Daily routing reports calculate:

- Cost saving against the requested-model baseline.
- Quality retention against benchmark and sampled judge results.
- First-route success rate.
- Multi-attempt rate.
- Final failure rate.
- Added routing latency.
- Predictor Expected Calibration Error.

Initial release targets are at least 30% cost saving, at least 95% quality retention, at least 92% first-route success, at most 8% multi-attempt requests, at most 0.5% final failures, no more than 10 ms P95 routing overhead, and predictor ECE no higher than 0.05.

If quality retention falls below 95%, increase the affected task threshold by 0.02 and reduce low-cost-model traffic. If quality retention remains above 98% while savings are below target, lower the affected threshold by 0.01. Changes require an audit record and are rate-limited to one adjustment per task category per day.

## 11. Model Onboarding

New models progress through:

1. Offline benchmark.
2. Shadow traffic with no client-visible response.
3. 1% live traffic.
4. 5% live traffic.
5. 20% live traffic.
6. Normal learned routing.

Promotion requires at least 200 samples, a passing quality threshold, final failure rate below 1%, and no severe structured-output or tool-use regression. A model is automatically demoted if its five-minute error rate exceeds 5%, its ten-minute quality falls below threshold, or its P95 latency exceeds twice its established baseline.

## 12. Configuration and Administrative Controls

Administrators can:

- Assign models to tiers and capabilities.
- Configure prices and hard cost ceilings.
- Enable or disable model and channel candidates.
- Set task-specific quality thresholds.
- Inspect route decisions and endpoint health.
- Pin or exclude models for controlled experiments.
- Roll out a routing-policy version gradually.
- Roll back to a prior policy version without changing client configuration.

Routing policies are versioned. Every route decision stores its policy version so historical behavior remains reproducible.

## 13. Testing Strategy

### Unit tests

- Deterministic feature and requirement extraction.
- Capability filtering for tools, schemas, modalities, and context limits.
- Exact expected-cost calculation and checked quota conversion.
- Threshold behavior and calibrated probability selection.
- Endpoint tuple ordering and circuit transitions.
- Retry-budget and final-attempt invariants.
- Response validation contracts.

### Integration tests

- Same-model provider failover.
- Cross-model fallback without forced requested-model recovery.
- Context-overflow rerouting.
- Tool and JSON Schema compatibility filtering.
- Streaming failure before and after response commitment.
- Billing against the actual successful execution node.
- Audit completeness for multi-attempt requests.

### Evaluation tests

- Fixed labeled request suite per task category.
- Cost-quality Pareto comparison against always using the requested model.
- Shadow comparisons for newly added candidates.
- Calibration and regression reports by model, task, language, and context band.

All new Go tests use `require` for setup and fatal assertions and `assert` for non-fatal comparisons. Database fixtures must be explicit and remain compatible with SQLite, MySQL, and PostgreSQL.

## 14. Rollout

1. Add observations and route-plan generation with routing disabled.
2. Run shadow decisions and compare them to existing execution.
3. Enable same-model provider optimization.
4. Enable cross-model routing for L0 tasks at 1%.
5. Expand L0, then L1, L2, and L3 independently after their metrics pass.
6. Enable learned routing only after the observation thresholds are met.
7. Preserve an immediate configuration rollback to the previous policy version.

