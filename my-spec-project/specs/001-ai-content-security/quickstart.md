# Quickstart: AI Content Security Management Module

**Date**: 2026-06-10
**Feature**: AI Content Security Management Module
**Purpose**: End-to-end validation scenarios for the security module

---

## Prerequisites

1. New-API backend running locally or in a test environment
2. Database migrated with security module tables (`security_groups`, `security_rules`, `security_user_policies`, `security_hit_logs`, `security_audit_logs`)
3. Admin user account with security management permissions
4. At least one AI channel configured (e.g., OpenAI proxy)
5. Security module enabled (`SECURITY_ENABLED=true`)

---

## Scenario 1: Create a Sensitive Word Group and Rule

**Goal**: Verify that administrators can create groups and rules.

### Steps

1. **Authenticate** as an admin and obtain a session token or API key.

2. **Create a group**:
   ```bash
   POST /api/security/groups
   {
     "name": "测试-个人隐私",
     "description": "测试用个人隐私保护分组",
     "parent_id": 0,
     "sort_order": 1
   }
   ```
   **Expected**: Response returns `success: true` with a new `id`.

3. **Create a rule inside the group**:
   ```bash
   POST /api/security/rules
   {
     "group_id": <group_id_from_step_2>,
     "name": "手机号检测",
     "type": 2,
     "content": "1[3-9]\\d{9}",
     "action": 3,
     "priority": 100,
     "risk_score": 50
   }
   ```
   **Expected**: Rule created successfully with `status: 1`.

4. **List groups** and confirm the new group appears:
   ```bash
   GET /api/security/groups?page=1&page_size=20
   ```
   **Expected**: Group and rule are visible in the response.

### Validation Check
- [ ] Group creation returns a valid ID
- [ ] Rule creation returns a valid ID and references the correct group
- [ ] Listing groups includes the newly created group

---

## Scenario 2: Assign Policy to User and Test Request Masking

**Goal**: Verify that request content is masked according to policy.

### Steps

1. **Create a user policy** binding the test group to a test user:
   ```bash
   POST /api/security/policies
   {
     "user_id": <test_user_id>,
     "group_id": <group_id_from_scenario_1>,
     "scope": 1,
     "default_action": 3
   }
   ```
   **Expected**: Policy created with `status: 1`.

2. **Send a chat completion request** as the test user containing a phone number:
   ```bash
   POST /v1/chat/completions
   Authorization: Bearer <test_user_token>
   {
     "model": "gpt-4o",
     "messages": [
       {"role": "user", "content": "我的手机号是13800138000，请帮我查一下余额"}
     ]
   }
   ```
   **Expected**:
   - Request is NOT blocked (action is mask, not block).
   - The upstream AI provider receives the masked content: `我的手机号是138****8000，请帮我查一下余额`.
   - Response to user is successful.

3. **Query hit logs** to confirm detection was recorded:
   ```bash
   GET /api/security/logs?user_id=<test_user_id>&action=3
   ```
   **Expected**: At least one log entry showing:
   - `action: 3` (mask)
   - `risk_score: 50`
   - `original_content_hash` is a non-empty SHA-256 string
   - `match_detail` contains the matched text position

### Validation Check
- [ ] Phone number in request is masked before reaching AI provider
- [ ] Hit log records the detection event with correct action and score
- [ ] User receives a successful response

---

## Scenario 3: Test Blocking Behavior

**Goal**: Verify that high-risk content is blocked.

### Steps

1. **Create a keyword rule** with `action: 4` (block):
   ```bash
   POST /api/security/rules
   {
     "group_id": <group_id>,
     "name": "内部机密拦截",
     "type": 1,
     "content": "内部机密",
     "action": 4,
     "priority": 200,
     "risk_score": 90
   }
   ```

2. **Update the user policy** to include the block rule group with `scope: 3` (both directions).

3. **Send a request** containing the blocked keyword:
   ```bash
   POST /v1/chat/completions
   {
     "model": "gpt-4o",
     "messages": [
       {"role": "user", "content": "这是内部机密，不得外传"}
     ]
   }
   ```
   **Expected**:
   - Response status is `403` or `400` with a message indicating content was blocked.
   - Request does NOT reach the AI provider.
   - Hit log records `action: 4` (block) and `risk_score: 90`.

### Validation Check
- [ ] Request containing blocked keyword is rejected
- [ ] No traffic is sent to the AI provider
- [ ] Block event is recorded in hit logs

---

## Scenario 4: Test Response Detection

**Goal**: Verify that AI responses are scanned for sensitive content.

### Steps

1. Ensure the test user policy has `scope: 3` (both request and response).

2. Send a benign request that the AI might respond to with sensitive patterns.

3. If the AI response contains a pattern matching a rule (e.g., a phone number or ID number), verify:
   - The response is either masked or blocked according to policy.
   - A hit log is created with `content_type: 2` (response).

### Validation Check
- [ ] Response detection is active when scope includes responses
- [ ] Matched response content is handled according to policy
- [ ] Response hit logs have `content_type: 2`

---

## Scenario 5: Dashboard and Statistics

**Goal**: Verify that the dashboard aggregates detection events correctly.

### Steps

1. After running Scenarios 1-4, query the dashboard:
   ```bash
   GET /api/security/dashboard
   ```

2. **Expected**:
   - `summary.total_detections` is greater than 0.
   - `top_categories` includes the test group name.
   - `top_users` includes the test user.
   - `risk_distribution` has counts in relevant buckets.

### Validation Check
- [ ] Dashboard returns non-zero detection counts
- [ ] Top categories match the groups created in testing
- [ ] Risk distribution reflects the test events

---

## Scenario 6: Global Disable Switch

**Goal**: Verify that the security module can be disabled via environment variable.

### Steps

1. Set `SECURITY_ENABLED=false` and restart the service.

2. Send a request containing sensitive content that would normally be blocked.
   **Expected**: Request passes through without any detection or blocking.

3. Re-enable by setting `SECURITY_ENABLED=true` and restart.

### Validation Check
- [ ] With `SECURITY_ENABLED=false`, no detection occurs
- [ ] With `SECURITY_ENABLED=true`, detection resumes

---

## Cleanup

After validation, clean up test artifacts:

1. Delete the test policy.
2. Delete the test rules.
3. Delete the test group.
4. Optionally truncate test hit logs (if not needed for further testing).

---

## Troubleshooting

| Symptom | Likely Cause | Resolution |
|---------|--------------|------------|
| No detection occurring | Policy not bound to user or group disabled | Verify policy `status`, `user_id`, and group `status` |
| Rules not matching | Regex syntax error or keyword case mismatch | Check rule `content` and `extra_config` |
| High latency | AI detection timeout or too many rules | Reduce rule count or disable AI detection temporarily |
| Dashboard shows zero | No hit logs recorded | Verify middleware is registered in the request pipeline |
| Database errors | Migration not run | Execute database migration scripts for security tables |
