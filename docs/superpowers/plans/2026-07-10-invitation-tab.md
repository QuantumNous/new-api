# Invitation Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a NewAPI-native `/invite` console page that explains first-top-up rewards, exposes privacy-safe referral history, supports sharing and reward transfer, and removes invitation UI from Wallet.

**Architecture:** Add one authenticated read-only endpoint backed by a focused model query that returns server-masked invitation records plus existing reward ledger totals. Build an isolated React feature that owns invitation API calls, share helpers, components, and transfer flow, while reusing the console design system and existing mutation endpoint.

**Tech Stack:** Go 1.22+, Gin, GORM, SQLite/MySQL/PostgreSQL-compatible queries, React 19, TypeScript, TanStack Router, TanStack Query, Base UI/Tailwind, Bun tests, i18next.

---

## File Structure

### Backend

- Create `model/invitation.go`: invitation read DTOs, identity masking, status/reason normalization, and paginated query.
- Create `model/invitation_test.go`: masking, scoping, pagination, event reward, soft-delete, and abnormal-state tests.
- Create `controller/invitation.go`: authenticated response composition using model data and live reward/compliance configuration.
- Create `controller/invitation_test.go`: controller response, pagination cap, privacy, and configuration tests.
- Modify `router/api-router.go`: register `GET /api/user/self/invitations` under `UserAuth`.

### Frontend

- Create `web/default/src/features/invitations/types.ts`: endpoint and component domain types.
- Create `web/default/src/features/invitations/api.ts`: invitation list, affiliate code, and transfer requests.
- Create `web/default/src/features/invitations/lib/share.ts`: invitation link and share URL builders.
- Create `web/default/src/features/invitations/lib/share.test.ts`: URL encoding and SSR-safe link tests.
- Create `web/default/src/features/invitations/hooks/use-invitations.ts`: TanStack Query data and transfer mutation orchestration.
- Create `web/default/src/features/invitations/components/*.tsx`: stats, referral link, steps, transfer, records, FAQ, and loading/error states.
- Create `web/default/src/features/invitations/components/invitation-view.test.tsx`: render-level product-state regression tests.
- Create `web/default/src/features/invitations/index.tsx`: page composition.
- Create `web/default/src/routes/_authenticated/invite/index.tsx`: `/invite` route.
- Modify `web/default/src/hooks/use-sidebar-data.ts`: add Personal navigation item.
- Modify `web/default/src/features/wallet/index.tsx`: remove affiliate state, card, and dialog.
- Modify `web/default/src/features/wallet/api.ts`, `types.ts`, `hooks/index.ts`, and `lib/index.ts`: remove invitation-owned exports.
- Move `web/default/src/features/wallet/components/dialogs/transfer-dialog.tsx` to `web/default/src/features/invitations/components/transfer-dialog.tsx`.
- Delete `web/default/src/features/wallet/components/affiliate-rewards-card.tsx`, `hooks/use-affiliate.ts`, and `lib/affiliate.ts` after all consumers move.
- Modify all eight `web/default/src/i18n/locales/*.json` files with real translations.

## Task 0: Impact and Baseline Preflight

**Files:**
- Read: `model/invite_reward.go`
- Read: `controller/user.go`
- Read: `router/api-router.go`
- Read: `web/default/src/hooks/use-sidebar-data.ts`
- Read: `web/default/src/features/wallet/index.tsx`

- [ ] **Step 1: Run required impact analysis before editing existing symbols**

Run GitNexus upstream impact analysis for `SetApiRouter`, `useSidebarData`, and `Wallet`. Record direct callers, affected processes, and risk. If the GitNexus integration is unavailable in the active Codex surface, record that limitation and use exact repository references with `rg -n "SetApiRouter|useSidebarData|function Wallet"` plus `git grep` caller searches as the fallback before any edit.

- [ ] **Step 2: Re-run the narrow baseline**

Run:

```text
go test ./model -count=1
cd web/default && bun test
```

Expected: both PASS. Keep the already reproduced unrelated full-controller failure separate from feature work.

## Task 1: Invitation Query and Privacy Boundary

**Files:**
- Create: `model/invitation.go`
- Create: `model/invitation_test.go`

- [ ] **Step 1: Write failing identity masking tests**

```go
func TestMaskInvitationIdentity(t *testing.T) {
	tests := []struct {
		name, email, username, want string
	}{
		{"email", "alice@example.com", "alice", "a***@example.com"},
		{"one rune", "", "李", "*"},
		{"two runes", "", "李雷", "李*"},
		{"long username", "", "alice", "a***e"},
		{"empty", "", "", "***"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, MaskInvitationIdentity(tt.email, tt.username))
		})
	}
}
```

- [ ] **Step 2: Run the masking test and confirm the missing symbol failure**

Run: `go test ./model -run TestMaskInvitationIdentity -count=1`

Expected: compile failure containing `undefined: MaskInvitationIdentity`.

- [ ] **Step 3: Add invitation DTOs and masking implementation**

```go
type InvitationRecord struct {
	Id               int    `json:"id"`
	MaskedIdentity   string `json:"masked_identity"`
	RegisteredAt     int64  `json:"registered_at"`
	Status           string `json:"status"`
	GrantedAt        int64  `json:"granted_at"`
	RewardQuota      int    `json:"reward_quota"`
	Reason           string `json:"reason"`
}

type InvitationPage struct {
	Items        []InvitationRecord
	Total        int64
	PendingCount int64
}

func MaskInvitationIdentity(email, username string) string {
	if at := strings.LastIndex(email, "@"); at > 0 && at < len(email)-1 {
		local := []rune(email[:at])
		if len(local) > 0 {
			return string(local[0]) + "***" + email[at:]
		}
	}
	runes := []rune(username)
	switch len(runes) {
	case 0:
		return "***"
	case 1:
		return "*"
	case 2:
		return string(runes[0]) + "*"
	default:
		return string(runes[0]) + "***" + string(runes[len(runes)-1])
	}
}
```

- [ ] **Step 4: Run the masking test and confirm it passes**

Run: `go test ./model -run TestMaskInvitationIdentity -count=1`

Expected: `ok .../model`.

- [ ] **Step 5: Write failing paginated query tests**

Create isolated SQLite data with two inviters, pending/granted/blocked/abnormal invitees, one soft-deleted invitee, and a historical event whose reward differs from the current configuration. Set explicit `created_at` values, then assert the full page and a separate two-item page:

```go
page, err := GetInvitationPage(inviter.Id, 0, 10)
require.NoError(t, err)
require.EqualValues(t, 4, page.Total)
require.EqualValues(t, 1, page.PendingCount)
require.Len(t, page.Items, 4)
require.GreaterOrEqual(t, page.Items[0].RegisteredAt, page.Items[1].RegisteredAt)
require.NotContains(t, page.Items[0].MaskedIdentity, "alice@example.com")

granted := findInvitationRecord(t, page.Items, grantedInvitee.Id)
require.Equal(t, InviteRewardStatusGranted, granted.Status)
require.Equal(t, 321, granted.RewardQuota)
require.Equal(t, InviteRewardBlockReasonInviterLimitReached, granted.Reason)

firstPage, err := GetInvitationPage(inviter.Id, 0, 2)
require.NoError(t, err)
require.Len(t, firstPage.Items, 2)
```

Define the test helper in the same file:

```go
func findInvitationRecord(t *testing.T, records []InvitationRecord, id int) InvitationRecord {
	t.Helper()
	for _, record := range records {
		if record.Id == id {
			return record
		}
	}
	t.Fatalf("invitation record %d not found", id)
	return InvitationRecord{}
}
```

Also assert a `none` row with an inviter is returned as `blocked` with reason `unavailable`, and an invitee belonging to the other inviter is absent.

- [ ] **Step 6: Run the query tests and confirm the missing function failure**

Run: `go test ./model -run 'TestGetInvitationPage' -count=1`

Expected: compile failure containing `undefined: GetInvitationPage`.

- [ ] **Step 7: Implement the minimal cross-database query**

Use GORM only:

```go
func GetInvitationPage(inviterId, offset, limit int) (*InvitationPage, error) {
	query := DB.Model(&User{}).Where("inviter_id = ?", inviterId)
	page := &InvitationPage{Items: make([]InvitationRecord, 0)}
	if err := query.Count(&page.Total).Error; err != nil {
		return nil, err
	}
	if err := DB.Model(&User{}).
		Where("inviter_id = ? AND invite_reward_status = ?", inviterId, InviteRewardStatusPending).
		Count(&page.PendingCount).Error; err != nil {
		return nil, err
	}

	var invitees []User
	if err := query.Select(
		"id", "username", "email", "created_at", "invite_reward_status",
		"invite_reward_granted_at", "invite_reward_block_reason",
	).Order("created_at DESC").Order("id DESC").Offset(offset).Limit(limit).Find(&invitees).Error; err != nil {
		return nil, err
	}

	ids := make([]int, 0, len(invitees))
	for _, invitee := range invitees {
		ids = append(ids, invitee.Id)
	}
	events := make(map[int]InviteRewardEvent, len(ids))
	if len(ids) > 0 {
		var rows []InviteRewardEvent
		if err := DB.Where("inviter_id = ? AND invitee_id IN ?", inviterId, ids).Find(&rows).Error; err != nil {
			return nil, err
		}
		for _, event := range rows {
			events[event.InviteeId] = event
		}
	}

	for _, invitee := range invitees {
		page.Items = append(page.Items, buildInvitationRecord(invitee, events[invitee.Id]))
	}
	return page, nil
}
```

Implement `buildInvitationRecord` with an explicit allowed-status switch and an explicit public-reason allowlist. For granted records, use only `event.InviterRewardQuota`; when an expected event is missing, return reward `0` and reason `unavailable`.

- [ ] **Step 8: Run focused and package model tests**

Run: `go test ./model -run 'TestMaskInvitationIdentity|TestGetInvitationPage' -count=1`

Expected: PASS.

Run: `go test ./model -count=1`

Expected: PASS.

- [ ] **Step 9: Commit the model boundary**

```text
Expose privacy-safe invitation history

Constraint: Historical rewards must use event ledger values and queries must support SQLite, MySQL, and PostgreSQL.
Rejected: Returning User rows directly | leaks identity and couples the API to persistence fields.
Confidence: high
Scope-risk: narrow
Directive: Keep raw invitee identity behind the model DTO boundary.
Tested: go test ./model -count=1
```

## Task 2: Authenticated Invitation Endpoint

**Files:**
- Create: `controller/invitation.go`
- Create: `controller/invitation_test.go`
- Modify: `router/api-router.go`

- [ ] **Step 1: Write a failing controller response test**

Set up isolated SQLite tables for `model.User` and `model.InviteRewardEvent`, insert an inviter with `AffHistoryQuota: 900`, `AffQuota: 400`, `AffCount: 2`, and create one pending invitee. Set `common.QuotaForInviter = 500`, `common.QuotaForInvitee = 250`, `common.QuotaForInviterMaxCount = 10`, then call a Gin route whose middleware sets `c.Set("id", inviter.Id)`.

```go
request := httptest.NewRequest(http.MethodGet, "/api/user/self/invitations?page=1&page_size=10", nil)
recorder := httptest.NewRecorder()
router.ServeHTTP(recorder, request)
require.Equal(t, http.StatusOK, recorder.Code)

var payload struct {
	Success bool `json:"success"`
	Data struct {
		Summary struct {
			InviterRewardQuota    int   `json:"inviter_reward_quota"`
			InviteeRewardQuota    int   `json:"invitee_reward_quota"`
			InviterRewardMaxCount int   `json:"inviter_reward_max_count"`
			HistoryQuota          int   `json:"history_quota"`
			TransferableQuota     int   `json:"transferable_quota"`
			GrantedCount          int   `json:"granted_count"`
			PendingCount          int64 `json:"pending_count"`
			TransferEnabled       bool  `json:"transfer_enabled"`
		} `json:"summary"`
		Items []model.InvitationRecord `json:"items"`
		Page int `json:"page"`
		PageSize int `json:"page_size"`
		Total int64 `json:"total"`
	} `json:"data"`
}
require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
require.True(t, payload.Success)
require.Equal(t, 500, payload.Data.Summary.InviterRewardQuota)
require.Equal(t, 900, payload.Data.Summary.HistoryQuota)
require.Equal(t, 1, payload.Data.Page)
require.Equal(t, 10, payload.Data.PageSize)
require.NotContains(t, recorder.Body.String(), "invitee@example.com")
```

Add a second test with `page_size=999` and assert `page_size == 100`.

- [ ] **Step 2: Run the controller tests and confirm the missing handler failure**

Run: `go test ./controller -run TestGetSelfInvitations -count=1`

Expected: compile failure containing `undefined: GetSelfInvitations`.

- [ ] **Step 3: Implement the thin controller**

```go
type invitationSummary struct {
	InviterRewardQuota    int   `json:"inviter_reward_quota"`
	InviteeRewardQuota    int   `json:"invitee_reward_quota"`
	InviterRewardMaxCount int   `json:"inviter_reward_max_count"`
	HistoryQuota          int   `json:"history_quota"`
	TransferableQuota     int   `json:"transferable_quota"`
	GrantedCount          int   `json:"granted_count"`
	PendingCount          int64 `json:"pending_count"`
	TransferEnabled       bool  `json:"transfer_enabled"`
}

func GetSelfInvitations(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	if pageValue := c.Query("page"); pageValue != "" {
		if page, parseErr := strconv.Atoi(pageValue); parseErr == nil && page > 0 {
			pageInfo.Page = page
		}
	}
	if pageInfo.PageSize < 1 {
		pageInfo.PageSize = common.ItemsPerPage
	}
	user, err := model.GetUserById(c.GetInt("id"), true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	page, err := model.GetInvitationPage(user.Id, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"summary": invitationSummary{
			InviterRewardQuota: common.QuotaForInviter,
			InviteeRewardQuota: common.QuotaForInvitee,
			InviterRewardMaxCount: common.QuotaForInviterMaxCount,
			HistoryQuota: user.AffHistoryQuota,
			TransferableQuota: user.AffQuota,
			GrantedCount: user.AffCount,
			PendingCount: page.PendingCount,
			TransferEnabled: operation_setting.IsPaymentComplianceConfirmed(),
		},
		"items": page.Items,
		"page": pageInfo.GetPage(),
		"page_size": pageInfo.GetPageSize(),
		"total": page.Total,
	})
}
```

- [ ] **Step 4: Register the route**

Add beside the existing `/self` and `/aff` routes:

```go
selfRoute.GET("/self/invitations", controller.GetSelfInvitations)
```

- [ ] **Step 5: Run controller and router verification**

Run: `go test ./controller -run 'TestGetSelfInvitations|InviteReward' -count=1`

Expected: PASS.

Run: `go test ./router -count=1`

Expected: PASS, or `[no test files]` with successful compilation.

- [ ] **Step 6: Commit the authenticated endpoint**

```text
Give users an auditable invitation summary

Constraint: The controller must remain a thin authenticated adapter over model queries and existing live configuration.
Rejected: Reusing GetSelf for referral history | expands a high-traffic payload and cannot paginate.
Confidence: high
Scope-risk: narrow
Directive: Keep POST /aff_transfer as the final compliance and mutation boundary.
Tested: targeted controller tests; go test ./router -count=1
```

## Task 3: Frontend Invitation Domain and Share Helpers

**Files:**
- Create: `web/default/src/features/invitations/types.ts`
- Create: `web/default/src/features/invitations/api.ts`
- Create: `web/default/src/features/invitations/lib/share.ts`
- Create: `web/default/src/features/invitations/lib/share.test.ts`
- Create: `web/default/src/features/invitations/hooks/use-invitations.ts`

- [ ] **Step 1: Write failing share helper tests**

```ts
import { describe, expect, test } from 'bun:test'
import {
  buildAffiliateLink,
  buildInvitationShareLinks,
} from './share'

describe('invitation share helpers', () => {
  test('builds a signup link from an explicit origin', () => {
    expect(buildAffiliateLink('ABCD', 'https://console.example.com')).toBe(
      'https://console.example.com/sign-up?aff=ABCD'
    )
  })

  test('encodes the referral URL for every share target', () => {
    const url = 'https://console.example.com/sign-up?aff=A B'
    const links = buildInvitationShareLinks(url, 'Join NewAPI')
    expect(links.email).toContain(encodeURIComponent(url))
    expect(links.x).toContain(encodeURIComponent(url))
    expect(links.linkedin).toContain(encodeURIComponent(url))
  })
})
```

- [ ] **Step 2: Run the helper test and confirm the missing module failure**

Run from `web/default`: `bun test src/features/invitations/lib/share.test.ts`

Expected: FAIL because `./share` does not exist.

- [ ] **Step 3: Implement typed helpers and API contracts**

```ts
export type InvitationStatus = 'pending' | 'granted' | 'blocked'

export interface ApiResponse<T = unknown> {
  success?: boolean
  message?: string
  data?: T
}

export const INVITATION_PAGE_SIZE = 10

export interface InvitationRecord {
  id: number
  masked_identity: string
  registered_at: number
  status: InvitationStatus
  granted_at: number
  reward_quota: number
  reason: '' | 'inviter_limit_reached' | 'inviter_missing' | 'unavailable'
}

export interface InvitationSummary {
  inviter_reward_quota: number
  invitee_reward_quota: number
  inviter_reward_max_count: number
  history_quota: number
  transferable_quota: number
  granted_count: number
  pending_count: number
  transfer_enabled: boolean
}

export interface InvitationPageData {
  summary: InvitationSummary
  items: InvitationRecord[]
  page: number
  page_size: number
  total: number
}
```

```ts
export function buildAffiliateLink(code: string, origin?: string): string {
  const resolvedOrigin = origin ?? (typeof window === 'undefined' ? '' : window.location.origin)
  if (!resolvedOrigin || !code) return ''
  return `${resolvedOrigin}/sign-up?aff=${encodeURIComponent(code)}`
}

export function buildInvitationShareLinks(url: string, message: string) {
  const encodedUrl = encodeURIComponent(url)
  const encodedMessage = encodeURIComponent(message)
  return {
    email: `mailto:?subject=${encodedMessage}&body=${encodedMessage}%0A${encodedUrl}`,
    x: `https://twitter.com/intent/tweet?text=${encodedMessage}&url=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
  }
}
```

In `api.ts`, call:

```ts
export async function getInvitations(page: number, pageSize: number) {
  const res = await api.get<ApiResponse<InvitationPageData>>(
    `/api/user/self/invitations?page=${page}&page_size=${pageSize}`
  )
  return res.data
}

export async function getAffiliateCode() {
  const res = await api.get<ApiResponse<string>>('/api/user/aff')
  return res.data
}

export async function transferAffiliateQuota(quota: number) {
  const res = await api.post<ApiResponse>('/api/user/aff_transfer', { quota })
  return res.data
}
```

- [ ] **Step 4: Implement the React Query hook**

Use query keys `['invitations', page]` and `['affiliate-code']`. The transfer mutation must call `getSelf()`, invalidate all `['invitations']` queries, show translated success/failure toasts, and return a boolean so the existing dialog closes only on success.

```ts
export function useInvitations(page: number) {
  const queryClient = useQueryClient()
  const invitationsQuery = useQuery({
    queryKey: ['invitations', page],
    queryFn: () => getInvitations(page, INVITATION_PAGE_SIZE),
  })
  const codeQuery = useQuery({
    queryKey: ['affiliate-code'],
    queryFn: getAffiliateCode,
  })
  const transferMutation = useMutation({
    mutationFn: async (quota: number) => {
      const response = await transferAffiliateQuota(quota)
      if (!response.success) {
        throw new Error(response.message || i18next.t('Transfer failed'))
      }
      return response
    },
    onSuccess: async (response) => {
      await getSelf()
      await queryClient.invalidateQueries({ queryKey: ['invitations'] })
      toast.success(response.message || i18next.t('Transfer successful'))
    },
    onError: () => toast.error(i18next.t('Transfer failed')),
  })
  return { invitationsQuery, codeQuery, transferMutation }
}
```

- [ ] **Step 5: Run helper tests and typecheck**

Run: `bun test src/features/invitations/lib/share.test.ts`

Expected: PASS.

Run: `bun run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit the frontend domain boundary**

```text
Isolate invitation data and sharing behavior

Constraint: Frontend requests must use the shared API client and invitation mutations must refresh server-owned totals.
Rejected: Keeping invitation APIs in Wallet | preserves the wrong feature ownership.
Confidence: high
Scope-risk: narrow
Directive: Keep share URL generation pure and independently testable.
Tested: invitation helper tests; bun run typecheck
```

## Task 4: NewAPI-Native Invitation Page Components

**Files:**
- Create: `web/default/src/features/invitations/components/invitation-stats.tsx`
- Create: `web/default/src/features/invitations/components/referral-link-card.tsx`
- Create: `web/default/src/features/invitations/components/reward-steps-card.tsx`
- Create: `web/default/src/features/invitations/components/reward-transfer-card.tsx`
- Create: `web/default/src/features/invitations/components/invitation-records-card.tsx`
- Create: `web/default/src/features/invitations/components/invitation-faq.tsx`
- Create: `web/default/src/features/invitations/components/transfer-dialog.tsx`
- Create: `web/default/src/features/invitations/components/invitation-view.test.tsx`
- Create: `web/default/src/features/invitations/index.tsx`

- [ ] **Step 1: Write failing render tests for core states**

Extract a presentational `InvitationView` that accepts typed data and callbacks so it can be server-rendered without QueryClient setup.

```tsx
const html = renderToStaticMarkup(
  <InvitationView
    data={fixture}
    affiliateLink='https://console.example.com/sign-up?aff=ABCD'
    loading={false}
    error={false}
    transferring={false}
    page={1}
    onPageChange={() => undefined}
    onRetry={() => undefined}
    onTransfer={async () => true}
  />
)
expect(html).toContain('Total earned')
expect(html).toContain('Available to transfer')
expect(html).toContain('Waiting for first top-up')
expect(html).toContain('a***@example.com')
expect(html).toContain('Reward granted')
expect(html).not.toContain('first API key')
expect(html).not.toContain('successfully calls the API')
```

Add separate fixtures asserting empty text, retry text, `inviter_limit_reached`, and a disabled transfer button when `transfer_enabled` is false.

- [ ] **Step 2: Run the render tests and confirm the missing component failure**

Run: `bun test src/features/invitations/components/invitation-view.test.tsx`

Expected: FAIL because invitation components do not exist.

- [ ] **Step 3: Implement focused components with existing primitives**

Use these component contracts:

```ts
interface InvitationStatsProps {
  summary: InvitationSummary | null
  loading: boolean
}

interface ReferralLinkCardProps {
  affiliateLink: string
  loading: boolean
}

interface InvitationRecordsCardProps {
  data: InvitationPageData | null
  loading: boolean
  error: boolean
  onRetry: () => void
  onPageChange: (page: number) => void
}
```

Implementation requirements:

- Stats: four existing `Card` components with `formatQuota` and text labels.
- Share: `TitledCard`, read-only `Input`, `CopyButton`, and icon `Button` anchors for email/X/LinkedIn using `target='_blank'` and `rel='noreferrer noopener'` where applicable.
- Steps: three responsive columns whose third step says the friend completes their first successful top-up.
- Transfer: existing dialog behavior moved unchanged except imports and invitation-specific ownership; disable opening when compliance is false or transferable quota is zero.
- `InvitationView` owns the local transfer-dialog open state; the route-level feature owns only page/query/mutation state.
- Records: existing `Table`, `Badge`, `Skeleton`, and `Pagination`; retain a minimum table width inside `overflow-x-auto`, never on the page root.
- FAQ: existing `Accordion`; include reward timing, configured amounts, limit behavior, transfer, visible records, and anti-abuse guidance.
- No raw colors, gradients, images, or new dependencies.

- [ ] **Step 4: Compose the feature page**

```tsx
export function Invitations() {
  const [page, setPage] = useState(1)
  const invitationState = useInvitations(page)
  const data = invitationState.invitationsQuery.data?.data ?? null
  const code = invitationState.codeQuery.data?.data ?? ''
  const affiliateLink = buildAffiliateLink(code)

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Invite & Earn')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <InvitationView
          data={data}
          affiliateLink={affiliateLink}
          loading={invitationState.invitationsQuery.isLoading}
          error={invitationState.invitationsQuery.isError}
          transferring={invitationState.transferMutation.isPending}
          page={page}
          onPageChange={setPage}
          onRetry={() => invitationState.invitationsQuery.refetch()}
          onTransfer={async (quota) => {
            try {
              await invitationState.transferMutation.mutateAsync(quota)
              return true
            } catch {
              return false
            }
          }}
        />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
```

Keep the composed page and each component under roughly 200 lines by splitting responsibilities listed above.

- [ ] **Step 5: Run render tests and typecheck**

Run: `bun test src/features/invitations/components/invitation-view.test.tsx`

Expected: PASS.

Run: `bun run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit the page components**

```text
Make invitation rewards understandable in the console

Constraint: The page must reuse NewAPI primitives, tokens, dark mode, and responsive breakpoints.
Rejected: Reproducing FreeModel visuals | conflicts with the established authenticated console design system.
Confidence: high
Scope-risk: moderate
Directive: Keep the first-successful-top-up condition explicit in every explanatory surface.
Tested: invitation render tests; bun run typecheck
```

## Task 5: Route, Navigation, and Wallet Ownership Migration

**Files:**
- Create: `web/default/src/routes/_authenticated/invite/index.tsx`
- Modify: `web/default/src/hooks/use-sidebar-data.ts`
- Modify: `web/default/src/features/wallet/index.tsx`
- Modify: `web/default/src/features/wallet/api.ts`
- Modify: `web/default/src/features/wallet/types.ts`
- Modify: `web/default/src/features/wallet/hooks/index.ts`
- Modify: `web/default/src/features/wallet/lib/index.ts`
- Delete: `web/default/src/features/wallet/components/affiliate-rewards-card.tsx`
- Delete: `web/default/src/features/wallet/hooks/use-affiliate.ts`
- Delete: `web/default/src/features/wallet/lib/affiliate.ts`

- [ ] **Step 1: Add the authenticated route**

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { Invitations } from '@/features/invitations'

export const Route = createFileRoute('/_authenticated/invite/')({
  component: Invitations,
})
```

- [ ] **Step 2: Add Personal sidebar navigation**

Import `UserPlus` from `lucide-react` and insert between Wallet and Profile:

```ts
{
  title: t('Invite'),
  url: '/invite',
  icon: UserPlus,
},
```

- [ ] **Step 3: Remove invitation state and rendering from Wallet**

Delete these Wallet responsibilities together:

```ts
// imports
AffiliateRewardsCard
TransferDialog
useAffiliate

// state and hook output
transferDialogOpen
setTransferDialogOpen
affiliateLink
affiliateLoading
transferring
transferQuota

// handlers and JSX
handleTransfer
<AffiliateRewardsCard ... />
<TransferDialog ... />
```

Do not modify recharge, Paddle, Stripe, subscription, billing history, or card-binding logic.

- [ ] **Step 4: Remove wallet-owned invitation exports and files**

Remove `getAffiliateCode`, `transferAffiliateQuota`, `AffiliateCodeResponse`, `AffiliateTransferResponse`, `AffiliateTransferRequest`, the `use-affiliate` export, and the `affiliate` lib export only after the invitation feature compiles with its own replacements.

- [ ] **Step 5: Run route generation, focused tests, and typecheck**

Run from `web/default`: `bun run typecheck`

Expected: PASS and generated TanStack route types include `/invite`.

Run: `bun test src/features/invitations src/features/wallet`

Expected: PASS with no Wallet invitation-card references.

Run: `rg -n "AffiliateRewardsCard|useAffiliate|first API key|successfully calls the API" src/features/wallet src/features/invitations`

Expected: no matches.

- [ ] **Step 6: Commit the ownership migration**

```text
Give invitations a dedicated console home

Constraint: Wallet must retain all payment behavior while invitation-only state moves to /invite.
Rejected: Leaving duplicate invitation entry points | creates conflicting copy and state ownership.
Confidence: high
Scope-risk: moderate
Directive: Do not reintroduce invitation business UI into Wallet.
Tested: invitation and wallet tests; bun run typecheck; stale-copy scan
```

## Task 6: Eight-Locale Product Copy

**Files:**
- Modify: `web/default/src/i18n/locales/en.json`
- Modify: `web/default/src/i18n/locales/zh.json`
- Modify: `web/default/src/i18n/locales/fr.json`
- Modify: `web/default/src/i18n/locales/ru.json`
- Modify: `web/default/src/i18n/locales/ja.json`
- Modify: `web/default/src/i18n/locales/vi.json`
- Modify: `web/default/src/i18n/locales/es.json`
- Modify: `web/default/src/i18n/locales/pt.json`
- Create: `web/default/src/features/invitations/invitations-i18n.test.ts`

- [ ] **Step 1: Write a failing locale completeness test**

```ts
const localeNames = ['en', 'zh', 'fr', 'ru', 'ja', 'vi', 'es', 'pt'] as const
const invitationKeys = [
  'Invite',
  'Invite & Earn',
  'Total earned',
  'Available to transfer',
  'Successful referrals',
  'Waiting for first top-up',
  'Recent referrals',
  'Reward granted',
  'Awaiting top-up',
  'Reward unavailable',
  'You reached the referral reward limit',
  'Your friend completes their first successful top-up',
] as const

for (const localeName of localeNames) {
  test(`${localeName} contains translated invitation copy`, async () => {
    const locale = await import(`../../i18n/locales/${localeName}.json`)
    for (const key of invitationKeys) {
      expect(locale.default[key]).toBeTruthy()
      if (localeName !== 'en') expect(locale.default[key]).not.toBe(key)
    }
  })
}
```

- [ ] **Step 2: Run the test and confirm missing keys**

Run: `bun test src/features/invitations/invitations-i18n.test.ts`

Expected: FAIL on the first absent invitation key.

- [ ] **Step 3: Add real translations to all eight locales**

Use natural product language for each locale. Preserve `API`, `X`, `LinkedIn`, quota interpolation placeholders, and dynamic values exactly. Do not copy English values into non-English files except brand/literal terms.

- [ ] **Step 4: Run sync and untranslated reports**

Run: `bun run i18n:sync`

Expected: success.

Run: `bun test src/features/invitations/invitations-i18n.test.ts`

Expected: PASS.

Run: `rg -n 'Invite & Earn|Waiting for first top-up|Reward granted' src/i18n/locales/_reports/*.untranslated.json`

Expected: no matches.

- [ ] **Step 5: Commit localized copy**

```text
Make invitation guidance clear in every console locale

Constraint: All eight maintained locales require real translations for user-visible copy.
Rejected: English fallbacks in non-English files | hides translation gaps in production.
Confidence: high
Scope-risk: narrow
Directive: Keep reward timing translations anchored to first successful top-up.
Tested: invitation locale test; bun run i18n:sync; untranslated report scan
```

## Task 7: Full Verification and Visual QA

**Files:**
- Modify only files required to fix failures caused by this feature.

- [ ] **Step 1: Run backend verification**

Run: `go test ./model -count=1`

Expected: PASS.

Run: `go test ./controller -run 'Invitation|InviteReward' -count=1`

Expected: PASS.

Run: `go test ./router -count=1`

Expected: PASS or successful package compilation.

Run: `go test ./controller -count=1`

Expected baseline exception: `TestStripeCheckoutSessionEmbeddedModeUsesReturnURL` may fail on unchanged `origin/main`; no new invitation test may fail. Record the exact result.

- [ ] **Step 2: Run frontend verification**

From `web/default` run sequentially:

```text
bun test
bun run typecheck
bun run lint
bun run copyright:check
bun run build
```

Expected: all commands PASS. Fix only feature-caused failures and rerun the failed command plus its dependent checks.

- [ ] **Step 3: Run scope and stale-copy checks**

Run:

```text
git diff --check origin/main...HEAD
rg -n "first API key|successfully calls the API" web/default/src
rg -n "AffiliateRewardsCard|useAffiliate" web/default/src
```

Expected: clean diff and no stale invitation reward copy/components.

- [ ] **Step 4: Run the local application and inspect `/invite`**

Start the existing local Go/console development path without production credentials. In the browser verify:

- sidebar navigation and active state;
- loading, populated, empty, and retry states;
- actual reward `0` with limit-reached explanation;
- copy/email/X/LinkedIn link targets;
- transfer dialog validation and compliance-disabled state;
- desktop and mobile widths without page-level horizontal overflow;
- light and dark themes using existing tokens;
- Wallet no longer contains the referral card and its other panels remain intact.

- [ ] **Step 5: Review changed scope and commit final QA fixes**

Use repository change detection if available; otherwise record the unavailable GitNexus integration and run `git diff --stat origin/main...HEAD`, `git diff --name-only origin/main...HEAD`, and `git diff --check origin/main...HEAD` as the fallback scope evidence.

```text
Close invitation-page verification gaps

Constraint: Final fixes are limited to failures or visual defects introduced by the invitation feature.
Rejected: Opportunistic baseline cleanup | would mix unrelated controller behavior into this branch.
Confidence: high
Scope-risk: narrow
Directive: Preserve the recorded origin/main controller baseline exception separately from feature results.
Tested: model/controller/router tests; bun test/typecheck/lint/copyright/build; browser responsive and theme QA
```

## Completion Evidence

The feature is complete only when:

- the endpoint returns scoped, paginated, server-masked records with actual historical reward values;
- `/invite` is reachable from Personal navigation and matches NewAPI visual patterns;
- copy and FAQ consistently say rewards are granted after the invitee's first successful top-up;
- reward transfer works only through the existing compliant backend mutation;
- Wallet contains no invitation business UI and retains payment functionality;
- all eight locales pass completeness and untranslated-report checks;
- targeted backend tests and all frontend quality gates pass;
- browser QA covers light/dark and mobile/desktop layouts;
- the only accepted failing verification is the independently reproduced `origin/main` Stripe controller baseline failure.
