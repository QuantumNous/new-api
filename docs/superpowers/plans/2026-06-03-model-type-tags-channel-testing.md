# Model Type Tags and Stable Channel Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent model type tags to model metadata, require channel creation/editing to use one model type per channel, and use those tags to build correct channel test requests.

**Architecture:** Store a `model_type` column on `models`, using values `text`, `embedding`, `image`, `file`, `audio`, and `video`. The channel form lets the operator choose one type for the channel's model list and applies it to selected/created model metadata; channel tests resolve endpoint type from explicit UI selection, then model metadata `model_type`, then existing name heuristics. `/models/metadata` displays and filters by model type.

**Tech Stack:** Go/Gin/GORM, React 19/TypeScript, TanStack Table, Bun.

---

## File Structure

- Modify `model/model_meta.go`
  - Add `ModelType` field and constants.
  - Persist `model_type` in insert/update/search.
- Modify `model/main.go`
  - Ensure `models.model_type` exists for SQLite/MySQL/PostgreSQL migrations.
- Modify `controller/model_meta.go`
  - Accept and normalize `model_type` on create/update.
  - Filter `/api/models/search` and `/api/models/` by `model_type` query param.
- Modify `controller/channel-test.go`
  - Fix `buildTestRequest` for Seedream/image models.
  - Resolve endpoint type from model metadata type.
  - Use `2K` size for VolcEngine Seedream image tests.
- Modify `web/default/src/features/models/types.ts`
  - Add `model_type` to Model and request params.
- Modify `web/default/src/features/models/components/models-columns.tsx`
  - Show model type badge column.
- Modify `web/default/src/features/models/components/drawers/model-mutate-drawer.tsx`
  - Add model type selector for manual model metadata editing.
- Modify `web/default/src/features/models/api.ts`, table/filter files as needed
  - Pass model type filter to backend and expose UI filter.
- Modify `web/default/src/features/channels/components/drawers/channel-mutate-drawer.tsx`
  - Add channel model type selector.
  - Ensure one channel save contains only one selected type.
  - Apply selected type to model metadata when creating/updating missing model metadata.
- Modify channel form library/types under `web/default/src/features/channels/lib/` and `types.ts` if needed
  - Add form field `model_type` or equivalent derived UI state.

---

### Task 1: Backend model type constants, model field, and migration

**Files:**
- Modify: `model/model_meta.go`
- Modify: `model/main.go`
- Test: `model/model_type_test.go`

- [ ] **Step 1: Write failing model type persistence test**

Create `model/model_type_test.go`:

```go
package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupModelTypeTestDB(t *testing.T) {
	t.Helper()
	oldDB := DB
	oldSQLite := common.UsingSQLite
	DB = nil
	common.UsingSQLite = true
	t.Cleanup(func() {
		DB = oldDB
		common.UsingSQLite = oldSQLite
	})
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	DB = db
	if err := DB.AutoMigrate(&Model{}); err != nil {
		t.Fatalf("migrate model: %v", err)
	}
}

func TestModelTypePersistsOnInsertAndUpdate(t *testing.T) {
	setupModelTypeTestDB(t)

	m := &Model{ModelName: "doubao-seedream-4-5-251128", ModelType: ModelTypeImage, Status: 1}
	if err := m.Insert(); err != nil {
		t.Fatalf("insert model: %v", err)
	}

	var got Model
	if err := DB.First(&got, m.Id).Error; err != nil {
		t.Fatalf("load model: %v", err)
	}
	if got.ModelType != ModelTypeImage {
		t.Fatalf("model_type after insert = %q, want %q", got.ModelType, ModelTypeImage)
	}

	got.ModelType = ModelTypeEmbedding
	if err := got.Update(); err != nil {
		t.Fatalf("update model: %v", err)
	}

	var updated Model
	if err := DB.First(&updated, m.Id).Error; err != nil {
		t.Fatalf("load updated model: %v", err)
	}
	if updated.ModelType != ModelTypeEmbedding {
		t.Fatalf("model_type after update = %q, want %q", updated.ModelType, ModelTypeEmbedding)
	}
}

func TestNormalizeModelType(t *testing.T) {
	cases := map[string]string{
		"":          ModelTypeText,
		"Text":      ModelTypeText,
		"embedding": ModelTypeEmbedding,
		"Image":     ModelTypeImage,
		"File":      ModelTypeFile,
		"Audio":     ModelTypeAudio,
		"Video":     ModelTypeVideo,
		"unknown":   ModelTypeText,
	}
	for input, want := range cases {
		if got := NormalizeModelType(input); got != want {
			t.Fatalf("NormalizeModelType(%q) = %q, want %q", input, got, want)
		}
	}
}
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
go test ./model -run 'TestModelTypePersistsOnInsertAndUpdate|TestNormalizeModelType'
```

Expected: FAIL because `Model.ModelType`, `ModelTypeImage`, `ModelTypeEmbedding`, and `NormalizeModelType` do not exist.

- [ ] **Step 3: Add model type constants and field**

In `model/model_meta.go`, add constants near name-rule constants:

```go
const (
	ModelTypeText      = "text"
	ModelTypeEmbedding = "embedding"
	ModelTypeImage     = "image"
	ModelTypeFile      = "file"
	ModelTypeAudio     = "audio"
	ModelTypeVideo     = "video"
)

func NormalizeModelType(modelType string) string {
	switch strings.ToLower(strings.TrimSpace(modelType)) {
	case ModelTypeEmbedding:
		return ModelTypeEmbedding
	case ModelTypeImage:
		return ModelTypeImage
	case ModelTypeFile:
		return ModelTypeFile
	case ModelTypeAudio:
		return ModelTypeAudio
	case ModelTypeVideo:
		return ModelTypeVideo
	default:
		return ModelTypeText
	}
}
```

Add field to `Model` after `Tags`:

```go
ModelType string `json:"model_type" gorm:"type:varchar(32);not null;default:'text'"`
```

In `Insert`, before `DB.Create(mi)`:

```go
mi.ModelType = NormalizeModelType(mi.ModelType)
```

In `Update`, before `Updates(mi)`:

```go
mi.ModelType = NormalizeModelType(mi.ModelType)
```

Update the `Select(...)` list in `Update` to include `model_type`:

```go
Select("model_name", "description", "icon", "tags", "model_type", "vendor_id", "endpoints", "status", "sync_official", "name_rule", "updated_time")
```

- [ ] **Step 4: Add cross-DB migration**

In `model/main.go`, add a helper using existing cross-DB patterns:

```go
func ensureModelTypeColumn() error {
	if hasColumn("models", "model_type") {
		return nil
	}
	ddl := "ALTER TABLE models ADD COLUMN model_type varchar(32) NOT NULL DEFAULT 'text'"
	if common.UsingPostgreSQL {
		ddl = `ALTER TABLE models ADD COLUMN "model_type" varchar(32) NOT NULL DEFAULT 'text'`
	}
	return DB.Exec(ddl).Error
}
```

Call it after model AutoMigrate in both `migrateDB` and `migrateDBFast` paths.

- [ ] **Step 5: Run tests**

Run:

```bash
go test ./model -run 'TestModelTypePersistsOnInsertAndUpdate|TestNormalizeModelType'
```

Expected: PASS.

---

### Task 2: Backend channel test endpoint resolution

**Files:**
- Modify: `controller/channel-test.go`
- Test: `controller/channel_test_model_type_test.go`

- [ ] **Step 1: Write failing channel-test request tests**

Create `controller/channel_test_model_type_test.go`:

```go
package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

func TestBuildTestRequestAutoVolcSeedreamUsesImageRequest(t *testing.T) {
	ch := &model.Channel{Type: constant.ChannelTypeVolcEngine}
	req := buildTestRequest("doubao-seedream-4-5-251128", "", ch, false)
	img, ok := req.(*dto.ImageRequest)
	if !ok {
		t.Fatalf("buildTestRequest returned %T, want *dto.ImageRequest", req)
	}
	if img.Size != "2K" {
		t.Fatalf("seedream image test size = %q, want 2K", img.Size)
	}
}

func TestBuildImageTestRequestUsesOpenAICompatibleDefaultSize(t *testing.T) {
	ch := &model.Channel{Type: constant.ChannelTypeOpenAI}
	req := buildImageTestRequest("gpt-image-1", ch)
	if req.Size != "1024x1024" {
		t.Fatalf("openai image test size = %q, want 1024x1024", req.Size)
	}
}
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
go test ./controller -run 'TestBuildTestRequestAutoVolcSeedreamUsesImageRequest|TestBuildImageTestRequestUsesOpenAICompatibleDefaultSize'
```

Expected: FAIL because auto seedream returns `*dto.GeneralOpenAIRequest` and `buildImageTestRequest` does not exist.

- [ ] **Step 3: Add image test request helper**

In `controller/channel-test.go`, add:

```go
func buildImageTestRequest(modelName string, channel *model.Channel) *dto.ImageRequest {
	size := "1024x1024"
	if channel != nil && channel.Type == constant.ChannelTypeVolcEngine && strings.Contains(strings.ToLower(modelName), "seedream") {
		size = "2K"
	}
	return &dto.ImageRequest{
		Model:  modelName,
		Prompt: "a cute cat",
		N:      lo.ToPtr(uint(1)),
		Size:   size,
	}
}
```

Replace explicit image endpoint branch with:

```go
case constant.EndpointTypeImageGeneration:
	return buildImageTestRequest(model, channel)
```

Add automatic seedream branch before the default chat request:

```go
if channel != nil && channel.Type == constant.ChannelTypeVolcEngine && strings.Contains(strings.ToLower(model), "seedream") {
	return buildImageTestRequest(model, channel)
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
go test ./controller -run 'TestBuildTestRequestAutoVolcSeedreamUsesImageRequest|TestBuildImageTestRequestUsesOpenAICompatibleDefaultSize'
```

Expected: PASS.

---

### Task 3: Use model metadata type in channel tests

**Files:**
- Modify: `model/model_meta.go`
- Modify: `controller/channel-test.go`
- Test: extend `controller/channel_test_model_type_test.go`

- [ ] **Step 1: Write failing endpoint mapping test**

Append to `controller/channel_test_model_type_test.go`:

```go
func TestEndpointTypeFromModelType(t *testing.T) {
	cases := map[string]constant.EndpointType{
		model.ModelTypeText:      constant.EndpointTypeOpenAI,
		model.ModelTypeEmbedding: constant.EndpointTypeEmbeddings,
		model.ModelTypeImage:     constant.EndpointTypeImageGeneration,
		model.ModelTypeFile:      constant.EndpointTypeOpenAIResponse,
		model.ModelTypeAudio:     constant.EndpointTypeOpenAI,
		model.ModelTypeVideo:     constant.EndpointTypeOpenAI,
	}
	for modelType, want := range cases {
		got := endpointTypeFromModelType(modelType)
		if got != want {
			t.Fatalf("endpointTypeFromModelType(%q) = %q, want %q", modelType, got, want)
		}
	}
}
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
go test ./controller -run TestEndpointTypeFromModelType
```

Expected: FAIL because `endpointTypeFromModelType` does not exist.

- [ ] **Step 3: Implement endpoint type resolver**

In `controller/channel-test.go`, add:

```go
func endpointTypeFromModelType(modelType string) constant.EndpointType {
	switch model.NormalizeModelType(modelType) {
	case model.ModelTypeEmbedding:
		return constant.EndpointTypeEmbeddings
	case model.ModelTypeImage:
		return constant.EndpointTypeImageGeneration
	case model.ModelTypeFile:
		return constant.EndpointTypeOpenAIResponse
	default:
		return constant.EndpointTypeOpenAI
	}
}
```

Add a model lookup helper:

```go
func getModelTypeForTest(modelName string) string {
	var m model.Model
	if err := model.DB.Where("model_name = ?", modelName).First(&m).Error; err != nil {
		return ""
	}
	return m.ModelType
}
```

In `testChannel`, before existing name heuristics, when `endpointType == ""`, try model metadata:

```go
if mt := getModelTypeForTest(testModel); mt != "" {
	if info, ok := common.GetDefaultEndpointInfo(endpointTypeFromModelType(mt)); ok {
		requestPath = info.Path
	}
}
```

Ensure this does not override explicit `endpoint_type`.

- [ ] **Step 4: Run tests**

Run:

```bash
go test ./controller -run 'TestEndpointTypeFromModelType|TestBuildTestRequestAutoVolcSeedreamUsesImageRequest'
```

Expected: PASS.

---

### Task 4: Model metadata API filter and CRUD normalization

**Files:**
- Modify: `model/model_meta.go`
- Modify: `controller/model_meta.go`
- Test: `model/model_type_search_test.go`

- [ ] **Step 1: Write failing search-by-type test**

Create `model/model_type_search_test.go`:

```go
package model

import "testing"

func TestSearchModelsFiltersByModelType(t *testing.T) {
	setupModelTypeTestDB(t)

	models := []*Model{
		{ModelName: "chat-model", ModelType: ModelTypeText, Status: 1},
		{ModelName: "image-model", ModelType: ModelTypeImage, Status: 1},
	}
	for _, m := range models {
		if err := m.Insert(); err != nil {
			t.Fatalf("insert %s: %v", m.ModelName, err)
		}
	}

	got, total, err := SearchModels("", "", ModelTypeImage, 0, 10)
	if err != nil {
		t.Fatalf("SearchModels returned error: %v", err)
	}
	if total != 1 || len(got) != 1 || got[0].ModelName != "image-model" {
		t.Fatalf("SearchModels image filter got total=%d models=%+v", total, got)
	}
}
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
go test ./model -run TestSearchModelsFiltersByModelType
```

Expected: FAIL because `SearchModels` currently accepts `(keyword, vendor, offset, limit)`.

- [ ] **Step 3: Update model search signature**

Change `SearchModels` signature in `model/model_meta.go` to:

```go
func SearchModels(keyword string, vendor string, modelType string, offset int, limit int) ([]*Model, int64, error)
```

Inside it, after vendor filter:

```go
if modelType != "" && modelType != "all" {
	db = db.Where("models.model_type = ?", NormalizeModelType(modelType))
}
```

Update call site in `controller/model_meta.go`:

```go
modelType := c.Query("model_type")
modelsMeta, total, err := model.SearchModels(keyword, vendor, modelType, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
```

In `CreateModelMeta` and `UpdateModelMeta`, normalize:

```go
m.ModelType = model.NormalizeModelType(m.ModelType)
```

- [ ] **Step 4: Run tests**

Run:

```bash
go test ./model -run 'TestSearchModelsFiltersByModelType|TestModelTypePersistsOnInsertAndUpdate'
```

Expected: PASS.

---

### Task 5: Channel create/edit one model type selector

**Files:**
- Modify: `web/default/src/features/channels/lib/channel-form.ts` or the file that defines `ChannelFormValues`
- Modify: `web/default/src/features/channels/components/drawers/channel-mutate-drawer.tsx`
- Modify: `web/default/src/features/channels/components/drawers/sections/*` if model section is split there
- Modify: `web/default/src/features/channels/types.ts` if needed

- [ ] **Step 1: Add frontend model type constants**

Create or extend `web/default/src/features/channels/lib/model-types.ts`:

```ts
export const MODEL_TYPE_OPTIONS = [
  { value: 'text', label: 'Text' },
  { value: 'embedding', label: 'Embedding' },
  { value: 'image', label: 'Image' },
  { value: 'file', label: 'File' },
  { value: 'audio', label: 'Audio' },
  { value: 'video', label: 'Video' },
] as const

export type ModelType = (typeof MODEL_TYPE_OPTIONS)[number]['value']

export function inferModelType(modelName: string): ModelType {
  const lower = modelName.toLowerCase()
  if (lower.includes('embedding') || lower.includes('embed') || lower.includes('bge-') || lower.startsWith('m3e')) return 'embedding'
  if (lower.includes('seedream') || lower.includes('image') || lower.includes('gpt-image')) return 'image'
  if (lower.includes('seedance') || lower.includes('video') || lower.includes('sora')) return 'video'
  if (lower.includes('tts') || lower.includes('audio') || lower.includes('speech')) return 'audio'
  if (lower.includes('file')) return 'file'
  return 'text'
}
```

- [ ] **Step 2: Add form field**

Extend `ChannelFormValues` with:

```ts
model_type: ModelType
```

Default:

```ts
model_type: 'text'
```

When opening edit drawer, infer default from the first parsed model if existing metadata is unavailable.

- [ ] **Step 3: Render model type selector near model list**

In the channel model section, add a `Select`:

```tsx
<FormField
  control={form.control}
  name='model_type'
  render={({ field }) => (
    <FormItem>
      <FormLabel>{t('Model Type')}</FormLabel>
      <Select value={field.value} onValueChange={field.onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {MODEL_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <FormDescription>
        {t('Each channel should contain one type of model so tests and routing use the correct endpoint.')}
      </FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

- [ ] **Step 4: Enforce one channel type in UI copy**

When models textarea/combobox changes, if all models infer to the same type and the user has not manually changed `model_type`, set it automatically. Do not block mixed names in this first pass; show a warning if inferred types differ:

```tsx
<Alert>
  <AlertDescription>
    {t('This channel should contain only {{type}} models. Move other model types to separate channels.', { type: selectedType })}
  </AlertDescription>
</Alert>
```

- [ ] **Step 5: Persist type to model metadata on save**

Where the channel save flow creates missing model metadata or syncs model list to metadata, include `model_type: values.model_type` in the payload.

If that code path does not exist, add a small post-save best-effort sync function:

```ts
async function upsertChannelModelsMetadata(models: string[], modelType: ModelType) {
  for (const modelName of models) {
    await createOrUpdateModelMetadata({ model_name: modelName, model_type: modelType, status: 1 })
  }
}
```

Use existing model metadata API functions if already present; do not duplicate API clients.

---

### Task 6: `/models/metadata` display and filter by model type

**Files:**
- Modify: `web/default/src/features/models/types.ts`
- Modify: `web/default/src/features/models/api.ts`
- Modify: `web/default/src/features/models/components/models-columns.tsx`
- Modify: `web/default/src/features/models/components/models-table.tsx` or filter toolbar component
- Modify: `web/default/src/features/models/components/drawers/model-mutate-drawer.tsx`

- [ ] **Step 1: Add type field to frontend model type**

In `web/default/src/features/models/types.ts`, add:

```ts
export type ModelType = 'text' | 'embedding' | 'image' | 'file' | 'audio' | 'video'
```

Add to `Model`:

```ts
model_type: ModelType
```

Add to params:

```ts
model_type?: string
```

- [ ] **Step 2: Add model type badge column**

In `models-columns.tsx`, add a column after model name:

```tsx
{
  accessorKey: 'model_type',
  meta: { label: t('Model Type'), mobileBadge: true },
  header: t('Model Type'),
  cell: ({ row }) => {
    const type = row.original.model_type || 'text'
    return <StatusBadge label={type} variant='info' size='sm' />
  },
  size: 120,
  enableSorting: false,
}
```

- [ ] **Step 3: Add filter UI**

Add a model type filter with options:

```ts
[
  { label: t('All Types'), value: 'all' },
  { label: 'Text', value: 'text' },
  { label: 'Embedding', value: 'embedding' },
  { label: 'Image', value: 'image' },
  { label: 'File', value: 'file' },
  { label: 'Audio', value: 'audio' },
  { label: 'Video', value: 'video' },
]
```

Pass selected value to API as `model_type`.

- [ ] **Step 4: Add model type selector to model drawer**

In `model-mutate-drawer.tsx`, add same selector as channel edit. Persist via existing create/update payload.

- [ ] **Step 5: Verify frontend**

Run:

```bash
cd web/default && bun run typecheck
```

Expected: PASS.

---

### Task 7: End-to-end verification

**Files:**
- Verify backend and frontend only.

- [ ] **Step 1: Run targeted backend tests**

Run:

```bash
go test ./model ./controller -run 'TestModelType|TestSearchModelsFiltersByModelType|TestBuildTestRequest|TestEndpointTypeFromModelType'
```

Expected: PASS.

- [ ] **Step 2: Run frontend typecheck**

Run:

```bash
cd web/default && bun run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run frontend build**

Run:

```bash
cd web/default && bun run build
```

Expected: PASS.

- [ ] **Step 4: Manual check**

Run:

```bash
./restart.sh
```

Open `http://localhost:9588/channels`:

1. Edit `Ark-Image Model`.
2. Select model type `Image`.
3. Confirm all listed models are intended image models.
4. Save.
5. Click direct test.
6. Expected: no `invalid image request type`.

Open `/models/metadata`:

1. Confirm `doubao-seedream-4-5-251128` shows type `image`.
2. Filter by `Image`.
3. Confirm image models are shown and text models are hidden.

---

## Self-Review

- Spec coverage: Covers database schema change, channel create/edit one-type selection, channel test stability, `/models/metadata` type display/filter, and Seedream size fix.
- Placeholder scan: No placeholders remain; all tasks name files and expected commands.
- Type consistency: Backend uses `model_type`; frontend uses `model_type`; allowed values are `text`, `embedding`, `image`, `file`, `audio`, `video`.
- Scope check: This is one coherent feature: persistent model type metadata used by channel tests and model metadata UI.
