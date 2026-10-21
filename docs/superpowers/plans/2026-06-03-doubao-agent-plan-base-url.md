# Doubao Agent Plan Base URL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Doubao Agent Plan base URL preset for VolcEngine channels and make the VolcEngine adaptor build Agent Plan-compatible upstream paths.

**Architecture:** The frontend VolcEngine channel form stores `https://ark.cn-beijing.volces.com/api/plan/v3` when the operator selects Doubao Agent Plan. The backend VolcEngine adaptor detects Agent Plan base URLs and appends endpoint suffixes such as `/chat/completions` and `/images/generations` instead of regular Ark `/api/v3/...` paths.

**Tech Stack:** Go/Gin relay adaptor, React/TypeScript channel form, Bun frontend tooling.

---

## File Structure

- Modify `relay/channel/volcengine/adaptor.go`
  - Add Agent Plan base URL detection and URL builder helpers.
  - Use helpers for chat, bot chat, embeddings, images, rerank, responses.
- Create `relay/channel/volcengine/adaptor_agent_plan_test.go`
  - Test regular Ark and Agent Plan URL construction.
- Modify `web/default/src/features/channels/components/drawers/channel-mutate-drawer.tsx`
  - Add `Doubao Agent Plan` option to the type 45 VolcEngine Base URL selector.

---

### Task 1: Backend VolcEngine Agent Plan URL handling

**Files:**
- Modify: `relay/channel/volcengine/adaptor.go`
- Create: `relay/channel/volcengine/adaptor_agent_plan_test.go`

- [ ] **Step 1: Write failing tests**

Create `relay/channel/volcengine/adaptor_agent_plan_test.go`:

```go
package volcengine

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
)

func TestVolcengineRegularArkURLs(t *testing.T) {
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayMode:      relayconstant.RelayModeChatCompletions,
		RelayFormat:    types.RelayFormatOpenAI,
		ChannelBaseUrl: "https://ark.cn-beijing.volces.com",
	}
	got, err := adaptor.GetRequestURL(info)
	if err != nil {
		t.Fatalf("GetRequestURL returned error: %v", err)
	}
	want := "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
	if got != want {
		t.Fatalf("regular chat URL = %q, want %q", got, want)
	}
}

func TestVolcengineAgentPlanURLs(t *testing.T) {
	adaptor := &Adaptor{}
	cases := []struct {
		name      string
		relayMode int
		want      string
	}{
		{
			name:      "chat",
			relayMode: relayconstant.RelayModeChatCompletions,
			want:      "https://ark.cn-beijing.volces.com/api/plan/v3/chat/completions",
		},
		{
			name:      "images",
			relayMode: relayconstant.RelayModeImagesGenerations,
			want:      "https://ark.cn-beijing.volces.com/api/plan/v3/images/generations",
		},
		{
			name:      "responses",
			relayMode: relayconstant.RelayModeResponses,
			want:      "https://ark.cn-beijing.volces.com/api/plan/v3/responses",
		},
		{
			name:      "embeddings",
			relayMode: relayconstant.RelayModeEmbeddings,
			want:      "https://ark.cn-beijing.volces.com/api/plan/v3/embeddings",
		},
		{
			name:      "rerank",
			relayMode: relayconstant.RelayModeRerank,
			want:      "https://ark.cn-beijing.volces.com/api/plan/v3/rerank",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{
				RelayMode:      tc.relayMode,
				RelayFormat:    types.RelayFormatOpenAI,
				ChannelBaseUrl: "https://ark.cn-beijing.volces.com/api/plan/v3/",
			}
			got, err := adaptor.GetRequestURL(info)
			if err != nil {
				t.Fatalf("GetRequestURL returned error: %v", err)
			}
			if got != tc.want {
				t.Fatalf("Agent Plan URL = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestVolcengineAgentPlanBotURL(t *testing.T) {
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayMode:         relayconstant.RelayModeChatCompletions,
		RelayFormat:       types.RelayFormatOpenAI,
		ChannelBaseUrl:    "https://ark.cn-beijing.volces.com/api/plan/v3",
		UpstreamModelName: "bot-123",
	}
	got, err := adaptor.GetRequestURL(info)
	if err != nil {
		t.Fatalf("GetRequestURL returned error: %v", err)
	}
	want := "https://ark.cn-beijing.volces.com/api/plan/v3/bots/chat/completions"
	if got != want {
		t.Fatalf("Agent Plan bot URL = %q, want %q", got, want)
	}
}

func TestVolcengineAgentPlanClaudeFormatURL(t *testing.T) {
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayMode:      relayconstant.RelayModeChatCompletions,
		RelayFormat:    types.RelayFormatClaude,
		ChannelBaseUrl: "https://ark.cn-beijing.volces.com/api/plan/v3",
	}
	got, err := adaptor.GetRequestURL(info)
	if err != nil {
		t.Fatalf("GetRequestURL returned error: %v", err)
	}
	want := "https://ark.cn-beijing.volces.com/api/plan/v3/chat/completions"
	if got != want {
		t.Fatalf("Agent Plan Claude-format URL = %q, want %q", got, want)
	}
}

func TestVolcengineAgentPlanDoesNotAffectSpecialBases(t *testing.T) {
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayMode:      relayconstant.RelayModeChatCompletions,
		RelayFormat:    types.RelayFormatOpenAI,
		ChannelBaseUrl: "doubao-coding-plan",
		ChannelType:    constant.ChannelTypeVolcEngine,
	}
	got, err := adaptor.GetRequestURL(info)
	if err != nil {
		t.Fatalf("GetRequestURL returned error: %v", err)
	}
	want := "https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions"
	if got != want {
		t.Fatalf("special base URL = %q, want %q", got, want)
	}
}
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
go test ./relay/channel/volcengine -run 'TestVolcengine.*AgentPlan|TestVolcengineRegularArkURLs'
```

Expected: FAIL for Agent Plan cases because current code appends `/api/v3/...`.

- [ ] **Step 3: Implement Agent Plan URL helpers**

In `relay/channel/volcengine/adaptor.go`, add near constants/helpers:

```go
func normalizeVolcengineBaseURL(baseURL string) string {
	return strings.TrimRight(strings.TrimSpace(baseURL), "/")
}

func isVolcengineAgentPlanBase(baseURL string) bool {
	baseURL = normalizeVolcengineBaseURL(baseURL)
	return baseURL == "https://ark.cn-beijing.volces.com/api/plan" ||
		baseURL == "https://ark.cn-beijing.volces.com/api/plan/v3"
}

func buildVolcengineURL(baseURL string, regularPath string, agentPlanPath string) string {
	baseURL = normalizeVolcengineBaseURL(baseURL)
	if isVolcengineAgentPlanBase(baseURL) {
		return baseURL + agentPlanPath
	}
	return baseURL + regularPath
}
```

- [ ] **Step 4: Use helpers in GetRequestURL**

Replace regular path concatenations in `GetRequestURL`:

```go
return fmt.Sprintf("%s/api/v3/chat/completions", baseUrl), nil
```

with:

```go
return buildVolcengineURL(baseUrl, "/api/v3/chat/completions", "/chat/completions"), nil
```

Apply equivalent replacements:

```go
bot chat:    regular "/api/v3/bots/chat/completions", agent "/bots/chat/completions"
embeddings:  regular "/api/v3/embeddings", agent "/embeddings"
images:      regular "/api/v3/images/generations", agent "/images/generations"
rerank:      regular "/api/v3/rerank", agent "/rerank"
responses:   regular "/api/v3/responses", agent "/responses"
```

Do not change `ChannelSpecialBases` handling for `doubao-coding-plan`.

- [ ] **Step 5: Run tests**

Run:

```bash
go test ./relay/channel/volcengine -run 'TestVolcengine.*AgentPlan|TestVolcengineRegularArkURLs'
```

Expected: PASS.

---

### Task 2: Frontend Doubao Agent Plan Base URL option

**Files:**
- Modify: `web/default/src/features/channels/components/drawers/channel-mutate-drawer.tsx`

- [ ] **Step 1: Add selector option**

In the VolcEngine type 45 `base_url` selector, add an option to the `items` prop:

```tsx
{
  value: 'https://ark.cn-beijing.volces.com/api/plan/v3',
  label: t('Doubao Agent Plan'),
},
```

Add matching `<SelectItem>`:

```tsx
<SelectItem value='https://ark.cn-beijing.volces.com/api/plan/v3'>
  {t('Doubao Agent Plan')}
</SelectItem>
```

Place it after `Doubao Coding Plan`.

- [ ] **Step 2: Add explanatory description**

Update the FormDescription for the VolcEngine selector to mention Agent Plan:

```tsx
{t('Select the API endpoint region. Doubao Agent Plan uses https://ark.cn-beijing.volces.com/api/plan/v3 for subscription-based Agent Plan keys.')}
```

- [ ] **Step 3: Run frontend typecheck**

Run:

```bash
cd web/default && bun run typecheck
```

Expected: PASS.

---

### Task 3: Verification

**Files:**
- Verify backend and frontend only.

- [ ] **Step 1: Run backend tests**

Run:

```bash
go test ./relay/channel/volcengine -run 'TestVolcengine.*AgentPlan|TestVolcengineRegularArkURLs'
```

Expected: PASS.

- [ ] **Step 2: Run frontend build**

Run:

```bash
cd web/default && bun run build
```

Expected: PASS.

- [ ] **Step 3: Manual check**

Run:

```bash
./restart.sh
```

Manual checks:

1. Open `/channels`.
2. Create or edit a VolcEngine channel.
3. Confirm Base URL selector contains `Doubao Agent Plan`.
4. Select it and save.
5. Confirm channel `base_url` is `https://ark.cn-beijing.volces.com/api/plan/v3`.
6. Run channel test with a text or image model and confirm no request path includes `/api/plan/v3/api/v3`.

- [ ] **Step 4: Clean runtime artifacts**

Run:

```bash
./stop.sh
rm -f 35sz-api 35sz-api.log 35sz-api.pid
```

Expected: no generated runtime artifacts remain.

---

## Self-Review

- Spec coverage: Adds Doubao Agent Plan frontend preset and backend Agent Plan URL handling for VolcEngine request paths.
- Placeholder scan: No placeholders remain.
- Type consistency: Helper names are consistent: `normalizeVolcengineBaseURL`, `isVolcengineAgentPlanBase`, `buildVolcengineURL`.
- Scope check: Does not modify DoubaoVideo task testing or channel splitting, as requested.
