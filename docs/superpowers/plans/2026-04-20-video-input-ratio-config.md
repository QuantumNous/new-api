# Video Input Ratio Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `video_input` billing multipliers configurable from the admin web UI without breaking existing model-level pricing settings.

**Architecture:** Add a new backend option key, `TaskConditionRatio`, with a generic keyed JSON structure but only expose `video_input` in the first UI release. Doubao/Seedance task adaptors keep condition detection logic and read configured ratios first, then fall back to current hard-coded defaults.

**Tech Stack:** Go, Gin, existing `options` persistence, `setting/ratio_setting` cache helpers, React/Semi UI admin settings page.

---

### Task 1: Add backend storage and accessor for task condition ratios

**Files:**
- Create: `setting/ratio_setting/task_condition_ratio.go`
- Modify: `model/option.go`
- Modify: `controller/option.go`
- Test: `setting/ratio_setting/task_condition_ratio_test.go`

- [ ] **Step 1: Write the failing tests**

```go
package ratio_setting

import "testing"

func TestUpdateTaskConditionRatioByJSONStringAndLookup(t *testing.T) {
	jsonStr := `{"video_input":{"doubao-seedance-1-0-pro-250528":0.5}}`

	if err := UpdateTaskConditionRatioByJSONString(jsonStr); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	ratio, ok := GetTaskConditionRatio("video_input", "doubao-seedance-1-0-pro-250528")
	if !ok {
		t.Fatalf("expected configured condition ratio")
	}
	if ratio != 0.5 {
		t.Fatalf("expected ratio 0.5, got %v", ratio)
	}
}

func TestGetTaskConditionRatioMissingCondition(t *testing.T) {
	if err := UpdateTaskConditionRatioByJSONString(`{"video_input":{"model-a":0.5}}`); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if _, ok := GetTaskConditionRatio("seconds", "model-a"); ok {
		t.Fatalf("expected missing condition lookup to fail")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./setting/ratio_setting -run TaskConditionRatio`
Expected: FAIL with undefined `UpdateTaskConditionRatioByJSONString` / `GetTaskConditionRatio`

- [ ] **Step 3: Write minimal implementation**

```go
package ratio_setting

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"
)

var taskConditionRatioMap = types.NewRWMap[string, map[string]float64]()

func TaskConditionRatio2JSONString() string {
	return taskConditionRatioMap.MarshalJSONString()
}

func UpdateTaskConditionRatioByJSONString(jsonStr string) error {
	return types.LoadFromJsonStringWithCallback(taskConditionRatioMap, jsonStr, InvalidateExposedDataCache)
}

func GetTaskConditionRatio(condition, modelName string) (float64, bool) {
	modelMap, ok := taskConditionRatioMap.Get(condition)
	if !ok || modelMap == nil {
		return 0, false
	}
	ratio, ok := modelMap[FormatMatchingModelName(modelName)]
	return ratio, ok
}

func GetTaskConditionRatioCopy() map[string]map[string]float64 {
	return taskConditionRatioMap.ReadAll()
}

func init() {
	_ = common.OpenBrowser
}
```

And wire the new option into existing option loading/update paths:

```go
common.OptionMap["TaskConditionRatio"] = ratio_setting.TaskConditionRatio2JSONString()
```

```go
case "TaskConditionRatio":
	err = ratio_setting.UpdateTaskConditionRatioByJSONString(value)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./setting/ratio_setting -run TaskConditionRatio`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add setting/ratio_setting/task_condition_ratio.go setting/ratio_setting/task_condition_ratio_test.go model/option.go controller/option.go
git commit -m "feat: add task condition ratio storage"
```

### Task 2: Read configured `video_input` in Doubao task billing

**Files:**
- Modify: `relay/channel/task/doubao/adaptor.go`
- Test: `relay/channel/task/doubao/adaptor_test.go`

- [ ] **Step 1: Write the failing test**

```go
func TestEstimateBillingUsesConfiguredVideoInputRatio(t *testing.T) {
	_ = ratio_setting.UpdateTaskConditionRatioByJSONString(`{"video_input":{"doubao-seedance-1-0-pro-250528":0.5}}`)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{
		"model":"doubao-seedance-1-0-pro-250528",
		"metadata":{"content":[{"type":"video_url","video_url":"https://example.com/a.mp4"}]}
	}`))
	c.Request.Header.Set("Content-Type", "application/json")

	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		t.Fatalf("unexpected request parse error: %v", err)
	}
	relaycommon.SetTaskRequest(c, req)

	adaptor := &TaskAdaptor{}
	info := &relaycommon.RelayInfo{OriginModelName: "doubao-seedance-1-0-pro-250528"}
	ratios := adaptor.EstimateBilling(c, info)

	if ratios["video_input"] != 0.5 {
		t.Fatalf("expected configured ratio 0.5, got %v", ratios["video_input"])
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./relay/channel/task/doubao -run UsesConfiguredVideoInputRatio`
Expected: FAIL because adaptor still returns fallback or nil

- [ ] **Step 3: Write minimal implementation**

Update `EstimateBilling` so configured ratios take precedence:

```go
if hasVideoInMetadata(req.Metadata) {
	if ratio, ok := ratio_setting.GetTaskConditionRatio("video_input", info.OriginModelName); ok {
		return map[string]float64{"video_input": ratio}
	}
	if ratio, ok := GetVideoInputRatio(info.OriginModelName); ok {
		return map[string]float64{"video_input": ratio}
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./relay/channel/task/doubao -run UsesConfiguredVideoInputRatio`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add relay/channel/task/doubao/adaptor.go relay/channel/task/doubao/adaptor_test.go
git commit -m "feat: use configured video input ratio for doubao tasks"
```

### Task 3: Add admin UI editing for `video_input`

**Files:**
- Modify: `web/src/pages/Setting/Ratio/ModelRatioSettings.jsx`
- Test: `web/src/pages/Setting/Ratio/hooks/useModelPricingEditorState.js`

- [ ] **Step 1: Write the failing UI expectation test or state-level test**

```js
it('loads and saves VideoInputRatio through TaskConditionRatio.video_input', () => {
  const raw = JSON.stringify({
    video_input: {
      'doubao-seedance-1-0-pro-250528': 0.5,
    },
  });

  const parsed = JSON.parse(raw);
  expect(parsed.video_input['doubao-seedance-1-0-pro-250528']).toBe(0.5);
});
```

- [ ] **Step 2: Run test to verify it fails or add a targeted regression harness**

Run: `pnpm test -- --runInBand`
Expected: FAIL for missing `VideoInputRatio` field, or if no test harness exists, verify current UI has no such field and proceed with state-first implementation.

- [ ] **Step 3: Write minimal implementation**

Add one new textarea field in `ModelRatioSettings`:

```jsx
VideoInputRatio: '',
```

On load:

```jsx
const taskConditionRatio = JSON.parse(props.options.TaskConditionRatio || '{}');
currentInputs.VideoInputRatio = JSON.stringify(taskConditionRatio.video_input || {}, null, 2);
```

On submit:

```jsx
if (item.key === 'VideoInputRatio') {
  const parsed = JSON.parse(inputs.VideoInputRatio || '{}');
  const existing = JSON.parse(props.options.TaskConditionRatio || '{}');
  requestQueue.push(API.put('/api/option/', {
    key: 'TaskConditionRatio',
    value: JSON.stringify({ ...existing, video_input: parsed }),
  }));
  return;
}
```

And add textarea help text:

```jsx
label={t('视频输入倍率')}
extraText={t('仅在任务请求包含视频输入时生效；基础无视频价格仍由 ModelRatio 控制')}
```

- [ ] **Step 4: Run verification**

Run: `pnpm lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/Setting/Ratio/ModelRatioSettings.jsx
git commit -m "feat: add video input ratio admin setting"
```

### Task 4: End-to-end verification and docs update

**Files:**
- Modify: `docs/superpowers/specs/2026-04-20-video-input-ratio-config-design.md`
- Modify: `deploy/newapi-local/CHANGE_SUMMARY.md`

- [ ] **Step 1: Add integration verification notes**

Document the exact validation path:

```md
- Set `TaskConditionRatio.video_input` in admin UI
- Submit one Seedance request with `metadata.content[].video_url`
- Confirm `OtherRatios.video_input` is present
- Confirm final token settlement uses configured multiplier
```

- [ ] **Step 2: Run backend verification**

Run: `go test ./setting/ratio_setting ./relay/channel/task/doubao`
Expected: PASS

- [ ] **Step 3: Run local smoke verification**

Run: `curl.exe -sS http://localhost:3000/api/pricing`
Expected: pricing endpoint remains healthy after option save support is added

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-20-video-input-ratio-config-design.md deploy/newapi-local/CHANGE_SUMMARY.md
git commit -m "docs: record video input ratio verification"
```
