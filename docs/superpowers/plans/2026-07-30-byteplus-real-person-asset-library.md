# BytePlus 真人素材库 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为每个 Flatkey 用户提供可拥有多个真人档案的私有素材库，支持 BytePlus 真人认证、HTTPS URL 与本地 multipart 文件创建素材、Seedance `asset://` 引用、幂等删除以及生产多节点恢复。

**Architecture:** 在现有 BytePlus 虚拟素材库旁新增真人档案、认证会话、通用幂等账本和 TOS 临时对象 outbox；真人素材继续复用 `BytePlusAsset`、公开 `ast_` ID、状态同步和 Seedance 渠道固定链路。所有外部副作用都由数据库 CAS/租约保护；本地文件经请求流直接写同区域私有 TOS，完整哈希产生后再认领幂等账本，进入 `CallingUpstream` 后结果不明则永久转为 `OutcomeUnknown`。

**Tech Stack:** Go 1.25、Gin、GORM、SQLite/MySQL/PostgreSQL、BytePlus ModelArk signed API、`github.com/volcengine/ve-tos-golang-sdk/v2` v2.9.8、AES-256-GCM、现有 OpenAI-compatible error envelope 与 YAML i18n。

---

## 执行边界与不可变约束

- 每个 `BytePlusRealPersonProfile` 固定一个用户、一个 BytePlus 渠道和一个独立 `GroupId`；后续认证、素材、删除和 Seedance 请求都不得静默换渠道。
- 一个 Seedance 请求可以引用同一真人档案的多个素材，也可以混用同渠道虚拟素材；只在非空 `real_person_profile_id` 集合大于 1 时返回 `asset_profile_conflict`。
- JSON 创建与 multipart 创建都强制 `Idempotency-Key`。`Processing` 可在租约过期后 CAS 接管；`CallingUpstream` 不可接管为新的上游调用，只能完成已知结果或转为 `OutcomeUnknown`。
- multipart 不使用 Gin `FormFile`、`ShouldBind` 或 `ParseMultipartForm`。使用 `Request.MultipartReader()`，文件不落本机磁盘，也不缓冲完整文件。
- multipart 的顺序固定为：创建未绑定临时对象 outbox → 流式上传并计算 SHA-256/字节数 → 认领完整请求哈希 → 赢家创建并绑定素材 → 输家立即清理。
- `DELETE` 先把本地状态 CAS 为 `Deleting`，立即禁止新引用；重复删除返回 204，物理删除由当前请求或协调器完成。
- 真人档案 API 状态为 lower_snake_case；素材 API 状态继续保持现有 PascalCase。
- 普通与 fast migration 同时注册。协调器在所有节点启动，不能放进 `common.IsMasterNode` 条件块，不能使用进程锁、`SKIP LOCKED` 或数据库方言专属部分索引。
- API、日志和幂等响应不得暴露 BytedToken、H5 密文/链接、callback token、TOS URL/对象键、GroupId、AssetId、ProjectName、完整源 URL或完整 Channel.Key。

## 文件地图

### 新建文件

- `model/byteplus_real_person.go`：真人档案、认证会话、状态常量、所有权查询和 session/profile CAS。
- `model/api_idempotency.go`：幂等账本模型、领取决策、租约、`CallingUpstream`、重放和 `OutcomeUnknown` CAS。
- `model/byteplus_asset_temp_object.go`：未绑定/已绑定 TOS 临时对象 outbox、清理租约和终态。
- `dto/byteplus_real_person.go`：真人档案创建/列表、URL 素材创建、分页和公开响应 DTO。
- `service/api_idempotency.go`：幂等键/请求哈希、账本决策到稳定 API 错误的映射、安全响应重放。
- `service/byteplus_sensitive_cipher.go`：版本化 AES-256-GCM envelope，AAD 绑定 session 和字段。
- `service/byteplus_real_person_client.go`：真人认证、`ListAssets` 和 `DeleteAsset` 的 BytePlus signed API 方法。
- `service/byteplus_real_person.go`：渠道选择、档案创建、重新认证、查询/列表与可信结果同步。
- `service/byteplus_tos.go`：官方 TOS SDK 适配器、未知长度流式上传、内部 GET 预签名和删除。
- `service/byteplus_asset_upload.go`：multipart 顺序读取、MIME/大小校验、SHA-256、未绑定临时对象两阶段协议。
- `service/byteplus_real_person_asset.go`：URL/本地文件真人素材创建、列表、详情兼容和删除 tombstone。
- `service/byteplus_real_person_jobs.go`：认证、素材状态、删除、TOS 清理和幂等恢复的单轮协调器及启动器。
- `pkg/perf_metrics/byteplus_real_person.go`：固定低基数的真人协调、backlog、callback 和 `OutcomeUnknown` Prometheus 指标。
- `middleware/real_person_callback_metrics.go`：包住 callback limiter 并按最终 HTTP 状态记录固定低基数指标。
- `controller/byteplus_real_person.go`：真人档案、认证会话、素材列表/创建和 callback handler。
- `docs/api/byteplus-real-person-asset-api.md`：公开 API、状态、幂等、本地文件和安全说明。

### 新建测试文件

- `model/byteplus_real_person_test.go`
- `model/api_idempotency_test.go`
- `model/byteplus_asset_temp_object_test.go`
- `service/api_idempotency_test.go`
- `service/byteplus_sensitive_cipher_test.go`
- `service/byteplus_real_person_client_test.go`
- `service/byteplus_real_person_test.go`
- `service/byteplus_tos_test.go`
- `service/byteplus_asset_upload_test.go`
- `service/byteplus_real_person_asset_test.go`
- `service/byteplus_real_person_jobs_test.go`
- `pkg/perf_metrics/byteplus_real_person_test.go`
- `controller/byteplus_real_person_test.go`
- `router/byteplus_real_person_openapi_test.go`
- `middleware/logger_test.go`
- `middleware/real_person_callback_metrics_test.go`

### 修改文件

- `model/byteplus_asset.go`：真人档案关联、素材名称/失败码、`Deleting/Deleted` 和删除租约字段。
- `model/byteplus_asset_test.go`：现有状态回归与新终态保护。
- `model/main.go`：普通和 fast migration 注册所有新模型。
- `dto/byteplus_asset.go`、`dto/byteplus_asset_test.go`：统一素材响应，虚拟素材保持 moderation，真人素材返回 `name/asset_uri/failure_code`。
- `service/byteplus_credentials.go`、`service/byteplus_credentials_test.go`：显式真人能力和 TOS 配置。
- `service/byteplus_asset_client.go`、`service/byteplus_asset_client_test.go`：通用响应 envelope 与可判定、已脱敏的上游错误类型。
- `service/byteplus_asset.go`、`service/byteplus_asset_test.go`：详情删除态语义和统一响应构造。
- `service/byteplus_asset_reference.go`、`service/byteplus_asset_reference_test.go`：最多一个真人档案集合、多个同真人素材、混合虚拟素材和删除态拒绝。
- `controller/byteplus_asset.go`、`controller/byteplus_asset_test.go`：DELETE 接口、真人素材响应和稳定错误映射。
- `router/asset-router.go`、`router/asset_router_test.go`：新增用户 API、callback 和删除路由。
- `middleware/rate-limit.go`：callback 专用 IP 限流。
- `middleware/logger.go`：formatter 内部 callback path 模板化。
- `pkg/perf_metrics/prometheus.go`、`pkg/perf_metrics/prometheus_test.go`：把 29 条固定真人时序接入现有 `/metrics`、series 预算和测试 reset。
- `types/error.go`、`types/byteplus_asset_error_test.go`：稳定真人、幂等、上传和 profile 冲突错误码。
- `i18n/keys.go`、`i18n/byteplus_asset_test.go`、`i18n/locales/en.yaml`、`i18n/locales/zh-CN.yaml`、`i18n/locales/zh-TW.yaml`、`i18n/locales/pt.yaml`：四个完整 locale 的公开消息。
- `docs/openapi/relay.json`：所有新增路径、双 content type、响应和 schema。
- `docs/api/byteplus-asset-api.md`、`docs/api/flatkey-video-api.md`：删除语义、真人素材和 Seedance 单真人档案约束。
- `docs/api/byteplus-real-person-release-checklist.md`：三库、受控集成、部署、观测和回滚证据清单。
- `main.go`：在 master-only 块外启动协调器。
- `go.mod`、`go.sum`：官方 TOS SDK v2.9.8。

### Task 1: 建立可迁移的数据模型与素材删除状态

**Files:**
- Create: `model/byteplus_real_person.go`
- Create: `model/api_idempotency.go`
- Create: `model/byteplus_asset_temp_object.go`
- Create: `model/byteplus_real_person_test.go`
- Create: `model/api_idempotency_test.go`
- Create: `model/byteplus_asset_temp_object_test.go`
- Modify: `model/byteplus_asset.go`
- Modify: `model/byteplus_asset_test.go`
- Modify: `model/main.go:250-350`
- Modify: `model/main.go:354-450`

- [ ] **Step 1: 写出模型与迁移失败测试**

在三个新测试文件中使用独立 SQLite 内存库，并为外部方言提供 opt-in smoke。核心测试内容如下；`openBytePlusRealPersonDialectDB` 必须先确认目标表不存在，cleanup 只删除本测试创建的表：

```go
func TestBytePlusRealPersonSchemaSupportsMultiplePendingProfilesAndUniqueGroup(t *testing.T) {
	db := newBytePlusRealPersonTestDB(t)

	first := BytePlusRealPersonProfile{
		PublicId: "rph_first",
		UserId: 7,
		Name: "Person A",
		ChannelId: 101,
		Status: BytePlusRealPersonProfileStatusPendingVerification,
	}
	second := BytePlusRealPersonProfile{
		PublicId: "rph_second",
		UserId: 7,
		Name: "Person B",
		ChannelId: 101,
		Status: BytePlusRealPersonProfileStatusPendingVerification,
	}
	require.NoError(t, db.Create(&first).Error)
	require.NoError(t, db.Create(&second).Error)

	groupID := "group-1"
	require.NoError(t, db.Model(&first).Update("upstream_group_id", groupID).Error)
	duplicate := BytePlusRealPersonProfile{
		PublicId: "rph_third",
		UserId: 7,
		Name: "Person C",
		ChannelId: 101,
		UpstreamGroupId: &groupID,
		Status: BytePlusRealPersonProfileStatusActive,
	}
	require.Error(t, db.Create(&duplicate).Error)
}

func TestBytePlusAssetTempObjectAllowsUnboundRowsAndUniqueBoundAsset(t *testing.T) {
	db := newBytePlusRealPersonTestDB(t)
	first := BytePlusAssetTempObject{UserId: 7, ChannelId: 101, Bucket: "private", ObjectKey: "tmp/a", CleanupStatus: BytePlusTempObjectCleanupPending}
	second := BytePlusAssetTempObject{UserId: 7, ChannelId: 101, Bucket: "private", ObjectKey: "tmp/b", CleanupStatus: BytePlusTempObjectCleanupPending}
	require.NoError(t, db.Create(&first).Error)
	require.NoError(t, db.Create(&second).Error)
	require.Nil(t, first.AssetId)
	require.Nil(t, second.AssetId)

	assetID := int64(55)
	require.NoError(t, db.Model(&first).Update("asset_id", assetID).Error)
	second.AssetId = &assetID
	require.Error(t, db.Save(&second).Error)
}

func TestBytePlusAssetDeletingAndDeletedAreTerminalForStatusPolling(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	for _, status := range []string{BytePlusAssetStatusDeleting, BytePlusAssetStatusDeleted} {
		asset := BytePlusAsset{PublicId: "ast_" + status, UserId: 7, ChannelId: 101, AssetType: "Image", Status: status}
		require.NoError(t, DB.Create(&asset).Error)
		err := UpdateBytePlusAssetStatus(asset.Id, BytePlusAssetStatusActive, "", 200)
		require.ErrorIs(t, err, ErrBytePlusAssetNotUpdatable)
	}
}

func TestBytePlusRealPersonDialectMigrations(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			db := openBytePlusRealPersonDialectDB(t, dialect)
			require.NoError(t, db.AutoMigrate(
				&BytePlusRealPersonProfile{},
				&BytePlusVisualValidationSession{},
				&APIIdempotencyRecord{},
				&BytePlusAssetTempObject{},
				&BytePlusAsset{},
			))
			require.True(t, db.Migrator().HasColumn(&BytePlusAssetTempObject{}, "asset_id"))
			require.True(t, db.Migrator().HasColumn(&BytePlusAsset{}, "real_person_profile_id"))
		})
	}
}

var bytePlusRealPersonTestDBSequence atomic.Uint64

func newBytePlusRealPersonTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := fmt.Sprintf(
		"file:byteplus-real-person-%d?mode=memory&cache=shared&_pragma=busy_timeout(5000)",
		bytePlusRealPersonTestDBSequence.Add(1),
	)
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	// Serialize SQLite writes; the idempotency tests still exercise competing
	// callers, while avoiding driver-level SQLITE_BUSY noise.
	sqlDB.SetMaxOpenConns(1)

	previous := DB
	DB = db
	require.NoError(t, db.AutoMigrate(
		&BytePlusRealPersonProfile{},
		&BytePlusVisualValidationSession{},
		&APIIdempotencyRecord{},
		&BytePlusAssetTempObject{},
		&BytePlusAsset{},
	))
	t.Cleanup(func() {
		DB = previous
		require.NoError(t, sqlDB.Close())
	})
	return db
}

func openBytePlusRealPersonDialectDB(t *testing.T, dialect string) *gorm.DB {
	t.Helper()
	var (
		db  *gorm.DB
		err error
	)
	switch dialect {
	case "sqlite":
		db, err = gorm.Open(sqlite.Open("file:byteplus-real-person-dialect?mode=memory&cache=shared"), &gorm.Config{})
	case "mysql":
		dsn := strings.TrimSpace(os.Getenv("TEST_MYSQL_DSN"))
		if dsn == "" {
			t.Skip("set TEST_MYSQL_DSN to run the MySQL schema smoke test")
		}
		db, err = gorm.Open(mysql.Open(dsn), &gorm.Config{})
	case "postgres":
		dsn := strings.TrimSpace(os.Getenv("TEST_POSTGRES_DSN"))
		if dsn == "" {
			t.Skip("set TEST_POSTGRES_DSN to run the PostgreSQL schema smoke test")
		}
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	default:
		t.Fatalf("unsupported dialect %q", dialect)
	}
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)

	models := []any{
		&BytePlusAssetTempObject{},
		&APIIdempotencyRecord{},
		&BytePlusVisualValidationSession{},
		&BytePlusRealPersonProfile{},
		&BytePlusAsset{},
	}
	for _, target := range models {
		if db.Migrator().HasTable(target) {
			_ = sqlDB.Close()
			t.Fatalf("refusing to run %s smoke test: target table for %T already exists", dialect, target)
		}
	}
	t.Cleanup(func() {
		// These tables were proven absent above and were created only by this test.
		for _, target := range models {
			require.NoError(t, db.Migrator().DropTable(target))
		}
		require.NoError(t, sqlDB.Close())
	})
	return db
}
```

外部测试分别读取 `TEST_MYSQL_DSN` 和 `TEST_POSTGRES_DSN`；变量为空时 `t.Skip`，变量非空但目标表已存在时 `t.Fatalf`，避免接触非专用数据库。

- [ ] **Step 2: 运行测试并确认 RED**

Run: `go test ./model -run 'TestBytePlusRealPersonSchema|TestBytePlusAssetTempObject|TestBytePlusAssetDeleting|TestBytePlusRealPersonDialectMigrations' -count=1`

Expected: FAIL，错误指向尚未定义的模型、状态常量或字段；外部 DSN 未配置时 MySQL/PostgreSQL 子测试显示 SKIP。

- [ ] **Step 3: 添加精确模型结构**

`model/byteplus_real_person.go` 使用真正可空的指针字段：

```go
const (
	BytePlusRealPersonProfileStatusPendingVerification = "PendingVerification"
	BytePlusRealPersonProfileStatusVerifying           = "Verifying"
	BytePlusRealPersonProfileStatusActive              = "Active"
	BytePlusRealPersonProfileStatusFailed              = "Failed"
	BytePlusRealPersonProfileStatusExpired             = "Expired"

	BytePlusVisualValidationSessionStatusCreating  = "Creating"
	BytePlusVisualValidationSessionStatusPending   = "Pending"
	BytePlusVisualValidationSessionStatusChecking  = "Checking"
	BytePlusVisualValidationSessionStatusSucceeded = "Succeeded"
	BytePlusVisualValidationSessionStatusFailed    = "Failed"
	BytePlusVisualValidationSessionStatusExpired   = "Expired"
)

type BytePlusRealPersonProfile struct {
	Id                         int64   `json:"id"`
	PublicId                   string  `json:"public_id" gorm:"type:varchar(64);uniqueIndex"`
	UserId                     int     `json:"user_id" gorm:"index"`
	Name                       string  `json:"name" gorm:"type:varchar(128)"`
	ChannelId                  int     `json:"-" gorm:"index;uniqueIndex:idx_byteplus_real_person_channel_group"`
	UpstreamGroupId            *string `json:"-" gorm:"type:varchar(128);uniqueIndex:idx_byteplus_real_person_channel_group"`
	CurrentValidationSessionId *int64  `json:"-" gorm:"index"`
	Status                     string  `json:"status" gorm:"type:varchar(32);index"`
	ErrorCode                  string  `json:"-" gorm:"type:varchar(64)"`
	CreatedTime                int64   `json:"created_time" gorm:"bigint;index"`
	UpdatedTime                int64   `json:"updated_time" gorm:"bigint"`
}

type BytePlusVisualValidationSession struct {
	Id                       int64  `json:"id"`
	PublicId                 string `json:"-" gorm:"type:varchar(64);uniqueIndex"`
	ProfileId                int64  `json:"-" gorm:"index"`
	CallbackTokenHash        string `json:"-" gorm:"type:char(64);uniqueIndex"`
	CallbackTokenCiphertext  string `json:"-" gorm:"type:text"`
	BytedTokenCiphertext     string `json:"-" gorm:"type:text"`
	H5LinkCiphertext         string `json:"-" gorm:"type:text"`
	Status                   string `json:"-" gorm:"type:varchar(32);index"`
	ExpiresAt                int64  `json:"-" gorm:"bigint;index"`
	UpstreamRequestId        string `json:"-" gorm:"type:varchar(128)"`
	LeaseUpdatedTime         int64  `json:"-" gorm:"bigint;index"`
	CreatedTime              int64  `json:"-" gorm:"bigint"`
	UpdatedTime              int64  `json:"-" gorm:"bigint"`
}
```

`model/api_idempotency.go`：

```go
const (
	APIIdempotencyStatusReceiving      = "Receiving"
	APIIdempotencyStatusProcessing     = "Processing"
	APIIdempotencyStatusCallingUpstream = "CallingUpstream"
	APIIdempotencyStatusCompleted      = "Completed"
	APIIdempotencyStatusFailed         = "Failed"
	APIIdempotencyStatusOutcomeUnknown = "OutcomeUnknown"
)

type APIIdempotencyRecord struct {
	Id                    int64  `json:"-"`
	UserId                int    `json:"-" gorm:"uniqueIndex:idx_api_idempotency_user_route_key"`
	Route                 string `json:"-" gorm:"type:varchar(96);uniqueIndex:idx_api_idempotency_user_route_key"`
	KeyHash               string `json:"-" gorm:"type:char(64);uniqueIndex:idx_api_idempotency_user_route_key"`
	RequestHash           string `json:"-" gorm:"type:char(64)"`
	Status                string `json:"-" gorm:"type:varchar(32);index"`
	ResourceType          string `json:"-" gorm:"type:varchar(32)"`
	ResourcePublicId      string `json:"-" gorm:"type:varchar(64);index"`
	ResponseStatus        int    `json:"-"`
	ResponsePayload       string `json:"-" gorm:"type:text"`
	UpstreamCallStartedAt int64  `json:"-" gorm:"bigint"`
	LeaseUpdatedTime      int64  `json:"-" gorm:"bigint;index"`
	ExpiresAt             int64  `json:"-" gorm:"bigint;index"`
	CreatedTime           int64  `json:"-" gorm:"bigint"`
	UpdatedTime           int64  `json:"-" gorm:"bigint"`
}
```

`model/byteplus_asset_temp_object.go`：

```go
const (
	BytePlusTempObjectCleanupPending  = "Pending"
	BytePlusTempObjectCleanupCleaning = "Cleaning"
	BytePlusTempObjectCleanupCleaned  = "Cleaned"
)

type BytePlusAssetTempObject struct {
	Id                      int64  `json:"-"`
	AssetId                 *int64 `json:"-" gorm:"uniqueIndex"`
	UserId                  int    `json:"-" gorm:"index"`
	ChannelId               int    `json:"-" gorm:"index"`
	Bucket                  string `json:"-" gorm:"type:varchar(255)"`
	ObjectKey               string `json:"-" gorm:"type:varchar(512);uniqueIndex:idx_byteplus_temp_bucket_key"`
	ContentSHA256           string `json:"-" gorm:"type:char(64)"`
	SizeBytes               int64  `json:"-" gorm:"bigint"`
	MimeType                string `json:"-" gorm:"type:varchar(128)"`
	SignedURLExpiresAt      int64  `json:"-" gorm:"bigint"`
	CleanupStatus           string `json:"-" gorm:"type:varchar(32);index"`
	CleanupAttempts         int    `json:"-"`
	NextCleanupAt           int64  `json:"-" gorm:"bigint;index"`
	CleanupLeaseUpdatedTime int64  `json:"-" gorm:"bigint;index"`
	CleanedTime             int64  `json:"-" gorm:"bigint"`
	CreatedTime             int64  `json:"-" gorm:"bigint"`
	UpdatedTime             int64  `json:"-" gorm:"bigint"`
}
```

- [ ] **Step 4: 扩展素材模型并注册两套迁移**

把以下字段加入 `BytePlusAsset`，并把删除状态加入普通状态轮询的终态集合：

```go
const (
	BytePlusAssetStatusCreating   = "Creating"
	BytePlusAssetStatusProcessing = "Processing"
	BytePlusAssetStatusActive     = "Active"
	BytePlusAssetStatusFailed     = "Failed"
	BytePlusAssetStatusDeleting   = "Deleting"
	BytePlusAssetStatusDeleted    = "Deleted"
)

// Add to BytePlusAsset, keeping all existing fields unchanged.
RealPersonProfileId  *int64 `json:"-" gorm:"index"`
Name                 string `json:"name,omitempty" gorm:"type:varchar(128)"`
FailureCode          string `json:"failure_code,omitempty" gorm:"type:varchar(64)"`
DeleteAttempts       int    `json:"-"`
NextDeleteAt         int64  `json:"-" gorm:"bigint;index"`
DeleteLeaseUpdatedTime int64 `json:"-" gorm:"bigint;index"`
DeletedTime          int64  `json:"-" gorm:"bigint"`

func bytePlusAssetTerminalStatuses() []string {
	return []string{
		BytePlusAssetStatusActive,
		BytePlusAssetStatusFailed,
		BytePlusAssetStatusDeleting,
		BytePlusAssetStatusDeleted,
	}
}
```

在 `migrateDB()` 的同一 BytePlus 区块和 `migrateDBFast()` 的 model 列表中同时加入：

```go
&BytePlusRealPersonProfile{},
&BytePlusVisualValidationSession{},
&APIIdempotencyRecord{},
&BytePlusAssetTempObject{},
```

- [ ] **Step 5: 运行模型与迁移测试并确认 GREEN**

Run: `gofmt -w model/byteplus_real_person.go model/api_idempotency.go model/byteplus_asset_temp_object.go model/byteplus_asset.go model/byteplus_real_person_test.go model/api_idempotency_test.go model/byteplus_asset_temp_object_test.go model/byteplus_asset_test.go`

Run: `go test ./model -run 'BytePlusRealPerson|APIIdempotency|BytePlusAssetTempObject|BytePlusAssetDeleting|BytePlusAssetModels' -count=1`

Expected: PASS；没有外部 DSN 时只跳过 MySQL/PostgreSQL smoke，SQLite 和两套 migration 注册测试必须通过。

- [ ] **Step 6: 提交模型基础**

```bash
git add model/byteplus_real_person.go model/api_idempotency.go model/byteplus_asset_temp_object.go model/byteplus_asset.go model/main.go model/byteplus_real_person_test.go model/api_idempotency_test.go model/byteplus_asset_temp_object_test.go model/byteplus_asset_test.go
git commit -m "Protect real-person ownership before external side effects" -m "Constraint: SQLite, MySQL, and PostgreSQL must share nullable uniqueness and CAS semantics" -m "Rejected: Reusing the per-user virtual asset group | it cannot represent multiple people on one channel" -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: Keep real_person_profile_id nullable so historical virtual assets remain valid" -m "Tested: Go model schema, terminal-state, migration, and opt-in dialect tests"
```

### Task 2: 实现通用幂等账本、租约接管和 OutcomeUnknown

**Files:**
- Modify: `model/api_idempotency.go`
- Modify: `model/api_idempotency_test.go`
- Create: `service/api_idempotency.go`
- Create: `service/api_idempotency_test.go`

- [ ] **Step 1: 写出并发、冲突、重放和不明结果失败测试**

```go
func TestClaimAPIIdempotencyAllowsExactlyOneOwner(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	const workers = 12
	var owners atomic.Int32
	var wg sync.WaitGroup
	for index := 0; index < workers; index++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			claim, err := ClaimAPIIdempotency(7, "real_person_asset_create", "key-hash", "request-hash", "asset", 100, 50, 1000)
			require.NoError(t, err)
			if claim.Decision == APIIdempotencyDecisionOwner {
				owners.Add(1)
			}
		}()
	}
	wg.Wait()
	require.Equal(t, int32(1), owners.Load())
}

func TestClaimAPIIdempotencyRejectsDifferentRequestHash(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	first, err := ClaimAPIIdempotency(7, "real_person_create", "key-hash", "hash-a", APIIdempotencyResourceTypeVerificationSession, 100, 50, 1000)
	require.NoError(t, err)
	require.Equal(t, APIIdempotencyDecisionOwner, first.Decision)

	second, err := ClaimAPIIdempotency(7, "real_person_create", "key-hash", "hash-b", APIIdempotencyResourceTypeVerificationSession, 101, 50, 1000)
	require.NoError(t, err)
	require.Equal(t, APIIdempotencyDecisionConflict, second.Decision)
}

func TestCallingUpstreamLeaseExpiryBecomesOutcomeUnknownWithoutOwnership(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	claim, err := ClaimAPIIdempotency(7, "real_person_create", "key-hash", "hash-a", APIIdempotencyResourceTypeVerificationSession, 100, 50, 1000)
	require.NoError(t, err)
	require.NoError(t, MarkAPIIdempotencyCallingUpstream(claim.Record.Id, claim.Record.LeaseUpdatedTime, 101))

	recovered, err := ClaimAPIIdempotency(7, "real_person_create", "key-hash", "hash-a", APIIdempotencyResourceTypeVerificationSession, 500, 400, 1000)
	require.NoError(t, err)
	require.Equal(t, APIIdempotencyDecisionOutcomeUnknown, recovered.Decision)

	var calls int64
	if recovered.Decision == APIIdempotencyDecisionOwner {
		atomic.AddInt64(&calls, 1)
	}
	require.Zero(t, calls)
}

func TestCompletedIdempotencyReplaysSanitizedResponse(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	claim, err := ClaimAPIIdempotency(7, "real_person_create", "key-hash", "hash-a", APIIdempotencyResourceTypeVerificationSession, 100, 50, 1000)
	require.NoError(t, err)
	require.NoError(t, CompleteAPIIdempotency(claim.Record.Id, claim.Record.LeaseUpdatedTime, "rvs_public", http.StatusOK, `{"id":"rph_public","status":"pending_verification"}`, 101))

	replay, err := ClaimAPIIdempotency(7, "real_person_create", "key-hash", "hash-a", APIIdempotencyResourceTypeVerificationSession, 102, 50, 1000)
	require.NoError(t, err)
	require.Equal(t, APIIdempotencyDecisionReplay, replay.Decision)
	require.NotContains(t, replay.Record.ResponsePayload, "verification_url")
}

func TestStaleProcessingWithBoundResourceResumesOriginalResource(t *testing.T) {
	db := newBytePlusRealPersonTestDB(t)
	claim, err := ClaimAPIIdempotency(7, "real_person_create", "key-hash", "hash-a", APIIdempotencyResourceTypeVerificationSession, 100, 50, 1000)
	require.NoError(t, err)

	profile := BytePlusRealPersonProfile{
		PublicId: "rph_original", UserId: 7, Name: "Person A", ChannelId: 101,
		Status: BytePlusRealPersonProfileStatusPendingVerification, CreatedTime: 100, UpdatedTime: 100,
	}
	session := BytePlusVisualValidationSession{
		PublicId: "rvs_original", CallbackTokenHash: strings.Repeat("a", 64),
		Status: BytePlusVisualValidationSessionStatusCreating, ExpiresAt: 1900,
		LeaseUpdatedTime: 100, CreatedTime: 100, UpdatedTime: 100,
	}
	require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&profile).Error; err != nil {
			return err
		}
		session.ProfileId = profile.Id
		if err := tx.Create(&session).Error; err != nil {
			return err
		}
		if err := tx.Model(&profile).Update("current_validation_session_id", session.Id).Error; err != nil {
			return err
		}
		return BindAPIIdempotencyResourceTx(tx, claim.Record.Id, claim.Record.LeaseUpdatedTime, session.PublicId, 101)
	}))

	recovered, err := ClaimAPIIdempotency(7, "real_person_create", "key-hash", "hash-a", APIIdempotencyResourceTypeVerificationSession, 500, 400, 1000)
	require.NoError(t, err)
	require.Equal(t, APIIdempotencyDecisionResume, recovered.Decision)
	require.Equal(t, "rvs_original", recovered.Record.ResourcePublicId)

	var profileCount, sessionCount int64
	require.NoError(t, db.Model(&BytePlusRealPersonProfile{}).Where("public_id = ?", "rph_original").Count(&profileCount).Error)
	require.NoError(t, db.Model(&BytePlusVisualValidationSession{}).Where("public_id = ?", "rvs_original").Count(&sessionCount).Error)
	require.Equal(t, int64(1), profileCount)
	require.Equal(t, int64(1), sessionCount)
}

func TestExpiredSafeIdempotencyRecordsArePurgedButUnsafeStatesRemain(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	for index, status := range []string{
		APIIdempotencyStatusCompleted,
		APIIdempotencyStatusFailed,
		APIIdempotencyStatusOutcomeUnknown,
		APIIdempotencyStatusCallingUpstream,
		APIIdempotencyStatusProcessing,
	} {
		record := APIIdempotencyRecord{
			UserId: 7, Route: "retention", KeyHash: fmt.Sprintf("key-%d", index), RequestHash: fmt.Sprintf("request-%d", index),
			Status: status, ResourceType: APIIdempotencyResourceTypeAsset, ResourcePublicId: fmt.Sprintf("ast_%d", index),
			LeaseUpdatedTime: 100, ExpiresAt: 200, CreatedTime: 100, UpdatedTime: 100,
		}
		require.NoError(t, DB.Create(&record).Error)
	}

	deleted, err := DeleteExpiredSafeAPIIdempotencyRecords(201, 10)
	require.NoError(t, err)
	require.Equal(t, 2, deleted)

	var remaining []APIIdempotencyRecord
	require.NoError(t, DB.Order("id ASC").Find(&remaining).Error)
	require.Equal(t, []string{
		APIIdempotencyStatusOutcomeUnknown,
		APIIdempotencyStatusCallingUpstream,
		APIIdempotencyStatusProcessing,
	}, []string{remaining[0].Status, remaining[1].Status, remaining[2].Status})
}
```

- [ ] **Step 2: 运行幂等测试并确认 RED**

Run: `go test ./model ./service -run 'APIIdempotency|IdempotencyHash' -count=1`

Expected: FAIL，错误指向领取决策、CAS 方法和哈希函数尚未定义。

- [ ] **Step 3: 添加账本决策与数据库 CAS**

`model/api_idempotency.go` 增加以下公开决策；实现必须用 `INSERT ... ON CONFLICT DO NOTHING` 和 `UPDATE ... WHERE status/lease_updated_time` 的 `RowsAffected` 判定所有权：

```go
type APIIdempotencyDecision string

const (
	APIIdempotencyResourceTypeVerificationSession = "verification_session"
	APIIdempotencyResourceTypeAsset               = "asset"

	APIIdempotencyDecisionOwner          APIIdempotencyDecision = "owner"
	APIIdempotencyDecisionInProgress     APIIdempotencyDecision = "in_progress"
	APIIdempotencyDecisionResume         APIIdempotencyDecision = "resume"
	APIIdempotencyDecisionReplay         APIIdempotencyDecision = "replay"
	APIIdempotencyDecisionConflict       APIIdempotencyDecision = "conflict"
	APIIdempotencyDecisionOutcomeUnknown APIIdempotencyDecision = "outcome_unknown"
)

type APIIdempotencyClaim struct {
	Record   *APIIdempotencyRecord
	Decision APIIdempotencyDecision
}

func ClaimAPIIdempotency(userID int, route, keyHash, requestHash, resourceType string, now, staleBefore, expiresAt int64) (*APIIdempotencyClaim, error) {
	record := &APIIdempotencyRecord{
		UserId: userID, Route: route, KeyHash: keyHash, RequestHash: requestHash,
		Status: APIIdempotencyStatusReceiving, ResourceType: resourceType,
		LeaseUpdatedTime: now, ExpiresAt: expiresAt, CreatedTime: now, UpdatedTime: now,
	}
	insert := DB.Clauses(clause.OnConflict{DoNothing: true}).Create(record)
	if insert.Error != nil {
		return nil, insert.Error
	}
	if insert.RowsAffected == 1 {
		if err := DB.Model(&APIIdempotencyRecord{}).
			Where("id = ? AND status = ? AND lease_updated_time = ?", record.Id, APIIdempotencyStatusReceiving, now).
			Updates(map[string]any{"status": APIIdempotencyStatusProcessing, "updated_time": now}).Error; err != nil {
			return nil, err
		}
		record.Status = APIIdempotencyStatusProcessing
		return &APIIdempotencyClaim{Record: record, Decision: APIIdempotencyDecisionOwner}, nil
	}

	var stored APIIdempotencyRecord
	if err := DB.Where("user_id = ? AND route = ? AND key_hash = ?", userID, route, keyHash).First(&stored).Error; err != nil {
		return nil, err
	}
	if stored.RequestHash != requestHash {
		return &APIIdempotencyClaim{Record: &stored, Decision: APIIdempotencyDecisionConflict}, nil
	}
	switch stored.Status {
	case APIIdempotencyStatusCompleted, APIIdempotencyStatusFailed:
		return &APIIdempotencyClaim{Record: &stored, Decision: APIIdempotencyDecisionReplay}, nil
	case APIIdempotencyStatusOutcomeUnknown:
		return &APIIdempotencyClaim{Record: &stored, Decision: APIIdempotencyDecisionOutcomeUnknown}, nil
	case APIIdempotencyStatusCallingUpstream:
		if stored.LeaseUpdatedTime < staleBefore {
			result := DB.Model(&APIIdempotencyRecord{}).
				Where("id = ? AND status = ? AND lease_updated_time = ?", stored.Id, APIIdempotencyStatusCallingUpstream, stored.LeaseUpdatedTime).
				Updates(map[string]any{"status": APIIdempotencyStatusOutcomeUnknown, "updated_time": now})
			if result.Error != nil {
				return nil, result.Error
			}
			if result.RowsAffected == 1 {
				stored.Status = APIIdempotencyStatusOutcomeUnknown
				return &APIIdempotencyClaim{Record: &stored, Decision: APIIdempotencyDecisionOutcomeUnknown}, nil
			}
		}
		return &APIIdempotencyClaim{Record: &stored, Decision: APIIdempotencyDecisionInProgress}, nil
	case APIIdempotencyStatusReceiving, APIIdempotencyStatusProcessing:
		if stored.LeaseUpdatedTime >= staleBefore {
			return &APIIdempotencyClaim{Record: &stored, Decision: APIIdempotencyDecisionInProgress}, nil
		}
		result := DB.Model(&APIIdempotencyRecord{}).
			Where("id = ? AND status IN ? AND lease_updated_time = ?", stored.Id, []string{APIIdempotencyStatusReceiving, APIIdempotencyStatusProcessing}, stored.LeaseUpdatedTime).
			Updates(map[string]any{"status": APIIdempotencyStatusProcessing, "lease_updated_time": now, "updated_time": now})
		if result.Error != nil {
			return nil, result.Error
		}
		if result.RowsAffected == 1 {
			stored.Status = APIIdempotencyStatusProcessing
			stored.LeaseUpdatedTime = now
			decision := APIIdempotencyDecisionOwner
			if strings.TrimSpace(stored.ResourcePublicId) != "" {
				decision = APIIdempotencyDecisionResume
			}
			return &APIIdempotencyClaim{Record: &stored, Decision: decision}, nil
		}
		return &APIIdempotencyClaim{Record: &stored, Decision: APIIdempotencyDecisionInProgress}, nil
	default:
		return nil, fmt.Errorf("unknown idempotency status %q", stored.Status)
	}
}
```

再添加以下严格 CAS 方法并分别测试错误 `RowsAffected`：

```go
func BindAPIIdempotencyResourceTx(tx *gorm.DB, recordID int64, leaseUpdatedTime int64, publicID string, now int64) error
func MarkAPIIdempotencyCallingUpstream(recordID int64, leaseUpdatedTime int64, now int64) error
func CompleteAPIIdempotency(recordID int64, leaseUpdatedTime int64, publicID string, responseStatus int, responsePayload string, now int64) error
func FailAPIIdempotency(recordID int64, leaseUpdatedTime int64, publicID string, responseStatus int, responsePayload string, now int64) error
func MarkStaleAPIIdempotencyOutcomeUnknown(staleBefore int64, now int64, limit int) ([]APIIdempotencyRecord, error)
func DeleteExpiredSafeAPIIdempotencyRecords(now int64, limit int) (int, error)
```

`BindAPIIdempotencyResourceTx` 只接受调用方已经开启的事务，并以 `id + Processing + lease_updated_time + resource_public_id=''` 为条件写入；禁止提供可在事务外调用的资源绑定函数。创建档案与重新认证都使用 `resource_type=verification_session` 并始终绑定精确的 `session.PublicId`，再通过 `session.ProfileId` 找档案；不得让同一 resource type 有时指向 profile、有时指向 session。档案创建必须在同一事务中完成 `profile + session + current_session + ledger resource`，URL 素材必须完成 `asset + ledger resource`，multipart 必须完成 `asset + temp-object asset_id + ledger resource`。任一步失败都回滚整组本地资源。

`MarkAPIIdempotencyCallingUpstream` 必须只从 `Processing` 转换并同时写 `upstream_call_started_at`；`Complete`/`Fail` 只接受当前 lease，且资源已绑定时只能保留同一个 `resource_public_id`；恢复函数逐行 CAS 把陈旧 `CallingUpstream` 改为 `OutcomeUnknown`，返回本节点实际更新成功的记录，绝不能改回 `Processing`。协调器使用这些赢家记录把已绑定的精确认证 session（并仅在仍为 current 时推进其 profile）或素材推进到稳定失败态，但不得再产生任何上游调用。陈旧 `Processing` 在 `resource_public_id` 非空时返回 `Resume`，调用方按 `resource_type + resource_public_id` 加载原资源继续，绝不能再创建第二个本地档案、session 或素材；只有资源为空时才返回 `Owner`。

`expires_at` 是安全重放保留期，不是所有状态的无条件删除时间。`DeleteExpiredSafeAPIIdempotencyRecords` 先 `SELECT id ORDER BY id LIMIT ?`，再以 `id IN ? AND status IN (Completed, Failed) AND expires_at > 0 AND expires_at <= now` 二次限定删除；不得使用方言专属 `DELETE ... LIMIT`。只有有确定、脱敏响应的 `Completed/Failed` 可在默认 24 小时后删除并允许调用方复用 key；`Receiving/Processing/CallingUpstream/OutcomeUnknown` 永不由 retention 清理，其中陈旧 `CallingUpstream` 必须先转 `OutcomeUnknown`，保证结果不明的 key 不会因过期再次触发上游。

- [ ] **Step 4: 添加键哈希、规范请求哈希和稳定决策映射**

`service/api_idempotency.go`：

```go
const (
	apiIdempotencyRetention = 24 * time.Hour
	apiIdempotencyLease     = 5 * time.Minute
)

func hashAPIIdempotencyKey(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" || len(trimmed) > 255 {
		return "", errors.New("idempotency key is required")
	}
	sum := sha256.Sum256([]byte(trimmed))
	return hex.EncodeToString(sum[:]), nil
}

func hashCanonicalRequest(value any) (string, error) {
	raw, err := common.Marshal(value)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:]), nil
}

func hashMultipartAssetRequest(personID, assetType, name, fileSHA256 string, size int64) (string, error) {
	return hashCanonicalRequest(struct {
		PersonID  string `json:"person_id"`
		AssetType string `json:"asset_type"`
		Name      string `json:"name"`
		FileSHA   string `json:"file_sha256"`
		Size      int64  `json:"size"`
	}{personID, strings.TrimSpace(assetType), strings.TrimSpace(name), fileSHA256, size})
}
```

服务层的 `claimIdempotentOperation` 将 `Conflict` 映射为 409 `idempotency_conflict`，`InProgress` 映射为 409 `verification_in_progress` 或创建素材的稳定处理中错误，`OutcomeUnknown` 映射为 502 `idempotency_outcome_unknown`；`Replay` 只反序列化服务自己保存的公开 DTO；`Resume` 必须由具体资源服务加载账本已绑定的公开 ID 并继续原资源，不能走新建分支。

- [ ] **Step 5: 运行并发与状态机测试并确认 GREEN**

Run: `gofmt -w model/api_idempotency.go model/api_idempotency_test.go service/api_idempotency.go service/api_idempotency_test.go`

Run: `go test ./model ./service -run 'APIIdempotency|IdempotencyHash' -race -count=1`

Expected: PASS；竞争测试每轮恰好一个 owner，陈旧 `CallingUpstream` 永远不会返回 owner。

- [ ] **Step 6: 提交幂等基础**

```bash
git add model/api_idempotency.go model/api_idempotency_test.go service/api_idempotency.go service/api_idempotency_test.go
git commit -m "Prevent duplicate BytePlus side effects across API nodes" -m "Constraint: BytePlus does not accept Flatkey idempotency keys or provide lookup by them" -m "Rejected: Retrying stale CallingUpstream records | a successful upstream call may have outlived the local process" -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: Only Processing leases are recoverable; CallingUpstream must finish from evidence or become OutcomeUnknown" -m "Tested: Concurrent ownership, request conflicts, replay, stale lease takeover, and outcome-unknown transitions under race detection"
```

### Task 3: 增加真人渠道能力、稳定错误码和 AES-GCM 密文

**Files:**
- Modify: `service/byteplus_credentials.go`
- Modify: `service/byteplus_credentials_test.go`
- Create: `service/byteplus_sensitive_cipher.go`
- Create: `service/byteplus_sensitive_cipher_test.go`
- Modify: `types/error.go`
- Modify: `types/byteplus_asset_error_test.go`

- [ ] **Step 1: 写出凭据兼容、能力关闭和密文边界失败测试**

```go
func TestBytePlusCredentialsRealPersonAssetsAreExplicitlyEnabled(t *testing.T) {
	creds, err := ParseBytePlusCredentials(`{
		"api_key":"video-key",
		"access_key_id":"ak",
		"secret_access_key":"sk",
		"project_name":"default",
		"real_person_assets":{
			"enabled":true,
			"tos_bucket":"private-assets",
			"tos_region":"ap-southeast-1",
			"tos_internal_endpoint":"https://tos-ap-southeast-1.ivolces.com"
		}
	}`)
	require.NoError(t, err)
	require.NoError(t, creds.ValidateRealPersonAssets())

	creds.RealPersonAssets.Enabled = false
	require.Error(t, creds.ValidateRealPersonAssets())
}

func TestBytePlusCredentialsLegacyAndVirtualAssetValidationRemainCompatible(t *testing.T) {
	legacy, err := ParseBytePlusCredentials("video-only-key")
	require.NoError(t, err)
	require.NoError(t, legacy.ValidateVideo())
	require.Error(t, legacy.ValidateRealPersonAssets())
}

func TestBytePlusSensitiveCipherBindsSessionAndFieldInAAD(t *testing.T) {
	key := bytes.Repeat([]byte{0x42}, 32)
	cipher, err := newBytePlusSensitiveCipher(key, rand.Reader)
	require.NoError(t, err)

	envelope, err := cipher.Encrypt("session-a", "byted_token", "secret-token")
	require.NoError(t, err)
	plaintext, err := cipher.Decrypt("session-a", "byted_token", envelope)
	require.NoError(t, err)
	require.Equal(t, "secret-token", plaintext)

	_, err = cipher.Decrypt("session-b", "byted_token", envelope)
	require.Error(t, err)
	_, err = cipher.Decrypt("session-a", "h5_link", envelope)
	require.Error(t, err)

	callbackEnvelope, err := cipher.Encrypt("session-a", "callback_token", "callback-secret")
	require.NoError(t, err)
	callbackToken, err := cipher.Decrypt("session-a", "callback_token", callbackEnvelope)
	require.NoError(t, err)
	require.Equal(t, "callback-secret", callbackToken)
}

func TestBytePlusSensitiveCipherRejectsInvalidConfigurationAndTampering(t *testing.T) {
	_, err := newBytePlusSensitiveCipher([]byte("short"), rand.Reader)
	require.Error(t, err)

	cipher, err := newBytePlusSensitiveCipher(bytes.Repeat([]byte{0x24}, 32), rand.Reader)
	require.NoError(t, err)
	envelope, err := cipher.Encrypt("session-a", "h5_link", "https://example.com")
	require.NoError(t, err)
	tampered := envelope[:len(envelope)-1] + "A"
	_, err = cipher.Decrypt("session-a", "h5_link", tampered)
	require.Error(t, err)
}
```

- [ ] **Step 2: 运行凭据和密文测试并确认 RED**

Run: `go test ./service ./types -run 'BytePlusCredentials|BytePlusSensitiveCipher|RealPersonErrorCodes' -count=1`

Expected: FAIL，缺少真人能力配置、密文适配器和稳定错误码。

- [ ] **Step 3: 扩展渠道 JSON，但不改变现有 legacy/虚拟凭据语义**

```go
type BytePlusRealPersonAssetsConfig struct {
	Enabled             bool   `json:"enabled"`
	TOSBucket           string `json:"tos_bucket"`
	TOSRegion           string `json:"tos_region"`
	TOSInternalEndpoint string `json:"tos_internal_endpoint"`
}

type BytePlusCredentials struct {
	APIKey            string                         `json:"api_key"`
	AccessKeyID       string                         `json:"access_key_id"`
	SecretAccessKey   string                         `json:"secret_access_key"`
	ProjectName       string                         `json:"project_name"`
	RealPersonAssets  BytePlusRealPersonAssetsConfig `json:"real_person_assets"`
}

func (c BytePlusCredentials) ValidateRealPersonAssets() error {
	if err := c.ValidateAssets(); err != nil {
		return err
	}
	if !c.RealPersonAssets.Enabled {
		return errors.New("byteplus real-person assets are disabled")
	}
	if strings.TrimSpace(c.RealPersonAssets.TOSBucket) == "" {
		return errors.New("byteplus real-person TOS bucket is required")
	}
	if strings.TrimSpace(c.RealPersonAssets.TOSRegion) != bytePlusAssetRegion {
		return errors.New("byteplus real-person TOS region must match ModelArk")
	}
	endpoint, err := url.Parse(strings.TrimSpace(c.RealPersonAssets.TOSInternalEndpoint))
	if err != nil || endpoint.Scheme != "https" || endpoint.Host == "" || endpoint.User != nil || endpoint.RawQuery != "" || endpoint.Fragment != "" {
		return errors.New("invalid byteplus real-person TOS endpoint")
	}
	if endpoint.Path != "" && endpoint.Path != "/" {
		return errors.New("invalid byteplus real-person TOS endpoint")
	}
	return nil
}
```

`ParseBytePlusCredentials` 对五个真人配置字符串执行 `TrimSpace`；非 JSON legacy key 仍只填 `APIKey`，不会意外启用真人能力。

- [ ] **Step 4: 实现版本化 AES-256-GCM envelope**

`service/byteplus_sensitive_cipher.go`：

```go
const bytePlusSensitiveCipherEnv = "BYTEPLUS_REAL_PERSON_CIPHER_KEY"

type BytePlusSensitiveCipher interface {
	Encrypt(sessionID, field, plaintext string) (string, error)
	Decrypt(sessionID, field, envelope string) (string, error)
}

type bytePlusSensitiveCipher struct {
	aead      cipher.AEAD
	rand      io.Reader
}

func newBytePlusSensitiveCipher(key []byte, random io.Reader) (*bytePlusSensitiveCipher, error) {
	if len(key) != 32 {
		return nil, errors.New("byteplus real-person cipher key must be 32 bytes")
	}
	if random == nil {
		return nil, errors.New("byteplus real-person cipher random source is required")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &bytePlusSensitiveCipher{aead: aead, rand: random}, nil
}

func loadBytePlusSensitiveCipherFromEnv() (BytePlusSensitiveCipher, error) {
	raw := strings.TrimSpace(os.Getenv(bytePlusSensitiveCipherEnv))
	key, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		return nil, errors.New("invalid byteplus real-person cipher key")
	}
	return newBytePlusSensitiveCipher(key, rand.Reader)
}

func bytePlusSensitiveAAD(sessionID, field string) []byte {
	return []byte("byteplus-real-person:v1:" + sessionID + ":" + field)
}

func (c *bytePlusSensitiveCipher) Encrypt(sessionID, field, plaintext string) (string, error) {
	if sessionID == "" || field == "" || plaintext == "" {
		return "", errors.New("byteplus sensitive value is incomplete")
	}
	nonce := make([]byte, c.aead.NonceSize())
	if _, err := io.ReadFull(c.rand, nonce); err != nil {
		return "", err
	}
	sealed := c.aead.Seal(nil, nonce, []byte(plaintext), bytePlusSensitiveAAD(sessionID, field))
	payload := append(nonce, sealed...)
	return "v1:" + base64.RawURLEncoding.EncodeToString(payload), nil
}

func (c *bytePlusSensitiveCipher) Decrypt(sessionID, field, envelope string) (string, error) {
	if !strings.HasPrefix(envelope, "v1:") {
		return "", errors.New("unsupported byteplus sensitive envelope")
	}
	payload, err := base64.RawURLEncoding.DecodeString(strings.TrimPrefix(envelope, "v1:"))
	if err != nil || len(payload) <= c.aead.NonceSize() {
		return "", errors.New("invalid byteplus sensitive envelope")
	}
	nonce, ciphertext := payload[:c.aead.NonceSize()], payload[c.aead.NonceSize():]
	plaintext, err := c.aead.Open(nil, nonce, ciphertext, bytePlusSensitiveAAD(sessionID, field))
	if err != nil {
		return "", errors.New("invalid byteplus sensitive envelope")
	}
	return string(plaintext), nil
}
```

- [ ] **Step 5: 添加所有稳定公开错误码**

在 `types/error.go` 的 asset error 区块加入：

```go
ErrorCodeInvalidRealPersonRequest      ErrorCode = "invalid_real_person_request"
ErrorCodeRealPersonNotFound            ErrorCode = "real_person_not_found"
ErrorCodeRealPersonNotActive           ErrorCode = "real_person_not_active"
ErrorCodeVerificationInProgress        ErrorCode = "verification_in_progress"
ErrorCodeIdempotencyConflict           ErrorCode = "idempotency_conflict"
ErrorCodeIdempotencyOutcomeUnknown     ErrorCode = "idempotency_outcome_unknown"
ErrorCodeAssetProfileConflict          ErrorCode = "asset_profile_conflict"
ErrorCodeAssetFileTooLarge             ErrorCode = "asset_file_too_large"
ErrorCodeAssetMediaUnsupported         ErrorCode = "asset_media_unsupported"
ErrorCodeAssetUploadFailed             ErrorCode = "asset_upload_failed"
ErrorCodeVerificationUpstreamError     ErrorCode = "verification_upstream_error"
ErrorCodeRealPersonChannelUnavailable  ErrorCode = "real_person_channel_unavailable"
ErrorCodeRealPersonStorageError        ErrorCode = "real_person_storage_error"
```

扩展 `types/byteplus_asset_error_test.go`，逐项断言常量字符串等于上面公开值；不要把原始上游错误消息加入任何公开映射。

- [ ] **Step 6: 运行测试并确认 GREEN**

Run: `gofmt -w service/byteplus_credentials.go service/byteplus_credentials_test.go service/byteplus_sensitive_cipher.go service/byteplus_sensitive_cipher_test.go types/error.go types/byteplus_asset_error_test.go`

Run: `go test ./service ./types -run 'BytePlusCredentials|BytePlusSensitiveCipher|RealPersonErrorCodes' -count=1`

Expected: PASS；legacy key 仍可用于视频，只有显式 enabled 且完整的 JSON 凭据可用于真人素材。

- [ ] **Step 7: 提交安全与能力边界**

```bash
git add service/byteplus_credentials.go service/byteplus_credentials_test.go service/byteplus_sensitive_cipher.go service/byteplus_sensitive_cipher_test.go types/error.go types/byteplus_asset_error_test.go
git commit -m "Keep real-person credentials and verification material out of public surfaces" -m "Constraint: Existing legacy and virtual BytePlus credentials must remain compatible" -m "Rejected: Plaintext BytedToken and H5Link storage | database or log access would expose one-time verification authority" -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: Cipher AAD must continue binding both session identity and field purpose" -m "Tested: Credential compatibility, explicit capability validation, encryption round-trip, AAD isolation, tamper rejection, and stable error codes"
```

### Task 4: 扩展 BytePlus signed client 的真人认证、列表和删除契约

**Files:**
- Modify: `service/byteplus_asset_client.go`
- Modify: `service/byteplus_asset_client_test.go`
- Create: `service/byteplus_real_person_client.go`
- Create: `service/byteplus_real_person_client_test.go`

- [ ] **Step 1: 写出官方 Action、字段、签名和脱敏失败测试**

```go
func TestBytePlusClientCreateVisualValidateSessionSendsOfficialPayload(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "CreateVisualValidateSession", r.URL.Query().Get("Action"))
		require.Equal(t, bytePlusAssetAPIVersion, r.URL.Query().Get("Version"))
		require.NotEmpty(t, r.Header.Get("Authorization"))
		var body map[string]any
		require.NoError(t, common.DecodeJson(r.Body, &body))
		require.Equal(t, "https://api.flatkey.example/v1/real-person-verifications/callback/token", body["CallbackURL"])
		require.Equal(t, "default", body["ProjectName"])
		_, _ = io.WriteString(w, `{"ResponseMetadata":{"RequestId":"req-1"},"Result":{"BytedToken":"token","H5Link":"https://h5.byteplus.example/session","CallbackURL":"https://api.flatkey.example/v1/real-person-verifications/callback/token"}}`)
	}))
	defer server.Close()

	client := NewBytePlusAssetClient(server.Client(), server.URL)
	result, err := client.CreateVisualValidateSession(context.Background(), testAssetCreds(), "https://api.flatkey.example/v1/real-person-verifications/callback/token")
	require.NoError(t, err)
	require.Equal(t, "token", result.BytedToken)
	require.Equal(t, "req-1", result.RequestID)
}

func TestBytePlusClientGetVisualValidateResultRequiresGroupID(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "GetVisualValidateResult", r.URL.Query().Get("Action"))
		var body map[string]any
		require.NoError(t, common.DecodeJson(r.Body, &body))
		require.Equal(t, "token-1", body["BytedToken"])
		require.Equal(t, "project3", body["ProjectName"])
		_, _ = io.WriteString(w, `{"ResponseMetadata":{"RequestId":"req-result"},"Result":{"GroupId":"group-face-1"}}`)
	}))
	defer server.Close()

	client := NewBytePlusAssetClient(server.Client(), server.URL)
	got, err := client.GetVisualValidateResult(context.Background(), testAssetCreds(), " token-1 ")
	require.NoError(t, err)
	require.Equal(t, "group-face-1", got.GroupID)
	require.Equal(t, "req-result", got.RequestID)
}

func TestBytePlusClientGetVisualValidateResultRejectsEmptyGroupID(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, `{"ResponseMetadata":{"RequestId":"req-empty"},"Result":{"GroupId":"  "}}`)
	}))
	defer server.Close()
	client := NewBytePlusAssetClient(server.Client(), server.URL)
	_, err := client.GetVisualValidateResult(context.Background(), testAssetCreds(), "token-1")
	require.Error(t, err)
	require.NotContains(t, err.Error(), "token-1")
}

func TestBytePlusClientListAssetsUsesLivenessFaceFilterAndPagination(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "ListAssets", r.URL.Query().Get("Action"))
		var body struct {
			Filter struct {
				GroupIDs  []string `json:"GroupIds"`
				GroupType string   `json:"GroupType"`
				Statuses  []string `json:"Statuses"`
				Name      string   `json:"Name"`
			} `json:"Filter"`
			PageNumber int    `json:"PageNumber"`
			PageSize   int    `json:"PageSize"`
			SortBy     string `json:"SortBy"`
			SortOrder  string `json:"SortOrder"`
			Project    string `json:"ProjectName"`
		}
		require.NoError(t, common.DecodeJson(r.Body, &body))
		require.Equal(t, []string{"group-a"}, body.Filter.GroupIDs)
		require.Equal(t, "LivenessFace", body.Filter.GroupType)
		require.Equal(t, []string{"Active"}, body.Filter.Statuses)
		require.Equal(t, "front", body.Filter.Name)
		require.Equal(t, 3, body.PageNumber)
		require.Equal(t, 20, body.PageSize)
		require.Equal(t, "CreateTime", body.SortBy)
		require.Equal(t, "Desc", body.SortOrder)
		require.Equal(t, "project3", body.Project)
		_, _ = io.WriteString(w, `{"ResponseMetadata":{"RequestId":"req-list"},"Result":{"Items":[{"Id":"asset-1","Name":"front","GroupId":"group-a","AssetType":"Image","Status":"Active"}],"TotalCount":41}}`)
	}))
	defer server.Close()

	client := NewBytePlusAssetClient(server.Client(), server.URL)
	got, err := client.ListAssets(context.Background(), testAssetCreds(), BytePlusListAssetsRequest{
		GroupIDs: []string{"group-a"}, Statuses: []string{"Active"}, Name: "front",
		PageNumber: 3, PageSize: 20, SortBy: "CreateTime", SortOrder: "Desc",
	})
	require.NoError(t, err)
	require.Equal(t, "req-list", got.RequestID)
	require.Equal(t, 41, got.TotalCount)
	require.Len(t, got.Items, 1)
	require.Equal(t, "asset-1", got.Items[0].ID)
}

func TestBytePlusClientDeleteAssetClassifiesOnlyHTTP404AsConfirmedNotFound(t *testing.T) {
	tests := []struct {
		name         string
		status       int
		body         string
		wantSuccess  bool
		wantNotFound bool
	}{
		{name: "empty_result_success", status: http.StatusOK, body: `{"ResponseMetadata":{"RequestId":"req-del"},"Result":{}}`, wantSuccess: true},
		{name: "http_404", status: http.StatusNotFound, body: `{"ResponseMetadata":{"RequestId":"req-404","Error":{"Code":"UnknownCode","Message":"gone"}}}`, wantNotFound: true},
		{name: "unverified_metadata_code", status: http.StatusOK, body: `{"ResponseMetadata":{"RequestId":"req-meta","Error":{"Code":"ResourceNotFound","Message":"gone"}}}`},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				require.Equal(t, "DeleteAsset", r.URL.Query().Get("Action"))
				var body map[string]any
				require.NoError(t, common.DecodeJson(r.Body, &body))
				require.Equal(t, "asset-upstream", body["Id"])
				w.WriteHeader(test.status)
				_, _ = io.WriteString(w, test.body)
			}))
			defer server.Close()

			client := NewBytePlusAssetClient(server.Client(), server.URL)
			requestID, err := client.DeleteAsset(context.Background(), testAssetCreds(), " asset-upstream ")
			if test.wantSuccess {
				require.NoError(t, err)
				require.Equal(t, "req-del", requestID)
				return
			}
			require.Error(t, err)
			require.Equal(t, test.wantNotFound, isBytePlusNotFound(err))
			require.NotContains(t, err.Error(), "gone")
		})
	}
}

func TestBytePlusClientTransportTimeoutIsNotDefinitive(t *testing.T) {
	release := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { <-release }))
	defer server.Close()
	client := NewBytePlusAssetClient(server.Client(), server.URL)
	client.requestTimeout = 25 * time.Millisecond
	_, err := client.DeleteAsset(context.Background(), testAssetCreds(), "asset-upstream")
	close(release)
	require.Error(t, err)
	require.False(t, isBytePlusDefinitiveResponse(err))
}

func TestBytePlusClientErrorsNeverExposeUpstreamMessageOrCredential(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
		_, _ = io.WriteString(w, `{"ResponseMetadata":{"RequestId":"req-secret","Error":{"Code":"Bad","Message":"sk-example token-1 https://h5.byteplus.example/session"}}}`)
	}))
	defer server.Close()

	client := NewBytePlusAssetClient(server.Client(), server.URL)
	_, err := client.GetVisualValidateResult(context.Background(), testAssetCreds(), "token-1")
	require.Error(t, err)
	require.Contains(t, err.Error(), "req-secret")
	for _, leaked := range []string{"sk-example", "token-1", "h5.byteplus.example", "Bad"} {
		require.NotContains(t, err.Error(), leaked)
	}
}
```

`ListAssets` 测试必须断言 `Filter.GroupIds`、`Filter.GroupType=LivenessFace`、`PageNumber`、`PageSize` 和 `ProjectName`；`DeleteAsset` 测试覆盖 2xx、HTTP 404、metadata error 和 transport timeout。

- [ ] **Step 2: 运行 client 测试并确认 RED**

Run: `go test ./service -run 'BytePlusClient(CreateVisual|GetVisual|ListAssets|DeleteAsset)|BytePlusAssetClient' -count=1`

Expected: FAIL，缺少新 action 方法，且现有 `do` 只能接收 `bytePlusAssetResponse`。

- [ ] **Step 3: 把底层 envelope 解码改为通用输出且保持旧测试通过**

在 `service/byteplus_asset_client.go` 将 `do` 的最后一个参数改为 `out any`，先单独解码 metadata 做错误判定，再把同一原始 body 解码到目标 envelope：

```go
type BytePlusAPIError struct {
	StatusCode int
	RequestID  string
	Code       string
}

func (e *BytePlusAPIError) Error() string {
	if e.RequestID == "" {
		return "byteplus api request failed"
	}
	return "byteplus api request failed (request_id=" + e.RequestID + ")"
}

func isBytePlusDefinitiveResponse(err error) bool {
	var apiErr *BytePlusAPIError
	return errors.As(err, &apiErr)
}

func isBytePlusNotFound(err error) bool {
	var apiErr *BytePlusAPIError
	return errors.As(err, &apiErr) && apiErr.StatusCode == http.StatusNotFound
}

func (c *BytePlusAssetClient) do(ctx context.Context, creds BytePlusCredentials, action string, payload any, out any) error {
	if ctx == nil {
		return errors.New("byteplus asset request context is required")
	}
	if c.requestTimeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, c.requestTimeout)
		defer cancel()
	}
	body, err := common.Marshal(payload)
	if err != nil {
		return err
	}
	endpoint, err := c.actionURL(action)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	signer := volcengineauth.Signer{AccessKeyID: creds.AccessKeyID, SecretAccessKey: creds.SecretAccessKey, Region: bytePlusAssetRegion, Service: bytePlusAssetService, Now: c.now}
	if err := signer.Sign(req, body); err != nil {
		return err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, bytePlusAssetResponseMaxBytes+1))
	if err != nil {
		return err
	}
	if len(raw) > bytePlusAssetResponseMaxBytes {
		return &BytePlusAPIError{StatusCode: resp.StatusCode}
	}
	var metadata struct {
		ResponseMetadata bytePlusResponseMetadata `json:"ResponseMetadata"`
	}
	if len(bytes.TrimSpace(raw)) > 0 {
		if err := common.Unmarshal(raw, &metadata); err != nil {
			return &BytePlusAPIError{StatusCode: resp.StatusCode}
		}
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 || metadata.ResponseMetadata.Error.Code != "" || metadata.ResponseMetadata.Error.Message != "" {
		return &BytePlusAPIError{StatusCode: resp.StatusCode, RequestID: metadata.ResponseMetadata.RequestID, Code: metadata.ResponseMetadata.Error.Code}
	}
	if out == nil || len(bytes.TrimSpace(raw)) == 0 {
		return nil
	}
	if err := common.Unmarshal(raw, out); err != nil {
		return &BytePlusAPIError{StatusCode: resp.StatusCode, RequestID: metadata.ResponseMetadata.RequestID}
	}
	return nil
}
```

保留所有现有 `CreateAssetGroup/CreateAsset/GetAsset` 行为和响应检查；新增类型不得把 metadata message 写入 `Error()`。

- [ ] **Step 4: 实现四个官方真人/素材 action**

`service/byteplus_real_person_client.go` 的公开业务类型和方法使用以下精确形状：

```go
type BytePlusVisualValidationSession struct {
	BytedToken  string
	H5Link      string
	CallbackURL string
	RequestID   string
}

type BytePlusVisualValidationResult struct {
	GroupID   string
	RequestID string
}

type BytePlusListAssetsRequest struct {
	GroupIDs  []string
	Statuses  []string
	Name      string
	PageNumber int
	PageSize   int
	SortBy     string
	SortOrder  string
}

type BytePlusListedAsset struct {
	ID          string
	Name        string
	GroupID     string
	AssetType   string
	Status      string
	Moderation  map[string]any
	ProjectName string
	CreateTime  int64
	UpdateTime  int64
}

type BytePlusListAssetsResult struct {
	Items      []BytePlusListedAsset
	TotalCount int
	RequestID  string
}

func (c *BytePlusAssetClient) CreateVisualValidateSession(ctx context.Context, creds BytePlusCredentials, callbackURL string) (BytePlusVisualValidationSession, error)
func (c *BytePlusAssetClient) GetVisualValidateResult(ctx context.Context, creds BytePlusCredentials, bytedToken string) (BytePlusVisualValidationResult, error)
func (c *BytePlusAssetClient) ListAssets(ctx context.Context, creds BytePlusCredentials, request BytePlusListAssetsRequest) (BytePlusListAssetsResult, error)
func (c *BytePlusAssetClient) DeleteAsset(ctx context.Context, creds BytePlusCredentials, upstreamAssetID string) (string, error)
```

方法 payload 固定为：

```go
createPayload := map[string]string{"CallbackURL": callbackURL, "ProjectName": creds.ProjectName}
resultPayload := map[string]string{"BytedToken": bytedToken, "ProjectName": creds.ProjectName}
listPayload := map[string]any{
	"Filter": map[string]any{
		"GroupIds": request.GroupIDs,
		"GroupType": "LivenessFace",
		"Statuses": request.Statuses,
		"Name": request.Name,
	},
	"PageNumber": request.PageNumber,
	"PageSize": request.PageSize,
	"SortBy": request.SortBy,
	"SortOrder": request.SortOrder,
	"ProjectName": creds.ProjectName,
}
deletePayload := map[string]string{"Id": upstreamAssetID, "ProjectName": creds.ProjectName}
```

分别调用 `CreateVisualValidateSession`、`GetVisualValidateResult`、`ListAssets`、`DeleteAsset` action。认证创建要求非空 `BytedToken/H5Link`；结果查询要求非空 `GroupId`；ListAssets 保留分页 envelope；DeleteAsset 允许空 `Result: {}`。

- [ ] **Step 5: 运行 client 新旧回归并确认 GREEN**

Run: `gofmt -w service/byteplus_asset_client.go service/byteplus_asset_client_test.go service/byteplus_real_person_client.go service/byteplus_real_person_client_test.go`

Run: `go test ./service -run 'BytePlusAssetClient|BytePlusClient(CreateVisual|GetVisual|ListAssets|DeleteAsset)' -count=1`

Expected: PASS；现有虚拟素材签名/超时/错误脱敏测试保持通过，新 action 字段与官方契约一致。

- [ ] **Step 6: 提交 signed client 扩展**

```bash
git add service/byteplus_asset_client.go service/byteplus_asset_client_test.go service/byteplus_real_person_client.go service/byteplus_real_person_client_test.go
git commit -m "Use the documented BytePlus contracts for real-person lifecycle calls" -m "Constraint: Signed requests share the existing 2024-01-01 ModelArk endpoint and project credentials" -m "Rejected: Returning raw upstream envelopes | they may contain credentials, provider identifiers, or unstable messages" -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: Keep DeleteAsset success compatible with an empty Result object" -m "Tested: Signed payloads, required response fields, pagination, delete-not-found handling, timeout classification, and legacy asset client regression"
```

### Task 5: 创建、重新认证、查询并列出真人档案

**Files:**
- Create: `dto/byteplus_real_person.go`
- Create: `service/byteplus_real_person.go`
- Create: `service/byteplus_real_person_test.go`
- Modify: `model/byteplus_real_person.go`
- Modify: `model/byteplus_real_person_test.go`

- [ ] **Step 1: 写出档案所有权、渠道固定、重放和结果不明测试**

```go
func TestCreateBytePlusRealPersonBindsOneCapableChannelAndReturnsOneTimeLink(t *testing.T) {
	fixture := newRealPersonServiceFixture(t)
	fixture.api.afterCreate = func() {
		var ledger model.APIIdempotencyRecord
		require.NoError(t, model.DB.Where("resource_type = ?", model.APIIdempotencyResourceTypeVerificationSession).First(&ledger).Error)
		require.Equal(t, model.APIIdempotencyStatusCallingUpstream, ledger.Status)
		require.Equal(t, "rvs_test_1", ledger.ResourcePublicId)

		var session model.BytePlusVisualValidationSession
		require.NoError(t, model.DB.Where("public_id = ?", ledger.ResourcePublicId).First(&session).Error)
		var profile model.BytePlusRealPersonProfile
		require.NoError(t, model.DB.First(&profile, session.ProfileId).Error)
		require.Equal(t, "rph_test_1", profile.PublicId)
		require.Equal(t, session.Id, *profile.CurrentValidationSessionId)
		require.NotEmpty(t, session.CallbackTokenCiphertext)
	}

	response, apiErr := fixture.create("idem-create", " Person A ")
	require.Nil(t, apiErr)
	require.Equal(t, "rph_test_1", response.ID)
	require.Equal(t, "Person A", response.Name)
	require.Equal(t, "pending_verification", response.Status)
	require.Equal(t, "https://h5.example/session-1", response.VerificationURL)
	require.Equal(t, 1, fixture.api.createCalls)
	require.Equal(t, "https://api.flatkey.example/v1/real-person-verifications/callback/callback-token-1", fixture.api.lastCallbackURL)

	var profile model.BytePlusRealPersonProfile
	require.NoError(t, model.DB.Where("public_id = ?", response.ID).First(&profile).Error)
	require.Equal(t, 7, profile.UserId)
	require.Equal(t, 101, profile.ChannelId)
	var session model.BytePlusVisualValidationSession
	require.NoError(t, model.DB.First(&session, *profile.CurrentValidationSessionId).Error)
	require.Empty(t, session.CallbackTokenCiphertext)
	require.NotContains(t, session.BytedTokenCiphertext, "byted-token-1")
	require.NotContains(t, session.H5LinkCiphertext, "h5.example")
}

func TestCreateBytePlusRealPersonSameKeySameHashReplaysWithoutSecondUpstreamCall(t *testing.T) {
	fixture := newRealPersonServiceFixture(t)
	first, apiErr := fixture.create("idem-create", "Person A")
	require.Nil(t, apiErr)
	second, apiErr := fixture.create("idem-create", "Person A")
	require.Nil(t, apiErr)
	require.Equal(t, first.ID, second.ID)
	require.Equal(t, first.VerificationURL, second.VerificationURL)
	require.Equal(t, first.VerificationExpiresAt, second.VerificationExpiresAt)
	require.Equal(t, 1, fixture.api.createCalls)
}

func TestCreateBytePlusRealPersonSameKeyDifferentNameConflicts(t *testing.T) {
	fixture := newRealPersonServiceFixture(t)
	_, apiErr := fixture.create("idem-create", "Person A")
	require.Nil(t, apiErr)
	_, apiErr = fixture.create("idem-create", "Person B")
	require.NotNil(t, apiErr)
	require.Equal(t, types.ErrorCodeIdempotencyConflict, apiErr.GetErrorCode())
	require.Equal(t, http.StatusConflict, apiErr.StatusCode)
	require.Equal(t, 1, fixture.api.createCalls)
}

func TestCreateBytePlusRealPersonValidatesTrimmedNameBeforeAnySideEffect(t *testing.T) {
	fixture := newRealPersonServiceFixture(t)
	for _, name := range []string{"   ", strings.Repeat("人", 65)} {
		_, apiErr := fixture.create("idem-invalid-name-"+strconv.Itoa(len(name)), name)
		require.NotNil(t, apiErr)
		require.Equal(t, types.ErrorCodeInvalidRealPersonRequest, apiErr.GetErrorCode())
		require.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
	}
	require.Zero(t, fixture.api.createCalls)
	var profiles, ledgers int64
	require.NoError(t, model.DB.Model(&model.BytePlusRealPersonProfile{}).Count(&profiles).Error)
	require.NoError(t, model.DB.Model(&model.APIIdempotencyRecord{}).Count(&ledgers).Error)
	require.Zero(t, profiles)
	require.Zero(t, ledgers)
}

func TestCreateBytePlusRealPersonTransportFailureBecomesOutcomeUnknown(t *testing.T) {
	fixture := newRealPersonServiceFixture(t)
	fixture.api.createErr = context.DeadlineExceeded
	_, apiErr := fixture.create("idem-create", "Person A")
	require.NotNil(t, apiErr)
	require.Equal(t, types.ErrorCodeIdempotencyOutcomeUnknown, apiErr.GetErrorCode())

	fixture.api.createErr = nil
	_, apiErr = fixture.create("idem-create", "Person A")
	require.NotNil(t, apiErr)
	require.Equal(t, types.ErrorCodeIdempotencyOutcomeUnknown, apiErr.GetErrorCode())
	require.Equal(t, 1, fixture.api.createCalls)

	var ledger model.APIIdempotencyRecord
	require.NoError(t, model.DB.Where("route = ?", "real_person_create").First(&ledger).Error)
	require.Equal(t, model.APIIdempotencyStatusOutcomeUnknown, ledger.Status)
}

func TestReplayAfterH5CiphertextCleanupOmitsVerificationURL(t *testing.T) {
	fixture := newRealPersonServiceFixture(t)
	first, apiErr := fixture.create("idem-create", "Person A")
	require.Nil(t, apiErr)
	var profile model.BytePlusRealPersonProfile
	require.NoError(t, model.DB.Where("public_id = ?", first.ID).First(&profile).Error)
	require.NoError(t, model.ClearBytePlusVisualValidationSecrets(*profile.CurrentValidationSessionId, fixture.now()+1))

	replay, apiErr := fixture.create("idem-create", "Person A")
	require.Nil(t, apiErr)
	require.Equal(t, first.ID, replay.ID)
	require.Empty(t, replay.VerificationURL)
	require.Zero(t, replay.VerificationExpiresAt)
	require.Equal(t, 1, fixture.api.createCalls)
}

func TestReverifyRejectsActiveProfileAndIgnoresLateOldSession(t *testing.T) {
	fixture := newRealPersonServiceFixture(t)
	created, apiErr := fixture.create("idem-create", "Person A")
	require.Nil(t, apiErr)
	var profile model.BytePlusRealPersonProfile
	require.NoError(t, model.DB.Where("public_id = ?", created.ID).First(&profile).Error)
	oldSessionID := *profile.CurrentValidationSessionId
	require.True(t, mustFailCurrentSession(t, profile.Id, oldSessionID, fixture.now()+1))

	reverified, apiErr := ReverifyBytePlusRealPerson(context.Background(), 7, created.ID, "idem-reverify")
	require.Nil(t, apiErr)
	require.NotEmpty(t, reverified.VerificationURL)
	require.NoError(t, model.DB.First(&profile, profile.Id).Error)
	newSessionID := *profile.CurrentValidationSessionId
	require.NotEqual(t, oldSessionID, newSessionID)

	updated, err := model.ActivateBytePlusRealPersonProfile(profile.Id, oldSessionID, "group-old", fixture.now()+2)
	require.NoError(t, err)
	require.False(t, updated)
	updated, err = model.ActivateBytePlusRealPersonProfile(profile.Id, newSessionID, "group-current", fixture.now()+3)
	require.NoError(t, err)
	require.True(t, updated)

	_, apiErr = ReverifyBytePlusRealPerson(context.Background(), 7, created.ID, "idem-active")
	require.NotNil(t, apiErr)
	require.Equal(t, types.ErrorCodeInvalidRealPersonRequest, apiErr.GetErrorCode())
}

func TestGetRealPersonUsesUserIDAndSynchronizesCurrentSessionOnly(t *testing.T) {
	fixture := newRealPersonServiceFixture(t)
	created, apiErr := fixture.create("idem-create", "Person A")
	require.Nil(t, apiErr)
	_, apiErr = GetBytePlusRealPerson(context.Background(), 8, created.ID)
	require.NotNil(t, apiErr)
	require.Equal(t, types.ErrorCodeRealPersonNotFound, apiErr.GetErrorCode())

	fixture.api.result = BytePlusVisualValidationResult{GroupID: "group-current", RequestID: "req-result"}
	got, apiErr := GetBytePlusRealPerson(context.Background(), 7, created.ID)
	require.Nil(t, apiErr)
	require.Equal(t, "active", got.Status)
	require.Empty(t, got.VerificationURL)
	require.Equal(t, 1, fixture.api.resultCalls)
}

func TestListRealPersonsUsesCreatedTimeAndIDCursorAndNeverReturnsSecrets(t *testing.T) {
	fixture := newRealPersonServiceFixture(t)
	insertRealPersonListFixture(t, 7, "rph_newer", 300)
	insertRealPersonListFixture(t, 7, "rph_tie_low", 200)
	insertRealPersonListFixture(t, 7, "rph_tie_high", 200)
	insertRealPersonListFixture(t, 8, "rph_other", 400)

	first, apiErr := ListBytePlusRealPersons(context.Background(), 7, 2, "")
	require.Nil(t, apiErr)
	require.Equal(t, []string{"rph_newer", "rph_tie_high"}, []string{first.Data[0].ID, first.Data[1].ID})
	require.True(t, first.HasMore)
	require.Equal(t, "rph_tie_high", first.NextAfter)
	second, apiErr := ListBytePlusRealPersons(context.Background(), 7, 2, first.NextAfter)
	require.Nil(t, apiErr)
	require.Equal(t, []string{"rph_tie_low"}, []string{second.Data[0].ID})
	require.False(t, second.HasMore)

	raw, err := common.Marshal(first)
	require.NoError(t, err)
	for _, leaked := range []string{"byted-token", "h5.example", "callback-token", "group-face", "channel_id", "project3", "sk-example"} {
		require.NotContains(t, string(raw), leaked)
	}
	require.Equal(t, int64(1_700_000_000), fixture.now())
}

func TestCreateBytePlusRealPersonLocalTransactionRollsBackOnLedgerCASFailure(t *testing.T) {
	fixture := newRealPersonServiceFixture(t)
	claim, err := model.ClaimAPIIdempotency(7, "real_person_create", "key-hash", "request-hash", model.APIIdempotencyResourceTypeVerificationSession, 100, 50, 1000)
	require.NoError(t, err)
	profile := model.BytePlusRealPersonProfile{PublicId: "rph_rollback", UserId: 7, Name: "Rollback", ChannelId: 101, Status: model.BytePlusRealPersonProfileStatusPendingVerification}
	session := model.BytePlusVisualValidationSession{PublicId: "rvs_rollback", CallbackTokenHash: strings.Repeat("a", 64), CallbackTokenCiphertext: "ciphertext", Status: model.BytePlusVisualValidationSessionStatusCreating}
	_, _, err = model.CreateBytePlusRealPersonProfileAndSessionForIdempotency(claim.Record.Id, claim.Record.LeaseUpdatedTime+1, profile, session, 101)
	require.Error(t, err)

	var profiles, sessions int64
	require.NoError(t, model.DB.Model(&model.BytePlusRealPersonProfile{}).Where("public_id = ?", profile.PublicId).Count(&profiles).Error)
	require.NoError(t, model.DB.Model(&model.BytePlusVisualValidationSession{}).Where("public_id = ?", session.PublicId).Count(&sessions).Error)
	require.Zero(t, profiles)
	require.Zero(t, sessions)
	require.Equal(t, int64(1_700_000_000), fixture.now())
}

func TestCreateBytePlusRealPersonStaleProcessingResumesOriginalProfileAndSession(t *testing.T) {
	fixture := newRealPersonServiceFixture(t)
	request := dto.BytePlusRealPersonCreateRequest{Name: "Person A"}
	keyHash, err := hashAPIIdempotencyKey("idem-resume")
	require.NoError(t, err)
	requestHash, err := hashRealPersonCreateRequest(request.Name, 101)
	require.NoError(t, err)
	claim, err := model.ClaimAPIIdempotency(7, "real_person_create", keyHash, requestHash, model.APIIdempotencyResourceTypeVerificationSession, 100, 50, fixture.now()+3600)
	require.NoError(t, err)

	callbackCiphertext, err := plainRealPersonCipher{}.Encrypt("rvs_existing", "callback_token", "callback-token-existing")
	require.NoError(t, err)
	profile := model.BytePlusRealPersonProfile{PublicId: "rph_existing", UserId: 7, Name: "Person A", ChannelId: 101, Status: model.BytePlusRealPersonProfileStatusPendingVerification, CreatedTime: 100, UpdatedTime: 100}
	session := model.BytePlusVisualValidationSession{PublicId: "rvs_existing", CallbackTokenHash: callbackHashForTest("callback-token-existing"), CallbackTokenCiphertext: callbackCiphertext, Status: model.BytePlusVisualValidationSessionStatusCreating, ExpiresAt: fixture.now()+1800, CreatedTime: 100, UpdatedTime: 100}
	_, _, err = model.CreateBytePlusRealPersonProfileAndSessionForIdempotency(claim.Record.Id, claim.Record.LeaseUpdatedTime, profile, session, 101)
	require.NoError(t, err)

	response, apiErr := CreateBytePlusRealPerson(context.Background(), 7, "default", "default", 101, "idem-resume", request)
	require.Nil(t, apiErr)
	require.Equal(t, "rph_existing", response.ID)
	require.Equal(t, 1, fixture.api.createCalls)
	require.Equal(t, "https://api.flatkey.example/v1/real-person-verifications/callback/callback-token-existing", fixture.api.lastCallbackURL)

	var profileCount, sessionCount int64
	require.NoError(t, model.DB.Model(&model.BytePlusRealPersonProfile{}).Count(&profileCount).Error)
	require.NoError(t, model.DB.Model(&model.BytePlusVisualValidationSession{}).Count(&sessionCount).Error)
	require.Equal(t, int64(1), profileCount)
	require.Equal(t, int64(1), sessionCount)
}

type fakeRealPersonAPI struct {
	createCalls       int
	resultCalls       int
	createAssetCalls  int
	getAssetCalls     int
	deleteAssetCalls  int
	lastCallbackURL   string
	lastAssetCreate   BytePlusCreateAssetRequest
	deletedAssetIDs   []string
	createErr         error
	createAssetErr    error
	deleteAssetErr    error
	resultErr         error
	result            BytePlusVisualValidationResult
	assetStatus       BytePlusAssetStatus
	afterCreate       func()
	afterCreateAsset  func()
	afterDeleteAsset  func()
}

func (f *fakeRealPersonAPI) CreateVisualValidateSession(_ context.Context, _ BytePlusCredentials, callbackURL string) (BytePlusVisualValidationSession, error) {
	f.createCalls++
	f.lastCallbackURL = callbackURL
	if f.afterCreate != nil { f.afterCreate() }
	if f.createErr != nil { return BytePlusVisualValidationSession{}, f.createErr }
	return BytePlusVisualValidationSession{BytedToken: "byted-token-1", H5Link: "https://h5.example/session-1", CallbackURL: callbackURL, RequestID: "req-create"}, nil
}

func (f *fakeRealPersonAPI) GetVisualValidateResult(context.Context, BytePlusCredentials, string) (BytePlusVisualValidationResult, error) {
	f.resultCalls++
	if f.resultErr != nil { return BytePlusVisualValidationResult{}, f.resultErr }
	return f.result, nil
}

func (f *fakeRealPersonAPI) CreateAsset(_ context.Context, _ BytePlusCredentials, request BytePlusCreateAssetRequest) (string, string, error) {
	f.createAssetCalls++
	f.lastAssetCreate = request
	if f.afterCreateAsset != nil { f.afterCreateAsset() }
	if f.createAssetErr != nil { return "", "req-asset-failed", f.createAssetErr }
	return "upstream-asset", "req-asset", nil
}

func (f *fakeRealPersonAPI) GetAsset(context.Context, BytePlusCredentials, string) (BytePlusAssetStatus, error) {
	f.getAssetCalls++
	return f.assetStatus, nil
}

func (f *fakeRealPersonAPI) ListAssets(context.Context, BytePlusCredentials, BytePlusListAssetsRequest) (BytePlusListAssetsResult, error) {
	return BytePlusListAssetsResult{}, nil
}

func (f *fakeRealPersonAPI) DeleteAsset(_ context.Context, _ BytePlusCredentials, upstreamAssetID string) (string, error) {
	f.deleteAssetCalls++
	f.deletedAssetIDs = append(f.deletedAssetIDs, upstreamAssetID)
	if f.afterDeleteAsset != nil { f.afterDeleteAsset() }
	if f.deleteAssetErr != nil { return "req-delete-failed", f.deleteAssetErr }
	return "req-delete", nil
}

type plainRealPersonCipher struct{}

func (plainRealPersonCipher) Encrypt(sessionID, field, plaintext string) (string, error) {
	if sessionID == "" || field == "" || plaintext == "" { return "", errors.New("invalid plaintext") }
	return sessionID + ":" + field + ":" + plaintext, nil
}

func (plainRealPersonCipher) Decrypt(sessionID, field, envelope string) (string, error) {
	prefix := sessionID + ":" + field + ":"
	if !strings.HasPrefix(envelope, prefix) { return "", errors.New("aad mismatch") }
	return strings.TrimPrefix(envelope, prefix), nil
}

type realPersonServiceFixture struct {
	api *fakeRealPersonAPI
	now func() int64
}

func newRealPersonServiceFixture(t *testing.T) *realPersonServiceFixture {
	t.Helper()
	db := newBytePlusAssetServiceTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.BytePlusRealPersonProfile{}, &model.BytePlusVisualValidationSession{}, &model.APIIdempotencyRecord{}, &model.BytePlusAssetTempObject{}))
	insertBytePlusAssetChannel(t, 101, "default", common.ChannelStatusEnabled, realPersonCredentialsJSON(t))
	api := &fakeRealPersonAPI{}
	installRealPersonServiceDeps(t, api)
	return &realPersonServiceFixture{api: api, now: func() int64 { return 1_700_000_000 }}
}

func (f *realPersonServiceFixture) create(key, name string) (*dto.BytePlusRealPersonResponse, *types.NewAPIError) {
	return CreateBytePlusRealPerson(context.Background(), 7, "default", "default", 101, key, dto.BytePlusRealPersonCreateRequest{Name: name})
}

func installRealPersonServiceDeps(t *testing.T, api *fakeRealPersonAPI) {
	t.Helper()
	t.Setenv(bytePlusRealPersonCallbackBaseEnv, "https://api.flatkey.example")
	oldNow, oldProfileID := bytePlusAssetNow, bytePlusRealPersonPublicID
	oldSessionID, oldCallback := bytePlusVisualValidationSessionPublicID, bytePlusRealPersonCallbackToken
	oldFactory, oldCipher := bytePlusRealPersonClientFactory, bytePlusRealPersonCipherFactory
	var profileSequence, sessionSequence, callbackSequence atomic.Int64
	bytePlusAssetNow = func() int64 { return 1_700_000_000 }
	bytePlusRealPersonPublicID = func() (string, error) { return fmt.Sprintf("rph_test_%d", profileSequence.Add(1)), nil }
	bytePlusVisualValidationSessionPublicID = func() (string, error) { return fmt.Sprintf("rvs_test_%d", sessionSequence.Add(1)), nil }
	bytePlusRealPersonCallbackToken = func() (string, error) { return fmt.Sprintf("callback-token-%d", callbackSequence.Add(1)), nil }
	bytePlusRealPersonClientFactory = func(*model.Channel) (bytePlusRealPersonAPI, error) { return api, nil }
	bytePlusRealPersonCipherFactory = func() (BytePlusSensitiveCipher, error) { return plainRealPersonCipher{}, nil }
	t.Cleanup(func() {
		bytePlusAssetNow, bytePlusRealPersonPublicID = oldNow, oldProfileID
		bytePlusVisualValidationSessionPublicID, bytePlusRealPersonCallbackToken = oldSessionID, oldCallback
		bytePlusRealPersonClientFactory, bytePlusRealPersonCipherFactory = oldFactory, oldCipher
	})
}

func realPersonCredentialsJSON(t *testing.T) string {
	t.Helper()
	raw, err := common.Marshal(BytePlusCredentials{APIKey: "ark-key", AccessKeyID: "ak-example", SecretAccessKey: "sk-example", ProjectName: "project3", RealPersonAssets: BytePlusRealPersonAssetsConfig{Enabled: true, TOSBucket: "private-assets", TOSRegion: bytePlusAssetRegion, TOSInternalEndpoint: "https://tos-ap-southeast-1.ivolces.com"}})
	require.NoError(t, err)
	return string(raw)
}

func callbackHashForTest(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func mustFailCurrentSession(t *testing.T, profileID, sessionID int64, now int64) bool {
	t.Helper()
	updated, err := model.FailBytePlusRealPersonSession(profileID, sessionID, "verification_failed", now)
	require.NoError(t, err)
	return updated
}

func insertRealPersonListFixture(t *testing.T, userID int, publicID string, createdTime int64) {
	t.Helper()
	profile := model.BytePlusRealPersonProfile{PublicId: publicID, UserId: userID, Name: publicID, ChannelId: 101, Status: model.BytePlusRealPersonProfileStatusPendingVerification, CreatedTime: createdTime, UpdatedTime: createdTime}
	require.NoError(t, model.DB.Create(&profile).Error)
	session := model.BytePlusVisualValidationSession{PublicId: "rvs_" + publicID, ProfileId: profile.Id, CallbackTokenHash: callbackHashForTest(publicID), BytedTokenCiphertext: "byted-token-secret", H5LinkCiphertext: "https://h5.example/secret", Status: model.BytePlusVisualValidationSessionStatusPending, ExpiresAt: createdTime + 1800, CreatedTime: createdTime, UpdatedTime: createdTime}
	require.NoError(t, model.DB.Create(&session).Error)
	require.NoError(t, model.DB.Model(&profile).Update("current_validation_session_id", session.Id).Error)
}
```

每个 fake client 记录 `CreateVisualValidateSession` 次数；同 key 重放和 `OutcomeUnknown` 重放都必须保持次数为 1。创建两个档案时可绑定同一渠道，但 session 与最终 `GroupId` 必须独立。

- [ ] **Step 2: 运行档案 service 测试并确认 RED**

Run: `go test ./service ./model -run 'BytePlusRealPerson(Create|Reverify|Get|List|SessionCAS)' -count=1`

Expected: FAIL，缺少 DTO、档案模型方法和服务编排。

- [ ] **Step 3: 定义公开 DTO 与唯一状态转换函数**

`dto/byteplus_real_person.go`：

```go
type BytePlusRealPersonCreateRequest struct {
	Name string `json:"name"`
}

type BytePlusRealPersonResponse struct {
	ID                    string `json:"id"`
	Object                string `json:"object"`
	Name                  string `json:"name"`
	Status                string `json:"status"`
	VerificationURL       string `json:"verification_url,omitempty"`
	VerificationExpiresAt int64  `json:"verification_expires_at,omitempty"`
	CreatedAt             int64  `json:"created_at"`
}

type BytePlusRealPersonListResponse struct {
	Object    string                       `json:"object"`
	Data      []BytePlusRealPersonResponse `json:"data"`
	HasMore   bool                         `json:"has_more"`
	NextAfter string                       `json:"next_after,omitempty"`
}

func BytePlusRealPersonAPIStatus(status string) string {
	switch status {
	case "PendingVerification":
		return "pending_verification"
	case "Verifying":
		return "verifying"
	case "Active":
		return "active"
	case "Failed":
		return "failed"
	case "Expired":
		return "expired"
	default:
		return "failed"
	}
}
```

响应转换只接收模型和可选的临时解密 H5Link；普通 GET/list 永远传空链接。

- [ ] **Step 4: 添加模型所有权、分页和 session/profile CAS**

在 `model/byteplus_real_person.go` 实现并测试：

```go
func CreateBytePlusRealPersonProfileAndSessionForIdempotency(recordID, leaseUpdatedTime int64, profile BytePlusRealPersonProfile, session BytePlusVisualValidationSession, now int64) (*BytePlusRealPersonProfile, *BytePlusVisualValidationSession, error)
func GetBytePlusRealPersonProfileForUser(userID int, publicID string) (*BytePlusRealPersonProfile, error)
func GetBytePlusRealPersonProfileByIDForUser(userID int, profileID int64) (*BytePlusRealPersonProfile, error)
func GetBytePlusRealPersonProfileByID(profileID int64) (*BytePlusRealPersonProfile, error)
func ListBytePlusRealPersonProfilesForUser(userID int, limit int, afterPublicID string) ([]BytePlusRealPersonProfile, bool, error)
func GetBytePlusVisualValidationSessionByID(sessionID int64) (*BytePlusVisualValidationSession, error)
func GetBytePlusVisualValidationSessionByPublicID(publicID string) (*BytePlusVisualValidationSession, error)
func GetBytePlusVisualValidationSessionByCallbackHash(callbackHash string) (*BytePlusVisualValidationSession, error)
func ActivateBytePlusRealPersonProfile(profileID, sessionID int64, groupID string, now int64) (bool, error)
func FailBytePlusRealPersonSession(profileID, sessionID int64, failureCode string, now int64) (bool, error)
func ReplaceBytePlusRealPersonCurrentSessionForIdempotency(recordID, leaseUpdatedTime int64, userID int, profileID int64, allowedStatuses []string, session BytePlusVisualValidationSession, now int64) (*BytePlusVisualValidationSession, error)
func ClaimBytePlusVisualValidationSession(sessionID int64, now, staleBefore int64) (*BytePlusVisualValidationSession, bool, error)
func CompleteBytePlusVisualValidationSession(sessionID int64, bytedCiphertext, h5Ciphertext, upstreamRequestID string, expiresAt, now int64) error
func ClearBytePlusVisualValidationSecrets(sessionID int64, now int64) error
```

`CreateBytePlusRealPersonProfileAndSessionForIdempotency` 必须在一个 `DB.Transaction` 中依次创建 profile、创建 session、写 `profile.current_validation_session_id`，最后调用 `BindAPIIdempotencyResourceTx(..., session.PublicId, ...)`；ledger CAS 失败时 profile/session 都不得落库。`ReplaceBytePlusRealPersonCurrentSessionForIdempotency` 同样在一个事务中创建新 session、CAS 更新当前 session/status，并把 ledger resource 绑定为该 session 的公开 ID。两个入口的 `resource_type` 都固定为 `verification_session`；`Resume/Replay/OutcomeUnknown` 先按公开 session ID 加载精确 session，再通过 `session.ProfileId` 加载档案，并且只有 session 仍是 `current_validation_session_id` 时才能改变档案。面向用户的查询只调用 `...ForUser`；callback/jobs 才能调用可信内部 ID 查询。

`ActivateBytePlusRealPersonProfile` 的核心条件必须是：

```go
result := DB.Model(&BytePlusRealPersonProfile{}).
	Where("id = ? AND current_validation_session_id = ? AND status IN ?", profileID, sessionID, []string{
		BytePlusRealPersonProfileStatusPendingVerification,
		BytePlusRealPersonProfileStatusVerifying,
	}).
	Updates(map[string]any{
		"status": BytePlusRealPersonProfileStatusActive,
		"upstream_group_id": groupID,
		"error_code": "",
		"updated_time": now,
	})
return result.RowsAffected == 1, result.Error
```

分页先通过 `afterPublicID + user_id` 查游标行，再按 `(created_time < cursor.created_time) OR (created_time = cursor.created_time AND id < cursor.id)` 查询，`ORDER BY created_time DESC, id DESC`，读取 `limit+1` 判定 `has_more`。

- [ ] **Step 5: 实现渠道选择和认证创建编排**

服务依赖接口保持与旧虚拟素材 fake 分离：

```go
type bytePlusRealPersonAPI interface {
	CreateVisualValidateSession(context.Context, BytePlusCredentials, string) (BytePlusVisualValidationSession, error)
	GetVisualValidateResult(context.Context, BytePlusCredentials, string) (BytePlusVisualValidationResult, error)
	CreateAsset(context.Context, BytePlusCredentials, BytePlusCreateAssetRequest) (string, string, error)
	GetAsset(context.Context, BytePlusCredentials, string) (BytePlusAssetStatus, error)
	ListAssets(context.Context, BytePlusCredentials, BytePlusListAssetsRequest) (BytePlusListAssetsResult, error)
	DeleteAsset(context.Context, BytePlusCredentials, string) (string, error)
}

const (
	bytePlusRealPersonPublicIDPrefix = "rph_"
	bytePlusVerificationSessionTTL   = 30 * time.Minute
	bytePlusRealPersonCallbackBaseEnv = "BYTEPLUS_REAL_PERSON_CALLBACK_BASE_URL"
)

var (
	bytePlusRealPersonPublicID = newBytePlusRealPersonPublicID
	bytePlusVisualValidationSessionPublicID = newBytePlusVisualValidationSessionPublicID
	bytePlusRealPersonCallbackToken = newBytePlusRealPersonCallbackToken
	bytePlusRealPersonClientFactory = func(*model.Channel) (bytePlusRealPersonAPI, error) {
		return NewBytePlusAssetClient(nil, ""), nil
	}
	bytePlusRealPersonCipherFactory = loadBytePlusSensitiveCipherFromEnv
)

func hashRealPersonCreateRequest(name string, specificChannelID int) (string, error) {
	return hashCanonicalRequest(struct {
		Name              string `json:"name"`
		SpecificChannelID int    `json:"specific_channel_id"`
	}{Name: strings.TrimSpace(name), SpecificChannelID: specificChannelID})
}

func normalizeBytePlusRealPersonName(raw string) (string, *types.NewAPIError) {
	name := strings.TrimSpace(raw)
	if count := utf8.RuneCountInString(name); count < 1 || count > 64 {
		return "", realPersonError(errors.New("real-person name must contain 1 to 64 characters"), types.ErrorCodeInvalidRealPersonRequest, http.StatusBadRequest)
	}
	return name, nil
}
```

这些 seam 只用于复用现有 service 测试模式；生产路径仍使用上面的密码学随机生成器、真实 signed client 与环境密钥。测试必须通过 `t.Cleanup` 恢复，不能在并行测试中改写。

`selectBytePlusRealPersonChannel` 复用 `bytePlusAssetCandidateGroups`、Ability 查询和 weighted selection，但过滤条件必须同时满足 `bytePlusAssetChannelIsUsable`、`ValidateRealPersonAssets()` 和 `seedance-2.0` ability；指定渠道失败或后来失效都返回 `real_person_channel_unavailable`，不选择替代渠道。

创建 owner 的顺序固定为以下代码路径；辅助函数分别负责生成 32 字符公开 ID、内部 session ID、callback token 和 SHA-256 callback token hash。创建本地事务前先用 session public ID 与 `callback_token` AAD 加密 callback token，把密文和 hash 一起写入 session；`Resume` 从原 session 解密该密文重建同一 callback URL，不生成新 token。`CompleteBytePlusVisualValidationSession` 与所有终态转换必须清空 `callback_token_ciphertext`：

```go
func createBytePlusVisualValidation(
	ctx context.Context,
	userID int,
	profile *model.BytePlusRealPersonProfile,
	session *model.BytePlusVisualValidationSession,
	channel *model.Channel,
	creds BytePlusCredentials,
	claim *model.APIIdempotencyClaim,
	client bytePlusRealPersonAPI,
	cipher BytePlusSensitiveCipher,
) (*dto.BytePlusRealPersonResponse, *types.NewAPIError) {
	callbackToken, err := cipher.Decrypt(session.PublicId, "callback_token", session.CallbackTokenCiphertext)
	if err != nil {
		return nil, markVerificationOutcomeUnknown(claim, profile, session)
	}
	callbackURL, err := buildBytePlusCallbackURL(os.Getenv(bytePlusRealPersonCallbackBaseEnv), callbackToken)
	if err != nil {
		return nil, realPersonError(err, types.ErrorCodeRealPersonChannelUnavailable, http.StatusServiceUnavailable)
	}
	if err := model.MarkAPIIdempotencyCallingUpstream(claim.Record.Id, claim.Record.LeaseUpdatedTime, bytePlusAssetNow()); err != nil {
		return nil, realPersonError(err, types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
	}
	upstream, err := client.CreateVisualValidateSession(ctx, creds, callbackURL)
	if err != nil {
		return nil, finishUnknownOrDefinitiveVerificationFailure(claim, profile, session, err)
	}
	bytedCiphertext, err := cipher.Encrypt(session.PublicId, "byted_token", upstream.BytedToken)
	if err != nil {
		return nil, markVerificationOutcomeUnknown(claim, profile, session)
	}
	h5Ciphertext, err := cipher.Encrypt(session.PublicId, "h5_link", upstream.H5Link)
	if err != nil {
		return nil, markVerificationOutcomeUnknown(claim, profile, session)
	}
	if err := model.CompleteBytePlusVisualValidationSession(session.Id, bytedCiphertext, h5Ciphertext, upstream.RequestID, session.ExpiresAt, bytePlusAssetNow()); err != nil {
		return nil, markVerificationOutcomeUnknown(claim, profile, session)
	}
	response := responseFromBytePlusRealPerson(profile, upstream.H5Link, session.ExpiresAt)
	safePayload, err := common.Marshal(responseFromBytePlusRealPerson(profile, "", 0))
	if err != nil {
		return nil, markVerificationOutcomeUnknown(claim, profile, session)
	}
	if err := model.CompleteAPIIdempotency(claim.Record.Id, claim.Record.LeaseUpdatedTime, session.PublicId, http.StatusOK, string(safePayload), bytePlusAssetNow()); err != nil {
		return nil, markVerificationOutcomeUnknown(claim, profile, session)
	}
	return response, nil
}
```

补齐失败分类函数，不允许留作隐含实现：

```go
func markVerificationOutcomeUnknown(claim *model.APIIdempotencyClaim, profile *model.BytePlusRealPersonProfile, session *model.BytePlusVisualValidationSession) *types.NewAPIError
func finishUnknownOrDefinitiveVerificationFailure(claim *model.APIIdempotencyClaim, profile *model.BytePlusRealPersonProfile, session *model.BytePlusVisualValidationSession, err error) *types.NewAPIError
```

`markVerificationOutcomeUnknown` 以当前 ledger lease CAS 为 `OutcomeUnknown`，并只在 `profile.current_validation_session_id=session.id` 时把 session/profile 写入稳定失败码；不得清除或改写其他 session。`finishUnknownOrDefinitiveVerificationFailure` 仅当 `isBytePlusDefinitiveResponse(err)` 为 true 时写安全 `Failed` payload 并调用 `FailAPIIdempotency`；transport、timeout、EOF、响应截断和本地持久化失败一律调用 `markVerificationOutcomeUnknown`。任何分支都不能把上游 message、token 或 URL写入 payload。

`CreateBytePlusRealPerson` 先调用 `normalizeBytePlusRealPersonName`，并在任何渠道查询、ledger 写入或外部调用前拒绝空白或超过 64 个 Unicode code point 的名称；规范化后的 name 同时用于哈希和持久化。`CreateBytePlusRealPerson` 和 `ReverifyBytePlusRealPerson` 都先验证 name/profile、计算规范请求哈希，以 `resource_type=verification_session` 领取幂等账本，再通过上面的事务函数创建本地资源。`Owner` 创建新资源；`Resume` 从 ledger 已绑定的 session public ID 加载原 session 与 profile 并继续，绝不能生成第二个本地资源；`Replay` 从同一 session 重新加载档案：只有该 session 仍是 current、未终态、未过期且 `h5_link_ciphertext` 仍存在时才临时解密并注入链接，否则返回档案当前安全表示。

- [ ] **Step 6: 实现可信结果同步、查询和列表**

`SyncBytePlusRealPersonVerification` 必须：按当前 session ID 领取查询 lease；过期时 CAS 为 `Expired` 并清空 H5；解密 BytedToken；调用 `GetVisualValidateResult`；只有非空 GroupId 且 `ActivateBytePlusRealPersonProfile` 返回 true 才把 session 标为 `Succeeded`。旧 session、重复回调和并发 GET 的 CAS 失败都按幂等完成处理，不能覆盖当前档案。

```go
func SyncBytePlusRealPersonVerification(ctx context.Context, userID int, profile *model.BytePlusRealPersonProfile) *types.NewAPIError
func CreateBytePlusRealPerson(ctx context.Context, userID int, userGroup, usingGroup string, specificChannelID int, idempotencyKey string, request dto.BytePlusRealPersonCreateRequest) (*dto.BytePlusRealPersonResponse, *types.NewAPIError)
func ReverifyBytePlusRealPerson(ctx context.Context, userID int, personID, idempotencyKey string) (*dto.BytePlusRealPersonResponse, *types.NewAPIError)
func GetBytePlusRealPerson(ctx context.Context, userID int, personID string) (*dto.BytePlusRealPersonResponse, *types.NewAPIError)
func ListBytePlusRealPersons(ctx context.Context, userID int, limit int, after string) (*dto.BytePlusRealPersonListResponse, *types.NewAPIError)
```

- [ ] **Step 7: 运行档案全路径测试并确认 GREEN**

Run: `gofmt -w dto/byteplus_real_person.go service/byteplus_real_person.go service/byteplus_real_person_test.go model/byteplus_real_person.go model/byteplus_real_person_test.go`

Run: `go test ./model ./service -run 'BytePlusRealPerson(Create|Reverify|Get|List|SessionCAS|Verification)' -race -count=1`

Expected: PASS；同 key 同 hash 只调用一次上游，两个档案有两个独立 session/GroupId，旧 session 永远不能激活档案，普通响应无敏感字段。

- [ ] **Step 8: 提交真人档案生命周期**

```bash
git add dto/byteplus_real_person.go service/byteplus_real_person.go service/byteplus_real_person_test.go model/byteplus_real_person.go model/byteplus_real_person_test.go
git commit -m "Let each Flatkey user certify multiple independently pinned people" -m "Constraint: H5 links are one-time and BytedToken expires after thirty minutes" -m "Rejected: Reusing the virtual per-user asset group | one user needs multiple independently validated GroupIds" -m "Confidence: high" -m "Scope-risk: broad" -m "Directive: Late sessions may update their own terminal state but never replace the current profile session" -m "Tested: Ownership, channel binding, safe replay, reverify guards, session CAS, cursor pagination, and outcome-unknown behavior under race detection"
```

### Task 6: 接入官方 TOS SDK 并实现不落盘 multipart 流

**Files:**
- Modify: `go.mod`
- Modify: `go.sum`
- Create: `service/byteplus_tos.go`
- Create: `service/byteplus_tos_test.go`
- Create: `service/byteplus_asset_upload.go`
- Create: `service/byteplus_asset_upload_test.go`
- Modify: `model/byteplus_asset_temp_object.go`
- Modify: `model/byteplus_asset_temp_object_test.go`

- [ ] **Step 1: 写出未知长度、MIME、大小、字段顺序和清理失败测试**

```go
func TestBytePlusTOSPutObjectLeavesContentLengthUnsetForUnknownStream(t *testing.T) {
	fake := &fakeBytePlusTOSAPI{}
	store := &bytePlusTOSStore{client: fake, bucket: "private"}
	require.NoError(t, store.PutObject(context.Background(), "tmp/object", strings.NewReader("payload"), "image/png", 0))
	require.Zero(t, fake.putInput.ContentLength)
	require.Empty(t, fake.putInput.ContentMD5)
}

func TestReadBytePlusMultipartAssetAcceptsMetadataAfterFile(t *testing.T) {
	body, contentType := buildMultipartBody(t, []multipartTestPart{
		{Name: "file", Filename: "portrait.png", ContentType: "image/png", Body: pngFixtureBytes()},
		{Name: "name", Body: []byte("front pose")},
		{Name: "asset_type", Body: []byte("Image")},
	})
	req := httptest.NewRequest(http.MethodPost, "/v1/real-persons/rph_test/assets", body)
	req.Header.Set("Content-Type", contentType)

	result, apiErr := readBytePlusMultipartAsset(context.Background(), req, uploadTestProfile(), uploadTestChannel(), uploadTestStore())
	require.Nil(t, apiErr)
	require.Equal(t, "Image", result.AssetType)
	require.Equal(t, "front pose", result.Name)
	require.Equal(t, int64(len(pngFixtureBytes())), result.SizeBytes)
	require.Len(t, result.ContentSHA256, 64)
}

func TestReadBytePlusMultipartAssetRejectsTypeMismatchAndQueuesCleanup(t *testing.T) {
	body, contentType := buildMultipartBody(t, []multipartTestPart{
		{Name: "asset_type", Body: []byte("Audio")},
		{Name: "file", Filename: "portrait.png", ContentType: "image/png", Body: pngFixtureBytes()},
	})
	req := httptest.NewRequest(http.MethodPost, "/v1/real-persons/rph_test/assets", body)
	req.Header.Set("Content-Type", contentType)
	store := uploadTestStore()

	_, apiErr := readBytePlusMultipartAsset(context.Background(), req, uploadTestProfile(), uploadTestChannel(), store)
	require.Equal(t, types.ErrorCodeAssetMediaUnsupported, apiErr.GetErrorCode())
	require.Equal(t, 1, store.deleteCalls)
}

func TestReadBytePlusMultipartAssetRejectsMoreThanOneFileWithoutUploadingSecond(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	body, contentType := buildMultipartBody(t, []multipartTestPart{
		{Name: "asset_type", Body: []byte("Image")},
		{Name: "file", Filename: "a.png", ContentType: "image/png", Body: pngFixtureBytes()},
		{Name: "file", Filename: "b.png", ContentType: "image/png", Body: pngFixtureBytes()},
	})
	req := httptest.NewRequest(http.MethodPost, "/v1/real-persons/rph_test/assets", body)
	req.Header.Set("Content-Type", contentType)
	store := uploadTestStore()

	_, apiErr := readBytePlusMultipartAsset(context.Background(), req, uploadTestProfile(), uploadTestChannel(), store)
	require.NotNil(t, apiErr)
	require.Equal(t, types.ErrorCodeInvalidAssetRequest, apiErr.GetErrorCode())
	require.Equal(t, 1, store.putCalls)
	require.Equal(t, 1, store.deleteCalls)
}

func TestReadBytePlusMultipartAssetEnforcesImageAudioAndVideoByteLimits(t *testing.T) {
	tests := []struct {
		name      string
		assetType string
		mimeType  string
		size      int64
		wantCode  types.ErrorCode
	}{
		{"image_below_limit", "Image", "image/png", (30 << 20) - 1, ""},
		{"image_at_exclusive_limit", "Image", "image/png", 30 << 20, types.ErrorCodeAssetFileTooLarge},
		{"video_at_limit", "Video", "video/mp4", 50 << 20, ""},
		{"video_over_limit", "Video", "video/mp4", (50 << 20) + 1, types.ErrorCodeAssetFileTooLarge},
		{"audio_at_limit", "Audio", "audio/mpeg", 15 << 20, ""},
		{"audio_over_limit", "Audio", "audio/mpeg", (15 << 20) + 1, types.ErrorCodeAssetFileTooLarge},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			apiErr := validateBytePlusUploadedMedia(tt.assetType, tt.mimeType, tt.size)
			if tt.wantCode == "" {
				require.Nil(t, apiErr)
				return
			}
			require.NotNil(t, apiErr)
			require.Equal(t, tt.wantCode, apiErr.GetErrorCode())
		})
	}
}

func TestReadBytePlusMultipartAssetDeleteFailureLeavesPendingOutbox(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	body, contentType := buildMultipartBody(t, []multipartTestPart{
		{Name: "asset_type", Body: []byte("Audio")},
		{Name: "file", Filename: "portrait.png", ContentType: "image/png", Body: pngFixtureBytes()},
	})
	req := httptest.NewRequest(http.MethodPost, "/v1/real-persons/rph_test/assets", body)
	req.Header.Set("Content-Type", contentType)
	store := uploadTestStore()
	store.deleteErr = errors.New("tos delete failed")

	_, apiErr := readBytePlusMultipartAsset(context.Background(), req, uploadTestProfile(), uploadTestChannel(), store)
	require.NotNil(t, apiErr)
	require.Equal(t, types.ErrorCodeAssetMediaUnsupported, apiErr.GetErrorCode())
	require.Equal(t, 1, store.deleteCalls)

	var objects []model.BytePlusAssetTempObject
	require.NoError(t, model.DB.Find(&objects).Error)
	require.Len(t, objects, 1)
	require.Equal(t, model.BytePlusTempObjectCleanupPending, objects[0].CleanupStatus)
	require.Nil(t, objects[0].AssetId)
}

type multipartTestPart struct {
	Name        string
	Filename    string
	ContentType string
	Body        []byte
}

type nonSeekReader struct{ reader *bytes.Reader }

func (r *nonSeekReader) Read(p []byte) (int, error) { return r.reader.Read(p) }

func buildMultipartBody(t *testing.T, parts []multipartTestPart) (io.Reader, string) {
	t.Helper()
	var buffer bytes.Buffer
	writer := multipart.NewWriter(&buffer)
	for _, part := range parts {
		var destination io.Writer
		var err error
		if part.Filename == "" {
			destination, err = writer.CreateFormField(part.Name)
		} else {
			header := make(textproto.MIMEHeader)
			header.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, part.Name, part.Filename))
			header.Set("Content-Type", part.ContentType)
			destination, err = writer.CreatePart(header)
		}
		require.NoError(t, err)
		_, err = destination.Write(part.Body)
		require.NoError(t, err)
	}
	require.NoError(t, writer.Close())
	return &nonSeekReader{reader: bytes.NewReader(buffer.Bytes())}, writer.FormDataContentType()
}

func pngFixtureBytes() []byte {
	return []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52}
}

type fakeUploadStore struct {
	mu           sync.Mutex
	putCalls    int
	deleteCalls int
	presignCalls int
	putKeys      []string
	deleteKeys   []string
	deleteErr   error
}

func (s *fakeUploadStore) PutObject(_ context.Context, objectKey string, body io.Reader, _ string, size int64) error {
	s.mu.Lock()
	s.putCalls++
	s.putKeys = append(s.putKeys, objectKey)
	s.mu.Unlock()
	if size != 0 {
		return fmt.Errorf("streaming upload size = %d, want unknown length 0", size)
	}
	_, err := io.Copy(io.Discard, body)
	return err
}

func (s *fakeUploadStore) PresignGet(_ context.Context, objectKey string, _ time.Duration) (string, error) {
	s.mu.Lock()
	s.presignCalls++
	s.mu.Unlock()
	return "https://tos.internal.invalid/" + url.PathEscape(objectKey), nil
}

func (s *fakeUploadStore) DeleteObject(_ context.Context, objectKey string) error {
	s.mu.Lock()
	s.deleteCalls++
	s.deleteKeys = append(s.deleteKeys, objectKey)
	s.mu.Unlock()
	return s.deleteErr
}

func uploadTestStore() *fakeUploadStore { return &fakeUploadStore{} }

func uploadTestProfile() *model.BytePlusRealPersonProfile {
	groupID := "group-face-1"
	return &model.BytePlusRealPersonProfile{Id: 9, PublicId: "rph_test", UserId: 7, ChannelId: 101, UpstreamGroupId: &groupID, Status: model.BytePlusRealPersonProfileStatusActive}
}

func uploadTestChannel() *model.Channel { return &model.Channel{Id: 101} }
```

测试的 request body 使用只读、不可 seek 的 reader；fake store 在 `PutObject` 内持续读取到 EOF，确认实现没有 `io.ReadAll`、seek 或临时文件依赖。三类有效边界固定断言为 Image `< 30 MiB`、Video `<= 50 MiB`、Audio `<= 15 MiB`。公开 multipart 请求体硬上限固定为 `50 MiB + 1 MiB envelope allowance`；这 1 MiB 只容纳 multipart boundary、header 和小文本字段，文件 part 本身仍由类型上限限制。不得保留 250 MiB 分支或条件式表述。

- [ ] **Step 2: 运行上传测试并确认 RED**

Run: `go test ./service ./model -run 'BytePlusTOS|BytePlusMultipart|BytePlusAssetTempObject' -count=1`

Expected: FAIL，缺少 SDK 适配器、multipart reader、临时对象状态方法和测试依赖。

- [ ] **Step 3: 添加并固定官方 SDK 版本**

Run: `go get github.com/volcengine/ve-tos-golang-sdk/v2@v2.9.8`

Expected: `go.mod` 增加 `github.com/volcengine/ve-tos-golang-sdk/v2 v2.9.8`，模块缓存和 `go.sum` 更新；不得升级无关依赖。

- [ ] **Step 4: 实现真实 TOS adapter，未知长度保持 ContentLength 零值**

`service/byteplus_tos.go`：

```go
type BytePlusTempObjectStore interface {
	PutObject(ctx context.Context, objectKey string, body io.Reader, contentType string, size int64) error
	PresignGet(ctx context.Context, objectKey string, ttl time.Duration) (string, error)
	DeleteObject(ctx context.Context, objectKey string) error
}

type bytePlusTOSAPI interface {
	PutObjectV2(context.Context, *tos.PutObjectV2Input) (*tos.PutObjectV2Output, error)
	PreSignedURL(*tos.PreSignedURLInput) (*tos.PreSignedURLOutput, error)
	DeleteObjectV2(context.Context, *tos.DeleteObjectV2Input) (*tos.DeleteObjectV2Output, error)
}

type bytePlusTOSStore struct {
	client bytePlusTOSAPI
	bucket string
}

var bytePlusTempObjectStoreFactory = newBytePlusTOSStore

func newBytePlusTOSStore(creds BytePlusCredentials) (BytePlusTempObjectStore, error) {
	if err := creds.ValidateRealPersonAssets(); err != nil {
		return nil, err
	}
	client, err := tos.NewClientV2(
		creds.RealPersonAssets.TOSInternalEndpoint,
		tos.WithCredentials(tos.NewStaticCredentials(creds.AccessKeyID, creds.SecretAccessKey)),
		tos.WithRegion(creds.RealPersonAssets.TOSRegion),
		tos.WithDisableTrailerHeader(false),
		tos.WithMaxRetryCount(0),
	)
	if err != nil {
		return nil, err
	}
	return &bytePlusTOSStore{client: client, bucket: creds.RealPersonAssets.TOSBucket}, nil
}

func (s *bytePlusTOSStore) PutObject(ctx context.Context, objectKey string, body io.Reader, contentType string, size int64) error {
	input := &tos.PutObjectV2Input{
		PutObjectBasicInput: tos.PutObjectBasicInput{
			Bucket: s.bucket,
			Key: objectKey,
			ContentType: contentType,
			CacheControl: "private, no-store",
		},
		Content: body,
	}
	if size > 0 {
		input.ContentLength = size
	}
	_, err := s.client.PutObjectV2(ctx, input)
	return err
}

func (s *bytePlusTOSStore) PresignGet(_ context.Context, objectKey string, ttl time.Duration) (string, error) {
	output, err := s.client.PreSignedURL(&tos.PreSignedURLInput{
		HTTPMethod: tosenum.HttpMethodGet,
		Bucket: s.bucket,
		Key: objectKey,
		Expires: int64(ttl.Seconds()),
	})
	if err != nil {
		return "", err
	}
	return output.SignedUrl, nil
}

func (s *bytePlusTOSStore) DeleteObject(ctx context.Context, objectKey string) error {
	_, err := s.client.DeleteObjectV2(ctx, &tos.DeleteObjectV2Input{Bucket: s.bucket, Key: objectKey})
	return err
}
```

关键约束：`size == 0` 时不要显式写 `-1`；不要设置 `ContentMD5`；`multipart.Part` 不可 seek，所以 SDK 重试数固定为 0；`WithDisableTrailerHeader(false)` 让 SDK 使用未知长度 chunked 流。

- [ ] **Step 5: 添加未绑定临时对象的持久化与清理 CAS**

`model/byteplus_asset_temp_object.go` 增加以下方法并为每个 `RowsAffected != 1` 分支写测试：

```go
func CreateBytePlusAssetTempObject(object BytePlusAssetTempObject) (*BytePlusAssetTempObject, error)
func UpdateBytePlusAssetTempObjectMetadata(id int64, sha256Hex string, size int64, mimeType string, now int64) error
func BindBytePlusAssetTempObject(id int64, assetID int64, signedURLExpiresAt int64, now int64) (bool, error)
func ClaimDueBytePlusTempObjectCleanups(now, staleBefore int64, limit int) ([]BytePlusAssetTempObject, error)
func CompleteBytePlusAssetTempObjectCleanup(id int64, leaseUpdatedTime int64, now int64) (bool, error)
func RetryBytePlusAssetTempObjectCleanup(id int64, leaseUpdatedTime int64, nextAttempt int64, now int64) (bool, error)
```

`Bind` 只允许 `asset_id IS NULL` 且 `cleanup_status=Pending`；清理 claim 使用一次查询候选 ID，再逐行执行 `UPDATE ... WHERE cleanup_status=Pending AND (lease=0 OR lease<staleBefore)`，不能使用 `SKIP LOCKED`。

- [ ] **Step 6: 实现单遍 multipart 读取和两阶段上传结果**

`service/byteplus_asset_upload.go` 的公开内部契约：

```go
const (
	bytePlusImageMaxBytes             int64 = 30 << 20
	bytePlusVideoMaxBytes             int64 = 50 << 20
	bytePlusAudioMaxBytes             int64 = 15 << 20
	bytePlusMultipartEnvelopeMaxBytes int64 = 1 << 20
	bytePlusMultipartRequestMaxBytes        = bytePlusVideoMaxBytes + bytePlusMultipartEnvelopeMaxBytes
	bytePlusSignedURLTTL                    = 12 * time.Hour
)

type BytePlusUploadedAsset struct {
	TempObject   *model.BytePlusAssetTempObject
	AssetType    string
	Name         string
	MimeType     string
	ContentSHA256 string
	SizeBytes    int64
}

type countingReader struct {
	reader io.Reader
	count  int64
}

func (r *countingReader) Read(p []byte) (int, error) {
	n, err := r.reader.Read(p)
	r.count += int64(n)
	return n, err
}
```

`readBytePlusMultipartAsset` 必须直接调用 `request.MultipartReader()`，按 part 顺序处理：小文本字段最多 8 KiB；遇到第一个 file 时先生成不含原文件名的随机 object key 并创建 `asset_id=NULL` 的 outbox，再用 `io.LimitedReader{R: part, N: bytePlusVideoMaxBytes + 1}` 限制文件 part。先缓冲最多 512 字节做魔数检测，再用 `io.MultiReader(bytes.NewReader(header), &limited)`、`io.TeeReader` 和 `countingReader` 把同一流送进 `PutObject(..., size=0)` 与 SHA-256；上传返回后若 `limited.N == 0`，必须按 413 处理并清理对象。读完剩余字段后校验真实 MIME、声明 `asset_type`、30/50/15 MiB 类型上限和单文件约束，更新 outbox metadata；任一失败调用 `deleteOrQueueBytePlusTempObject`。

```go
func readBytePlusMultipartAsset(
	ctx context.Context,
	request *http.Request,
	profile *model.BytePlusRealPersonProfile,
	channel *model.Channel,
	store BytePlusTempObjectStore,
) (*BytePlusUploadedAsset, *types.NewAPIError)

func validateBytePlusUploadedMedia(assetType, mimeType string, size int64) *types.NewAPIError
func sniffBytePlusMediaType(header []byte) string
func deleteOrQueueBytePlusTempObject(ctx context.Context, object *model.BytePlusAssetTempObject, store BytePlusTempObjectStore) error
```

`sniffBytePlusMediaType` 明确识别规格中的 JPEG/PNG/WebP/BMP/TIFF/GIF/HEIC/HEIF、MP4/MOV、WAV/MP3 魔数；不能信任 multipart 声明的 `Content-Type`。缺省 `name` 只取 `filepath.Base`，去除控制字符并按 Unicode code point 截断为 128；显式 `name` 保留给 Task 7 的统一 trim/长度校验，不能按字节截断。object key 只由固定前缀、用户 ID、UTC 日期和密码学随机串组成。

- [ ] **Step 7: 运行上传和既有临时媒体回归并确认 GREEN**

Run: `gofmt -w service/byteplus_tos.go service/byteplus_tos_test.go service/byteplus_asset_upload.go service/byteplus_asset_upload_test.go model/byteplus_asset_temp_object.go model/byteplus_asset_temp_object_test.go`

Run: `go test ./service ./model -run 'BytePlusTOS|BytePlusMultipart|BytePlusAssetTempObject|TempMedia' -count=1`

Expected: PASS；不可 seek 输入只读一遍，size=0 不设置 ContentLength，任何验证或清理失败都有可恢复 outbox，现有 GCS temp media 不受影响。

- [ ] **Step 8: 提交 TOS 与流式上传边界**

```bash
git add go.mod go.sum service/byteplus_tos.go service/byteplus_tos_test.go service/byteplus_asset_upload.go service/byteplus_asset_upload_test.go model/byteplus_asset_temp_object.go model/byteplus_asset_temp_object_test.go
git commit -m "Accept customer files without requiring customer-hosted URLs" -m "Constraint: Raw multipart data must stream directly into same-region private TOS and never touch local disk" -m "Rejected: Gin FormFile and ParseMultipartForm | both may buffer files and break the streaming guarantee" -m "Confidence: high" -m "Scope-risk: broad" -m "Directive: Keep unknown-length PutObject input at ContentLength zero with trailer headers enabled and SDK retries disabled" -m "Tested: Unknown-length SDK input, MIME sniffing, field ordering, byte limits, one-file enforcement, metadata persistence, and cleanup retry"
```

### Task 7: 创建 URL/本地文件真人素材并安全重放

**Files:**
- Modify: `dto/byteplus_real_person.go`
- Modify: `dto/byteplus_asset.go`
- Modify: `dto/byteplus_asset_test.go`
- Create: `service/byteplus_real_person_asset.go`
- Create: `service/byteplus_real_person_asset_test.go`
- Modify: `service/byteplus_asset.go`
- Modify: `service/byteplus_asset_test.go`
- Modify: `model/byteplus_asset.go`
- Modify: `model/byteplus_asset_temp_object.go`

- [ ] **Step 1: 写出 URL、本地流、并发输家清理和虚拟响应兼容测试**

```go
func TestCreateRealPersonAssetFromURLUsesBoundProfileGroupAndDefaultModeration(t *testing.T) {
	fixture := newRealPersonAssetFixture(t)
	response, apiErr := fixture.createURL("idem-url", "https://cdn.example.com/person.png", "Image", "front")
	require.Nil(t, apiErr)
	require.Equal(t, model.BytePlusAssetStatusProcessing, response.Status)
	require.Nil(t, response.Moderation)
	require.Equal(t, "asset://"+response.ID, response.AssetURI)
	require.Equal(t, *fixture.profile.UpstreamGroupId, fixture.api.lastAssetCreate.GroupID)
	require.Equal(t, "Default", fixture.api.lastAssetCreate.ModerationStrategy)

	var asset model.BytePlusAsset
	require.NoError(t, model.DB.Where("public_id = ?", response.ID).First(&asset).Error)
	require.Equal(t, fixture.profile.Id, *asset.RealPersonProfileId)
	require.Equal(t, fixture.profile.UserId, asset.UserId)
	require.Equal(t, fixture.profile.ChannelId, asset.ChannelId)
	require.Zero(t, asset.AssetGroupId)
}

func TestCreateRealPersonAssetFromURLDoesNotPersistCompleteSourceURL(t *testing.T) {
	fixture := newRealPersonAssetFixture(t)
	source := "https://signed.example.com/person.png?X-Tos-Signature=secret&X-Tos-Credential=private"
	response, apiErr := fixture.createURL("idem-url-secret", source, "Image", "front")
	require.Nil(t, apiErr)
	var asset model.BytePlusAsset
	require.NoError(t, model.DB.Where("public_id = ?", response.ID).First(&asset).Error)
	require.Empty(t, asset.SourceURL)
	raw, err := common.Marshal(asset)
	require.NoError(t, err)
	require.NotContains(t, string(raw), "signed.example.com")
	require.NotContains(t, string(raw), "X-Tos-Signature")
}

func TestCreateRealPersonAssetFromURLRejectsNameAbove128CodePointsBeforeLedgerOrUpstream(t *testing.T) {
	fixture := newRealPersonAssetFixture(t)
	response, apiErr := fixture.createURL("idem-url-long-name", "https://cdn.example.com/person.png", "Image", strings.Repeat("界", 129))
	require.Nil(t, response)
	require.Equal(t, types.ErrorCodeInvalidAssetRequest, apiErr.GetErrorCode())
	require.Zero(t, fixture.api.createAssetCalls)

	var ledgerCount, assetCount int64
	require.NoError(t, model.DB.Model(&model.APIIdempotencyRecord{}).Count(&ledgerCount).Error)
	require.NoError(t, model.DB.Model(&model.BytePlusAsset{}).Count(&assetCount).Error)
	require.Zero(t, ledgerCount)
	require.Zero(t, assetCount)
}

func TestCreateRealPersonAssetFromMultipartRejectsNameAbove128CodePointsAndCleansUpload(t *testing.T) {
	fixture := newRealPersonAssetFixture(t)
	response, apiErr := fixture.createMultipart("idem-multipart-long-name", pngFixtureBytes(), "Image", strings.Repeat("界", 129))
	require.Nil(t, response)
	require.Equal(t, types.ErrorCodeInvalidAssetRequest, apiErr.GetErrorCode())
	require.Equal(t, 1, fixture.store.putCalls)
	require.Equal(t, 1, fixture.store.deleteCalls)
	require.Zero(t, fixture.api.createAssetCalls)

	var ledgerCount int64
	require.NoError(t, model.DB.Model(&model.APIIdempotencyRecord{}).Count(&ledgerCount).Error)
	require.Zero(t, ledgerCount)
}

func TestNormalizeBytePlusRealPersonAssetNameCountsUnicodeCodePoints(t *testing.T) {
	normalized, apiErr := normalizeBytePlusRealPersonAssetName("  " + strings.Repeat("界", 128) + "  ")
	require.Nil(t, apiErr)
	require.Equal(t, strings.Repeat("界", 128), normalized)

	normalized, apiErr = normalizeBytePlusRealPersonAssetName("   ")
	require.Nil(t, apiErr)
	require.Empty(t, normalized)

	_, apiErr = normalizeBytePlusRealPersonAssetName(strings.Repeat("界", 129))
	require.Equal(t, types.ErrorCodeInvalidAssetRequest, apiErr.GetErrorCode())
}

func TestCreateRealPersonAssetFromMultipartBindsUploadedObjectAfterHashClaim(t *testing.T) {
	fixture := newRealPersonAssetFixture(t)
	fixture.api.afterCreateAsset = func() {
		var ledger model.APIIdempotencyRecord
		require.NoError(t, model.DB.Where("route = ?", "real_person_asset_create").First(&ledger).Error)
		require.Equal(t, model.APIIdempotencyStatusCallingUpstream, ledger.Status)
		var asset model.BytePlusAsset
		require.NoError(t, model.DB.Where("public_id = ?", ledger.ResourcePublicId).First(&asset).Error)
		var object model.BytePlusAssetTempObject
		require.NoError(t, model.DB.Where("asset_id = ?", asset.Id).First(&object).Error)
		require.Equal(t, asset.Id, *object.AssetId)
	}

	response, apiErr := fixture.createMultipart("idem-multipart", pngFixtureBytes(), "Image", "front")
	require.Nil(t, apiErr)
	require.Equal(t, 1, fixture.store.putCalls)
	require.Equal(t, 1, fixture.api.createAssetCalls)

	var asset model.BytePlusAsset
	require.NoError(t, model.DB.Where("public_id = ?", response.ID).First(&asset).Error)
	var object model.BytePlusAssetTempObject
	require.NoError(t, model.DB.Where("asset_id = ?", asset.Id).First(&object).Error)
	require.Equal(t, fixture.profile.UserId, object.UserId)
	require.Equal(t, fixture.profile.ChannelId, object.ChannelId)
}

func TestConcurrentMultipartSameKeyUploadsTwiceButCallsCreateAssetOnceAndDeletesLoser(t *testing.T) {
	fixture := newRealPersonAssetFixture(t)
	upstreamStarted := make(chan struct{})
	releaseUpstream := make(chan struct{})
	fixture.api.afterCreateAsset = func() {
		close(upstreamStarted)
		<-releaseUpstream
	}

	type result struct {
		response *dto.BytePlusAssetResponse
		err      *types.NewAPIError
	}
	firstResult := make(chan result, 1)
	go func() {
		response, apiErr := fixture.createMultipart("idem-race", pngFixtureBytes(), "Image", "front")
		firstResult <- result{response: response, err: apiErr}
	}()
	<-upstreamStarted
	second, secondErr := fixture.createMultipart("idem-race", pngFixtureBytes(), "Image", "front")
	require.Nil(t, second)
	require.NotNil(t, secondErr)
	require.Equal(t, types.ErrorCodeVerificationInProgress, secondErr.GetErrorCode())
	close(releaseUpstream)
	first := <-firstResult
	require.Nil(t, first.err)
	require.NotNil(t, first.response)

	require.Equal(t, 2, fixture.store.putCalls)
	require.Equal(t, 1, fixture.api.createAssetCalls)
	require.Equal(t, 1, fixture.store.deleteCalls)
	var assets int64
	require.NoError(t, model.DB.Model(&model.BytePlusAsset{}).Where("real_person_profile_id = ?", fixture.profile.Id).Count(&assets).Error)
	require.Equal(t, int64(1), assets)
}

func TestMultipartSameKeyDifferentFileHashConflictsAndCleansNewObject(t *testing.T) {
	fixture := newRealPersonAssetFixture(t)
	_, apiErr := fixture.createMultipart("idem-conflict", pngFixtureBytes(), "Image", "front")
	require.Nil(t, apiErr)
	different := append(append([]byte{}, pngFixtureBytes()...), 0x42)
	_, apiErr = fixture.createMultipart("idem-conflict", different, "Image", "front")
	require.NotNil(t, apiErr)
	require.Equal(t, types.ErrorCodeIdempotencyConflict, apiErr.GetErrorCode())
	require.Equal(t, 2, fixture.store.putCalls)
	require.Equal(t, 1, fixture.store.deleteCalls)
	require.Equal(t, 1, fixture.api.createAssetCalls)
}

func TestCreateRealPersonAssetOutcomeUnknownNeverRetriesCreateAsset(t *testing.T) {
	fixture := newRealPersonAssetFixture(t)
	fixture.api.createAssetErr = context.DeadlineExceeded
	_, apiErr := fixture.createURL("idem-unknown", "https://cdn.example.com/person.png", "Image", "front")
	require.NotNil(t, apiErr)
	require.Equal(t, types.ErrorCodeIdempotencyOutcomeUnknown, apiErr.GetErrorCode())
	fixture.api.createAssetErr = nil
	_, apiErr = fixture.createURL("idem-unknown", "https://cdn.example.com/person.png", "Image", "front")
	require.NotNil(t, apiErr)
	require.Equal(t, types.ErrorCodeIdempotencyOutcomeUnknown, apiErr.GetErrorCode())
	require.Equal(t, 1, fixture.api.createAssetCalls)
}

func TestMultipartAssetLocalTransactionRollsBackAssetAndBindingOnLedgerCASFailure(t *testing.T) {
	fixture := newRealPersonAssetFixture(t)
	claim, err := model.ClaimAPIIdempotency(7, "real_person_asset_create", "key-hash", "request-hash", "asset", 100, 50, 1000)
	require.NoError(t, err)
	object, err := model.CreateBytePlusAssetTempObject(model.BytePlusAssetTempObject{UserId: 7, ChannelId: 101, Bucket: "private", ObjectKey: "tmp/rollback", CleanupStatus: model.BytePlusTempObjectCleanupPending, CreatedTime: 100, UpdatedTime: 100})
	require.NoError(t, err)
	profileID := fixture.profile.Id
	asset := model.BytePlusAsset{PublicId: "ast_rollback", UserId: 7, ChannelId: 101, RealPersonProfileId: &profileID, AssetType: "Image", Status: model.BytePlusAssetStatusCreating, CreatedTime: 100, UpdatedTime: 100}
	_, err = model.CreateRealPersonBytePlusAssetForIdempotency(claim.Record.Id, claim.Record.LeaseUpdatedTime+1, asset, &object.Id, 1000, 101)
	require.Error(t, err)

	var assetCount int64
	require.NoError(t, model.DB.Model(&model.BytePlusAsset{}).Where("public_id = ?", asset.PublicId).Count(&assetCount).Error)
	require.Zero(t, assetCount)
	require.NoError(t, model.DB.First(object, object.Id).Error)
	require.Nil(t, object.AssetId)
}

func TestStaleMultipartProcessingUsesOriginalTempObjectAndCleansNewUpload(t *testing.T) {
	fixture := newRealPersonAssetFixture(t)
	file := pngFixtureBytes()
	fileHash := sha256.Sum256(file)
	requestHash, err := hashMultipartAssetRequest(fixture.profile.PublicId, "Image", "front", hex.EncodeToString(fileHash[:]), int64(len(file)))
	require.NoError(t, err)
	keyHash, err := hashAPIIdempotencyKey("idem-resume-multipart")
	require.NoError(t, err)
	claim, err := model.ClaimAPIIdempotency(7, "real_person_asset_create", keyHash, requestHash, "asset", 100, 50, fixture.now()+3600)
	require.NoError(t, err)
	original, err := model.CreateBytePlusAssetTempObject(model.BytePlusAssetTempObject{UserId: 7, ChannelId: 101, Bucket: "private", ObjectKey: "tmp/original", ContentSHA256: hex.EncodeToString(fileHash[:]), SizeBytes: int64(len(file)), MimeType: "image/png", CleanupStatus: model.BytePlusTempObjectCleanupPending, CreatedTime: 100, UpdatedTime: 100})
	require.NoError(t, err)
	profileID := fixture.profile.Id
	asset := model.BytePlusAsset{PublicId: "ast_existing", UserId: 7, ChannelId: 101, RealPersonProfileId: &profileID, AssetType: "Image", Name: "front", Status: model.BytePlusAssetStatusCreating, CreatedTime: 100, UpdatedTime: 100}
	_, err = model.CreateRealPersonBytePlusAssetForIdempotency(claim.Record.Id, claim.Record.LeaseUpdatedTime, asset, &original.Id, fixture.now()+3600, 101)
	require.NoError(t, err)

	response, apiErr := fixture.createMultipart("idem-resume-multipart", file, "Image", "front")
	require.Nil(t, apiErr)
	require.Equal(t, "ast_existing", response.ID)
	require.Contains(t, fixture.api.lastAssetCreate.URL, "tmp%2Foriginal")
	require.Equal(t, 1, fixture.store.deleteCalls)
	require.NotContains(t, fixture.store.deleteKeys, "tmp/original")

	var assets int64
	require.NoError(t, model.DB.Model(&model.BytePlusAsset{}).Where("real_person_profile_id = ?", fixture.profile.Id).Count(&assets).Error)
	require.Equal(t, int64(1), assets)
}

func TestBytePlusAssetResponseKeepsVirtualModerationAndAddsRealPersonURI(t *testing.T) {
	virtual := responseFromBytePlusAsset(&model.BytePlusAsset{PublicId: "ast_virtual", AssetType: "Image", Status: "Active", ModerationStrategy: "Skip"})
	require.NotNil(t, virtual.Moderation)
	require.Equal(t, "Skip", virtual.Moderation.Strategy)

	profileID := int64(9)
	realPerson := responseFromBytePlusAsset(&model.BytePlusAsset{PublicId: "ast_real", RealPersonProfileId: &profileID, Name: "front", AssetType: "Image", Status: "Processing"})
	require.Nil(t, realPerson.Moderation)
	require.Equal(t, "asset://ast_real", realPerson.AssetURI)
}

type realPersonAssetFixture struct {
	*realPersonServiceFixture
	t       *testing.T
	profile *model.BytePlusRealPersonProfile
	store   *fakeUploadStore
}

func newRealPersonAssetFixture(t *testing.T) *realPersonAssetFixture {
	t.Helper()
	base := newRealPersonServiceFixture(t)
	profile := seedActiveRealPersonProfile(t, 7, 101, "rph_owner")
	store := uploadTestStore()
	oldStoreFactory, oldAssetID := bytePlusTempObjectStoreFactory, bytePlusAssetPublicID
	var assetSequence atomic.Int64
	bytePlusTempObjectStoreFactory = func(BytePlusCredentials) (BytePlusTempObjectStore, error) { return store, nil }
	bytePlusAssetPublicID = func() (string, error) { return fmt.Sprintf("ast_real_%d", assetSequence.Add(1)), nil }
	t.Cleanup(func() {
		bytePlusTempObjectStoreFactory = oldStoreFactory
		bytePlusAssetPublicID = oldAssetID
	})
	return &realPersonAssetFixture{realPersonServiceFixture: base, t: t, profile: profile, store: store}
}

func seedActiveRealPersonProfile(t *testing.T, userID, channelID int, publicID string) *model.BytePlusRealPersonProfile {
	t.Helper()
	groupID := "group-" + publicID
	profile := &model.BytePlusRealPersonProfile{PublicId: publicID, UserId: userID, Name: publicID, ChannelId: channelID, UpstreamGroupId: &groupID, Status: model.BytePlusRealPersonProfileStatusActive, CreatedTime: 1000, UpdatedTime: 1000}
	require.NoError(t, model.DB.Create(profile).Error)
	return profile
}

func (f *realPersonAssetFixture) createURL(key, sourceURL, assetType, name string) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
	return CreateBytePlusRealPersonAssetFromURL(context.Background(), 7, f.profile.PublicId, key, dto.BytePlusRealPersonAssetCreateRequest{URL: sourceURL, AssetType: assetType, Name: name})
}

func (f *realPersonAssetFixture) createMultipart(key string, file []byte, assetType, name string) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
	body, contentType := buildMultipartBody(f.t, []multipartTestPart{{Name: "file", Filename: "portrait.png", ContentType: "image/png", Body: file}, {Name: "asset_type", Body: []byte(assetType)}, {Name: "name", Body: []byte(name)}})
	request := httptest.NewRequest(http.MethodPost, "/v1/real-persons/"+f.profile.PublicId+"/assets", body)
	request.Header.Set("Content-Type", contentType)
	return CreateBytePlusRealPersonAssetFromMultipart(context.Background(), 7, f.profile.PublicId, key, request)
}
```

并发 multipart 测试使用两个独立不可 seek request body 和同一 key；断言创建两个临时对象、只绑定一个素材、只调用一次 `CreateAsset`，另一个对象执行删除或保留可领取 cleanup 状态。

- [ ] **Step 2: 运行素材创建测试并确认 RED**

Run: `go test ./service ./dto ./model -run 'RealPersonAsset|BytePlusAssetResponse|MultipartSameKey' -count=1`

Expected: FAIL，缺少真人素材 DTO、服务、统一响应和 temp-object 绑定事务。

- [ ] **Step 3: 扩展素材 DTO，保持虚拟 JSON 原样**

```go
type BytePlusRealPersonAssetCreateRequest struct {
	URL       string `json:"url"`
	AssetType string `json:"asset_type"`
	Name      string `json:"name"`
}

type BytePlusAssetResponse struct {
	ID          string                       `json:"id"`
	Object      string                       `json:"object"`
	AssetType   string                       `json:"asset_type"`
	Status      string                       `json:"status"`
	Moderation  *BytePlusAssetModeration     `json:"moderation,omitempty"`
	Name        string                       `json:"name,omitempty"`
	AssetURI    string                       `json:"asset_uri,omitempty"`
	FailureCode string                       `json:"failure_code,omitempty"`
	CreatedAt   int64                        `json:"created_at"`
}

type BytePlusRealPersonAssetListResponse struct {
	Object    string                  `json:"object"`
	Data      []BytePlusAssetResponse `json:"data"`
	HasMore   bool                    `json:"has_more"`
	NextAfter string                  `json:"next_after,omitempty"`
}
```

`responseFromBytePlusAsset` 对 `RealPersonProfileId == nil` 显式设置 moderation 指针，保持现有 JSON；真人素材设置 `AssetURI="asset://"+PublicId`、`Name/FailureCode` 并省略 moderation。

- [ ] **Step 4: 添加赢家素材创建与临时对象绑定事务**

`model/byteplus_asset.go` 增加：

```go
func CreateRealPersonBytePlusAssetForIdempotency(recordID, leaseUpdatedTime int64, asset BytePlusAsset, tempObjectID *int64, signedURLExpiresAt int64, now int64) (*BytePlusAsset, error) {
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&asset).Error; err != nil {
			return err
		}
		if tempObjectID != nil {
			result := tx.Model(&BytePlusAssetTempObject{}).
				Where("id = ? AND asset_id IS NULL AND cleanup_status = ?", *tempObjectID, BytePlusTempObjectCleanupPending).
				Updates(map[string]any{
					"asset_id": asset.Id,
					"signed_url_expires_at": signedURLExpiresAt,
					"updated_time": now,
				})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return errors.New("byteplus temp object is not bindable")
			}
		}
		return BindAPIIdempotencyResourceTx(tx, recordID, leaseUpdatedTime, asset.PublicId, now)
	})
	if err != nil {
		return nil, err
	}
	return &asset, nil
}

func GetBytePlusAssetTempObjectByAssetID(assetID int64) (*BytePlusAssetTempObject, error)
```

URL 创建传 `tempObjectID=nil`；multipart 只有新 ledger owner 把本次上传的 temp object 传入本函数。素材必须写入 `UserId=profile.UserId`、`ChannelId=profile.ChannelId`、`RealPersonProfileId=&profile.Id`、`AssetGroupId=0`、`ModerationStrategy=Default` 和 `Creating`。ledger CAS、素材创建与可选 temp-object 绑定任一失败时事务整体回滚，绝不能存在“素材已创建但 ledger 未绑定”或“temp object 已绑定但 ledger 仍为空”的窗口。

- [ ] **Step 5: 实现 URL 与 multipart 的共同上游创建核心**

服务入口和内部参数：

```go
const bytePlusRealPersonAssetNameMaxRunes = 128

func normalizeBytePlusRealPersonAssetName(raw string) (string, *types.NewAPIError) {
	name := strings.TrimSpace(raw)
	if name == "" {
		return "", nil
	}
	if utf8.RuneCountInString(name) > bytePlusRealPersonAssetNameMaxRunes {
		return "", types.InitOpenAIError(types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	}
	return name, nil
}

type realPersonAssetSource struct {
	URL               string
	Uploaded          *BytePlusUploadedAsset
	RequestHash       string
}

func CreateBytePlusRealPersonAssetFromURL(ctx context.Context, userID int, personID, idempotencyKey string, request dto.BytePlusRealPersonAssetCreateRequest) (*dto.BytePlusAssetResponse, *types.NewAPIError)
func CreateBytePlusRealPersonAssetFromMultipart(ctx context.Context, userID int, personID, idempotencyKey string, request *http.Request) (*dto.BytePlusAssetResponse, *types.NewAPIError)
func createBytePlusRealPersonAsset(ctx context.Context, profile *model.BytePlusRealPersonProfile, channel *model.Channel, creds BytePlusCredentials, idempotencyKey string, source realPersonAssetSource) (*dto.BytePlusAssetResponse, *types.NewAPIError)
```

URL 入口先调用 `normalizeBytePlusRealPersonAssetName`，在任何档案/渠道查询、ledger 写入或外部调用前拒绝超过 128 个 Unicode code point 的名称；multipart 入口在 Task 6 上传并得到完整 metadata 后调用同一函数，若显式名称超限则立即执行 `deleteOrQueueBytePlusTempObject`，不得写 ledger、创建本地素材或调用 `CreateAsset`。multipart 缺省名称继续使用 Task 6 的脱敏文件名，并按 Unicode code point 安全截断到 128；URL 缺省名称允许为空。规范化后的名称同时进入 request hash、素材持久化和上游请求。

名称通过后，两个公开入口用 `(user_id, person_id)` 读取档案并要求 `Active`，再只加载其固定渠道和 `ValidateRealPersonAssets`。URL 入口使用现有 `validateBytePlusAssetSourceURL`，规范哈希包含 person ID、URL、type 和 name，但完整 URL 不写任何 DB 字段；multipart 入口用最终 SHA-256/字节数组合哈希。

`createBytePlusRealPersonAsset` 的新 owner 顺序必须是：生成 `ast_` → 调用 `CreateRealPersonBytePlusAssetForIdempotency` 在同一事务创建素材、绑定可选 temp object、绑定 ledger resource → 为 multipart 生成 12h internal GET URL（URL 不持久化）→ `MarkAPIIdempotencyCallingUpstream` → 调用 `CreateAsset`，固定 GroupId=`*profile.UpstreamGroupId`、渠道 ProjectName、`Moderation.Strategy=Default` → 持久化 upstream AssetId/`Processing` → 保存安全响应并 Complete。

`Resume` 必须按 ledger 的 `resource_public_id` 加载原素材：URL 请求继续使用本次同 hash URL；multipart 请求立即删除/排队本次新上传对象，再通过 `GetBytePlusAssetTempObjectByAssetID` 找到原素材绑定的对象并重新生成 internal GET URL。若原绑定对象缺失、已清理或无法签名，返回稳定存储错误且不创建新素材；绝不能把本次新对象改绑到原素材。只有 ledger resource 为空的 `Owner` 可以创建素材。

`Conflict/Replay/InProgress/OutcomeUnknown` 均不得调用 `CreateAsset`。multipart 非 owner 必须对本次新 temp object 调 `deleteOrQueueBytePlusTempObject`；即使 Replay 返回已存在素材，也不能保留新对象。transport/超时等无法确认的调用错误把账本转 `OutcomeUnknown`、素材转 `Failed` 且 `FailureCode=idempotency_outcome_unknown`；收到明确上游响应的失败才可记录安全 `Failed` 响应。

- [ ] **Step 6: 运行素材创建与虚拟回归并确认 GREEN**

Run: `gofmt -w dto/byteplus_real_person.go dto/byteplus_asset.go dto/byteplus_asset_test.go service/byteplus_real_person_asset.go service/byteplus_real_person_asset_test.go service/byteplus_asset.go service/byteplus_asset_test.go model/byteplus_asset.go model/byteplus_asset_temp_object.go`

Run: `go test ./model ./dto ./service -run 'RealPersonAsset|BytePlusAssetResponse|MultipartSameKey|BytePlusAssetCreate' -race -count=1`

Expected: PASS；同真人多个素材可创建，名称按 Unicode code point 执行 128 上限，multipart 无效名称的已上传对象被删除/排队，冲突对象被删除/排队，URL 不落库，现有虚拟素材 moderation JSON 和创建链路保持不变。

- [ ] **Step 7: 提交真人素材创建**

```bash
git add dto/byteplus_real_person.go dto/byteplus_asset.go dto/byteplus_asset_test.go service/byteplus_real_person_asset.go service/byteplus_real_person_asset_test.go service/byteplus_asset.go service/byteplus_asset_test.go model/byteplus_asset.go model/byteplus_asset_temp_object.go
git commit -m "Create reusable real-person assets from URLs or customer files" -m "Constraint: Multipart request identity is unknowable until the complete file hash has streamed through TOS" -m "Rejected: Creating the asset row before upload hashing | concurrent conflicts would create duplicate local and upstream assets" -m "Confidence: high" -m "Scope-risk: broad" -m "Directive: Every multipart non-owner must clean its newly uploaded object before replaying the winning response" -m "Tested: URL safety, no URL persistence, stream binding, concurrent replay, conflict cleanup, response compatibility, and outcome-unknown handling under race detection"
```

### Task 8: 增加真人素材列表、详情兼容与 tombstone-first 删除

**Files:**
- Modify: `model/byteplus_asset.go`
- Modify: `model/byteplus_asset_test.go`
- Modify: `service/byteplus_real_person_asset.go`
- Modify: `service/byteplus_real_person_asset_test.go`
- Modify: `service/byteplus_asset.go`
- Modify: `service/byteplus_asset_test.go`

- [ ] **Step 1: 写出分页、删除幂等、404 和状态轮询隔离测试**

```go
func TestListRealPersonAssetsScopesUserAndProfileAndHidesDeleted(t *testing.T) {
	fixture := newRealPersonAssetFixture(t)
	otherProfile := seedActiveRealPersonProfile(t, 7, 101, "rph_other_profile")
	crossUserProfile := seedActiveRealPersonProfile(t, 8, 101, "rph_cross_user")

	seedRealPersonAssetRow(t, "ast_new", 7, fixture.profile.Id, 101, "Image", model.BytePlusAssetStatusActive, "upstream-new", 300, "")
	seedRealPersonAssetRow(t, "ast_failed", 7, fixture.profile.Id, 101, "Video", model.BytePlusAssetStatusFailed, "upstream-failed", 200, "face_mismatch")
	seedRealPersonAssetRow(t, "ast_deleted", 7, fixture.profile.Id, 101, "Image", model.BytePlusAssetStatusDeleted, "upstream-deleted", 400, "")
	seedRealPersonAssetRow(t, "ast_other_profile", 7, otherProfile.Id, 101, "Image", model.BytePlusAssetStatusActive, "upstream-other", 500, "")
	seedRealPersonAssetRow(t, "ast_cross_user", 8, crossUserProfile.Id, 101, "Image", model.BytePlusAssetStatusActive, "upstream-cross", 600, "")

	first, apiErr := ListBytePlusRealPersonAssets(context.Background(), 7, fixture.profile.PublicId, 1, "")
	require.Nil(t, apiErr)
	require.Len(t, first.Data, 1)
	require.Equal(t, "ast_new", first.Data[0].ID)
	require.True(t, first.HasMore)
	require.Equal(t, "ast_new", first.NextAfter)

	second, apiErr := ListBytePlusRealPersonAssets(context.Background(), 7, fixture.profile.PublicId, 10, first.NextAfter)
	require.Nil(t, apiErr)
	require.Len(t, second.Data, 1)
	require.Equal(t, "ast_failed", second.Data[0].ID)
	require.False(t, second.HasMore)

	raw, err := common.Marshal(second)
	require.NoError(t, err)
	require.NotContains(t, string(raw), "ast_deleted")
	require.NotContains(t, string(raw), "upstream-")
	require.NotContains(t, string(raw), "group-")
}

func TestListRealPersonAssetsReturnsFailedWithStableFailureCode(t *testing.T) {
	fixture := newRealPersonAssetFixture(t)
	seedRealPersonAssetRow(t, "ast_failed_public", 7, fixture.profile.Id, 101, "Image", model.BytePlusAssetStatusFailed, "upstream-failed", 100, "face_mismatch")

	result, apiErr := ListBytePlusRealPersonAssets(context.Background(), 7, fixture.profile.PublicId, 20, "")
	require.Nil(t, apiErr)
	require.Len(t, result.Data, 1)
	require.Equal(t, model.BytePlusAssetStatusFailed, result.Data[0].Status)
	require.Equal(t, "face_mismatch", result.Data[0].FailureCode)
	require.Equal(t, "asset://ast_failed_public", result.Data[0].AssetURI)
}

func TestListRealPersonAssetsRejectsUnknownCursor(t *testing.T) {
	fixture := newRealPersonAssetFixture(t)
	_, apiErr := ListBytePlusRealPersonAssets(context.Background(), 7, fixture.profile.PublicId, 20, "ast_missing")
	require.NotNil(t, apiErr)
	require.Equal(t, types.ErrorCodeInvalidAssetRequest, apiErr.GetErrorCode())
	require.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
}

func TestListRealPersonAssetsUsesStableTieBreakerAndRejectsOutOfScopeCursors(t *testing.T) {
	fixture := newRealPersonAssetFixture(t)
	otherProfile := seedActiveRealPersonProfile(t, 7, 101, "rph_cursor_other_profile")
	crossUserProfile := seedActiveRealPersonProfile(t, 8, 101, "rph_cursor_cross_user")

	lowerID := seedRealPersonAssetRow(t, "ast_tie_lower", 7, fixture.profile.Id, 101, "Image", model.BytePlusAssetStatusActive, "upstream-tie-lower", 500, "")
	higherID := seedRealPersonAssetRow(t, "ast_tie_higher", 7, fixture.profile.Id, 101, "Image", model.BytePlusAssetStatusActive, "upstream-tie-higher", 500, "")
	require.Greater(t, higherID.Id, lowerID.Id)

	first, apiErr := ListBytePlusRealPersonAssets(context.Background(), 7, fixture.profile.PublicId, 1, "")
	require.Nil(t, apiErr)
	require.Equal(t, higherID.PublicId, first.Data[0].ID)
	require.Equal(t, higherID.PublicId, first.NextAfter)

	second, apiErr := ListBytePlusRealPersonAssets(context.Background(), 7, fixture.profile.PublicId, 1, first.NextAfter)
	require.Nil(t, apiErr)
	require.Equal(t, lowerID.PublicId, second.Data[0].ID)

	deleted := seedRealPersonAssetRow(t, "ast_cursor_deleted", 7, fixture.profile.Id, 101, "Image", model.BytePlusAssetStatusDeleted, "upstream-cursor-deleted", 400, "")
	other := seedRealPersonAssetRow(t, "ast_cursor_other", 7, otherProfile.Id, 101, "Image", model.BytePlusAssetStatusActive, "upstream-cursor-other", 400, "")
	cross := seedRealPersonAssetRow(t, "ast_cursor_cross", 8, crossUserProfile.Id, 101, "Image", model.BytePlusAssetStatusActive, "upstream-cursor-cross", 400, "")
	for _, cursor := range []string{deleted.PublicId, other.PublicId, cross.PublicId} {
		_, apiErr := ListBytePlusRealPersonAssets(context.Background(), 7, fixture.profile.PublicId, 20, cursor)
		require.NotNil(t, apiErr)
		require.Equal(t, types.ErrorCodeInvalidAssetRequest, apiErr.GetErrorCode())
		require.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
	}
}

func TestDeleteBytePlusAssetMarksDeletingBeforeUpstreamCall(t *testing.T) {
	fixture := newRealPersonAssetFixture(t)
	asset := seedRealPersonAssetRow(t, "ast_delete_first", 7, fixture.profile.Id, 101, "Image", model.BytePlusAssetStatusActive, "upstream-delete-first", 100, "")

	fixture.api.afterDeleteAsset = func() {
		var stored model.BytePlusAsset
		require.NoError(t, model.DB.First(&stored, asset.Id).Error)
		require.Equal(t, model.BytePlusAssetStatusDeleting, stored.Status)
		require.Zero(t, stored.DeletedTime)
	}

	apiErr := DeleteBytePlusAsset(context.Background(), 7, asset.PublicId)
	require.Nil(t, apiErr)
	require.Equal(t, 1, fixture.api.deleteAssetCalls)

	var stored model.BytePlusAsset
	require.NoError(t, model.DB.First(&stored, asset.Id).Error)
	require.Equal(t, model.BytePlusAssetStatusDeleted, stored.Status)
	require.Positive(t, stored.DeletedTime)
}

func TestDeleteBytePlusAssetRepeatedCallsReturnSuccessWithoutDuplicateDelete(t *testing.T) {
	fixture := newRealPersonAssetFixture(t)
	asset := seedRealPersonAssetRow(t, "ast_delete_repeat", 7, fixture.profile.Id, 101, "Image", model.BytePlusAssetStatusActive, "upstream-delete-repeat", 100, "")

	started := make(chan struct{})
	release := make(chan struct{})
	fixture.api.afterDeleteAsset = func() {
		close(started)
		<-release
	}

	firstDone := make(chan *types.NewAPIError, 1)
	go func() {
		firstDone <- DeleteBytePlusAsset(context.Background(), 7, asset.PublicId)
	}()

	<-started
	secondErr := DeleteBytePlusAsset(context.Background(), 7, asset.PublicId)
	require.Nil(t, secondErr)
	require.Equal(t, 1, fixture.api.deleteAssetCalls)

	close(release)
	require.Nil(t, <-firstDone)
	require.Nil(t, DeleteBytePlusAsset(context.Background(), 7, asset.PublicId))
	require.Equal(t, 1, fixture.api.deleteAssetCalls)
}

func TestDeleteBytePlusAssetTreatsUpstreamNotFoundAsDeleted(t *testing.T) {
	fixture := newRealPersonAssetFixture(t)
	asset := seedRealPersonAssetRow(t, "ast_delete_missing", 7, fixture.profile.Id, 101, "Image", model.BytePlusAssetStatusActive, "upstream-missing", 100, "")
	fixture.api.deleteAssetErr = &BytePlusAPIError{StatusCode: http.StatusNotFound, RequestID: "req-delete-missing"}

	apiErr := DeleteBytePlusAsset(context.Background(), 7, asset.PublicId)
	require.Nil(t, apiErr)

	var stored model.BytePlusAsset
	require.NoError(t, model.DB.First(&stored, asset.Id).Error)
	require.Equal(t, model.BytePlusAssetStatusDeleted, stored.Status)
	require.Positive(t, stored.DeletedTime)
}

func TestDeleteBytePlusAssetFailureKeepsDeletingAndSchedulesRetry(t *testing.T) {
	fixture := newRealPersonAssetFixture(t)
	asset := seedRealPersonAssetRow(t, "ast_delete_retry", 7, fixture.profile.Id, 101, "Image", model.BytePlusAssetStatusActive, "upstream-retry", 100, "")
	fixture.api.deleteAssetErr = context.DeadlineExceeded

	apiErr := DeleteBytePlusAsset(context.Background(), 7, asset.PublicId)
	require.Nil(t, apiErr)

	var stored model.BytePlusAsset
	require.NoError(t, model.DB.First(&stored, asset.Id).Error)
	require.Equal(t, model.BytePlusAssetStatusDeleting, stored.Status)
	require.Equal(t, 1, stored.DeleteAttempts)
	require.Greater(t, stored.NextDeleteAt, fixture.now())
	require.Zero(t, stored.DeleteLeaseUpdatedTime)
	require.Zero(t, stored.DeletedTime)
}

func TestDeleteBytePlusAssetUnavailableBoundChannelKeepsTombstoneWithoutFailover(t *testing.T) {
	fixture := newRealPersonAssetFixture(t)
	asset := seedRealPersonAssetRow(t, "ast_delete_disabled", 7, fixture.profile.Id, 101, "Image", model.BytePlusAssetStatusActive, "upstream-disabled", 100, "")
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", 101).Update("status", common.ChannelStatusManuallyDisabled).Error)

	apiErr := DeleteBytePlusAsset(context.Background(), 7, asset.PublicId)
	require.Nil(t, apiErr)
	require.Zero(t, fixture.api.deleteAssetCalls)

	var stored model.BytePlusAsset
	require.NoError(t, model.DB.First(&stored, asset.Id).Error)
	require.Equal(t, model.BytePlusAssetStatusDeleting, stored.Status)
	require.Greater(t, stored.NextDeleteAt, fixture.now())
	require.Equal(t, 101, stored.ChannelId)
}

func TestGetBytePlusAssetReturnsDeletingWithoutPollingAndDeletedAsNotFound(t *testing.T) {
	fixture := newRealPersonAssetFixture(t)
	deleting := seedRealPersonAssetRow(t, "ast_deleting_detail", 7, fixture.profile.Id, 101, "Image", model.BytePlusAssetStatusDeleting, "upstream-deleting", 100, "")
	deleted := seedRealPersonAssetRow(t, "ast_deleted_detail", 7, fixture.profile.Id, 101, "Image", model.BytePlusAssetStatusDeleted, "upstream-deleted", 90, "")

	got, apiErr := GetBytePlusAsset(context.Background(), 7, deleting.PublicId)
	require.Nil(t, apiErr)
	require.Equal(t, model.BytePlusAssetStatusDeleting, got.Status)
	require.Zero(t, fixture.api.getAssetCalls)

	_, apiErr = GetBytePlusAsset(context.Background(), 7, deleted.PublicId)
	require.NotNil(t, apiErr)
	require.Equal(t, types.ErrorCodeAssetNotFound, apiErr.GetErrorCode())
	require.Equal(t, http.StatusNotFound, apiErr.StatusCode)
	require.Zero(t, fixture.api.getAssetCalls)
}

func seedRealPersonAssetRow(t *testing.T, publicID string, userID int, profileID int64, channelID int, assetType, status, upstreamAssetID string, createdTime int64, failureCode string) model.BytePlusAsset {
	t.Helper()
	asset := model.BytePlusAsset{
		PublicId: publicID, UserId: userID, RealPersonProfileId: &profileID,
		ChannelId: channelID, AssetType: assetType, Name: publicID,
		UpstreamAssetId: upstreamAssetID, Status: status, FailureCode: failureCode,
		CreatedTime: createdTime, UpdatedTime: createdTime,
	}
	require.NoError(t, model.DB.Create(&asset).Error)
	return asset
}
```

`MarksDeletingBeforeUpstreamCall` 的 fake client 在调用时直接查询 DB，断言状态已经是 `Deleting`；重复删除并发测试断言公开结果都成功且当前请求最多一个上游删除 owner。

- [ ] **Step 2: 运行列表/删除测试并确认 RED**

Run: `go test ./model ./service -run 'ListRealPersonAssets|DeleteBytePlusAsset|BytePlusAssetDeleting|BytePlusAssetDeleted' -count=1`

Expected: FAIL，缺少分页和删除租约/CAS。

- [ ] **Step 3: 添加本地列表和删除 CAS**

`model/byteplus_asset.go`：

```go
func ListBytePlusAssetsForRealPerson(userID int, profileID int64, limit int, afterPublicID string) ([]BytePlusAsset, bool, error)
func BeginBytePlusAssetDeletion(userID int, publicID string, now int64) (*BytePlusAsset, bool, error)
func ClaimBytePlusAssetDeletion(assetID int64, now, staleBefore int64) (*BytePlusAsset, bool, error)
func CompleteBytePlusAssetDeletion(assetID int64, leaseUpdatedTime int64, now int64) (bool, error)
func RetryBytePlusAssetDeletion(assetID int64, leaseUpdatedTime int64, nextAttempt int64, now int64) (bool, error)
```

`ListBytePlusAssetsForRealPerson` 的 cursor 必须属于同一 `user_id + real_person_profile_id`，且 cursor 行不能是 `Deleted`；缺失、跨用户、跨档案或 Deleted cursor 都返回模型层的稳定 `ErrBytePlusAssetCursorNotFound`，service 统一映射为 400 `invalid_asset_request`。查询必须使用以下边界和顺序，不能只按 `created_time` 排序：

```go
query := DB.Where(
	"user_id = ? AND real_person_profile_id = ? AND status <> ?",
	userID, profileID, BytePlusAssetStatusDeleted,
)
if afterPublicID != "" {
	var cursor BytePlusAsset
	err := query.Where("public_id = ?", afterPublicID).First(&cursor).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, ErrBytePlusAssetCursorNotFound
	}
	if err != nil {
		return nil, false, err
	}
	query = query.Where(
		"created_time < ? OR (created_time = ? AND id < ?)",
		cursor.CreatedTime, cursor.CreatedTime, cursor.Id,
	)
}
err := query.Order("created_time DESC, id DESC").Limit(limit + 1).Find(&assets).Error
```

`Begin` 先按 user/public ID 查询以保持跨用户 404，然后执行：

```go
result := DB.Model(&BytePlusAsset{}).
	Where("id = ? AND status NOT IN ?", asset.Id, []string{BytePlusAssetStatusDeleting, BytePlusAssetStatusDeleted}).
	Updates(map[string]any{
		"status": BytePlusAssetStatusDeleting,
		"next_delete_at": now,
		"delete_lease_updated_time": int64(0),
		"updated_time": now,
	})
```

若原状态已是 `Deleting/Deleted`，返回现有行和 `changed=false`；`Complete` 只从当前 lease 的 `Deleting` 转 `Deleted` 并写 `deleted_time`；`Retry` 保持 `Deleting`、增加 attempts、清 lease、写退避时间。

- [ ] **Step 4: 实现列表、详情和 opportunistic 删除**

```go
func ListBytePlusRealPersonAssets(ctx context.Context, userID int, personID string, limit int, after string) (*dto.BytePlusRealPersonAssetListResponse, *types.NewAPIError)
func DeleteBytePlusAsset(ctx context.Context, userID int, publicID string) *types.NewAPIError
```

列表先读取 `(user_id, person_id)` 档案，再按 `(user_id, real_person_profile_id)` 查询，默认排除 `Deleted`，严格按 `(created_time DESC, id DESC)` 读取 `limit+1`。删除对虚拟与真人 `BytePlusAsset` 共用：先 `Begin`，无 upstream ID 直接 Complete；有 ID 时抢删除 lease，加载原绑定渠道而不漂移，调用 `DeleteAsset`，成功或 `isBytePlusNotFound` 都 Complete；其他错误 Retry 并仍向 handler 返回 nil，使公开 DELETE 保持 204 tombstone 接受语义。

修改现有 `GetBytePlusAsset`：`Deleted` 与跨用户统一 404；`Deleting` 直接返回当前素材对象且不调用 `GetAsset`；`Creating/Processing/Active/Failed` 保持既有语义。

- [ ] **Step 5: 运行删除、列表和现有详情测试并确认 GREEN**

Run: `gofmt -w model/byteplus_asset.go model/byteplus_asset_test.go service/byteplus_real_person_asset.go service/byteplus_real_person_asset_test.go service/byteplus_asset.go service/byteplus_asset_test.go`

Run: `go test ./model ./service -run 'ListRealPersonAssets|DeleteBytePlusAsset|BytePlusAssetDeleting|BytePlusAssetDeleted|GetBytePlusAsset' -race -count=1`

Expected: PASS；204 所需的本地 tombstone 在上游调用前生效，Deleting 不再被普通轮询覆盖，Deleted 不在列表/详情出现。

- [ ] **Step 6: 提交 tombstone 删除**

```bash
git add model/byteplus_asset.go model/byteplus_asset_test.go service/byteplus_real_person_asset.go service/byteplus_real_person_asset_test.go service/byteplus_asset.go service/byteplus_asset_test.go
git commit -m "Stop deleted assets from entering new Seedance work immediately" -m "Constraint: Upstream deletion may be slow or temporarily unavailable while repeated DELETE must remain idempotent" -m "Rejected: Delete upstream first | a concurrent video request could reuse the asset before the response returns" -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: Deleting is a local tombstone and must remain outside ordinary status polling" -m "Tested: Ownership, list pagination, tombstone-before-call, repeat/concurrent delete, upstream not-found, retry scheduling, and detail compatibility"
```

### Task 9: 在所有节点运行认证、状态、删除、清理和幂等恢复协调器

**Files:**
- Create: `service/byteplus_real_person_jobs.go`
- Create: `service/byteplus_real_person_jobs_test.go`
- Create: `pkg/perf_metrics/byteplus_real_person.go`
- Create: `pkg/perf_metrics/byteplus_real_person_test.go`
- Modify: `pkg/perf_metrics/prometheus.go`
- Modify: `pkg/perf_metrics/prometheus_test.go`
- Modify: `model/api_idempotency.go`
- Modify: `model/api_idempotency_test.go`
- Modify: `model/byteplus_real_person.go`
- Modify: `model/byteplus_asset.go`
- Modify: `model/byteplus_asset_temp_object.go`
- Modify: `service/byteplus_real_person.go`
- Modify: `service/byteplus_real_person_asset.go`
- Modify: `main.go:137-180`

- [ ] **Step 1: 写出非 master、多节点租约、终态不回退和清理兜底测试**

```go
func TestRunBytePlusRealPersonJobsOnceProcessesRowsOnNonMasterNode(t *testing.T) {
	oldMaster := common.IsMasterNode
	common.IsMasterNode = false
	t.Cleanup(func() { common.IsMasterNode = oldMaster })
	deps := installBytePlusRealPersonJobTestDeps(t)
	seedDueVerificationAssetDeletionAndCleanupRows(t)

	result := RunBytePlusRealPersonJobsOnce(context.Background(), 1_000, 20)
	require.NoError(t, result.Err)
	require.Positive(t, result.Processed)
	require.Positive(t, deps.client.resultCalls)
	require.Positive(t, deps.client.deleteAssetCalls)
	require.Positive(t, deps.store.deleteCalls)
}

func TestTwoJobRunnersClaimEachRowAtMostOnce(t *testing.T) {
	deps := installBytePlusRealPersonJobTestDeps(t)
	seedDueVerificationAssetDeletionAndCleanupRows(t)
	var wg sync.WaitGroup
	results := make(chan BytePlusRealPersonJobResult, 2)
	for index := 0; index < 2; index++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			results <- RunBytePlusRealPersonJobsOnce(context.Background(), 1_000, 20)
		}()
	}
	wg.Wait()
	close(results)
	for result := range results {
		require.NoError(t, result.Err)
	}
	requireJobFakesSawNoDuplicateSideEffects(t, deps)
}

func TestExpiredCallingUpstreamIsMarkedOutcomeUnknownWithoutExternalCall(t *testing.T) {
	deps := installBytePlusRealPersonJobTestDeps(t)
	profile := seedActiveRealPersonProfile(t, 7, 101, "rph_unknown")
	asset := seedRealPersonAssetRow(t, "ast_unknown", 7, profile.Id, 101, "Image", model.BytePlusAssetStatusCreating, "", 100, "")
	require.NoError(t, model.DB.Create(&model.APIIdempotencyRecord{
		UserId: 7, Route: "real_person_asset_create", KeyHash: strings.Repeat("a", 64), RequestHash: strings.Repeat("b", 64),
		Status: model.APIIdempotencyStatusCallingUpstream, ResourceType: "asset", ResourcePublicId: asset.PublicId,
		LeaseUpdatedTime: 100, UpstreamCallStartedAt: 100, ExpiresAt: 10_000, CreatedTime: 100, UpdatedTime: 100,
	}).Error)

	result := RunBytePlusRealPersonJobsOnce(context.Background(), 1_000, 20)
	require.NoError(t, result.Err)
	require.Equal(t, 1, result.Processed)

	var record model.APIIdempotencyRecord
	require.NoError(t, model.DB.Where("resource_public_id = ?", asset.PublicId).First(&record).Error)
	require.Equal(t, model.APIIdempotencyStatusOutcomeUnknown, record.Status)
	require.NoError(t, model.DB.First(&asset, asset.Id).Error)
	require.Equal(t, model.BytePlusAssetStatusFailed, asset.Status)
	require.Equal(t, string(types.ErrorCodeIdempotencyOutcomeUnknown), asset.FailureCode)
	require.Zero(t, deps.client.createCalls)
	require.Zero(t, deps.client.createAssetCalls)
	require.Zero(t, deps.client.getAssetCalls)
	require.Zero(t, deps.client.deleteAssetCalls)
}

func TestExpiredVerificationCallingUpstreamTargetsExactSessionWithoutOverwritingNewCurrentSession(t *testing.T) {
	deps := installBytePlusRealPersonJobTestDeps(t)
	profile := model.BytePlusRealPersonProfile{
		PublicId: "rph_reverify_unknown", UserId: 7, Name: "Person", ChannelId: 101,
		Status: model.BytePlusRealPersonProfileStatusPendingVerification, CreatedTime: 100, UpdatedTime: 100,
	}
	require.NoError(t, model.DB.Create(&profile).Error)
	oldSession := model.BytePlusVisualValidationSession{
		PublicId: "rvs_old_unknown", ProfileId: profile.Id, CallbackTokenHash: strings.Repeat("1", 64),
		Status: model.BytePlusVisualValidationSessionStatusCreating, ExpiresAt: 10_000, CreatedTime: 100, UpdatedTime: 100,
	}
	newSession := model.BytePlusVisualValidationSession{
		PublicId: "rvs_new_current", ProfileId: profile.Id, CallbackTokenHash: strings.Repeat("2", 64),
		Status: model.BytePlusVisualValidationSessionStatusCreating, ExpiresAt: 10_000, CreatedTime: 200, UpdatedTime: 200,
	}
	require.NoError(t, model.DB.Create(&oldSession).Error)
	require.NoError(t, model.DB.Create(&newSession).Error)
	require.NoError(t, model.DB.Model(&profile).Update("current_validation_session_id", newSession.Id).Error)
	require.NoError(t, model.DB.Create(&model.APIIdempotencyRecord{
		UserId: 7, Route: "real_person_reverify", KeyHash: strings.Repeat("3", 64), RequestHash: strings.Repeat("4", 64),
		Status: model.APIIdempotencyStatusCallingUpstream, ResourceType: model.APIIdempotencyResourceTypeVerificationSession, ResourcePublicId: oldSession.PublicId,
		LeaseUpdatedTime: 100, UpstreamCallStartedAt: 100, ExpiresAt: 10_000, CreatedTime: 100, UpdatedTime: 100,
	}).Error)

	result := RunBytePlusRealPersonJobsOnce(context.Background(), 1_000, 20)
	require.NoError(t, result.Err)

	require.NoError(t, model.DB.First(&oldSession, oldSession.Id).Error)
	require.NoError(t, model.DB.First(&newSession, newSession.Id).Error)
	require.NoError(t, model.DB.First(&profile, profile.Id).Error)
	require.Equal(t, model.BytePlusVisualValidationSessionStatusFailed, oldSession.Status)
	require.Equal(t, model.BytePlusVisualValidationSessionStatusCreating, newSession.Status)
	require.Equal(t, model.BytePlusRealPersonProfileStatusPendingVerification, profile.Status)
	require.Equal(t, newSession.Id, *profile.CurrentValidationSessionId)
	require.Zero(t, deps.client.createCalls)
	require.Zero(t, deps.client.resultCalls)
}

func TestJobsPurgeOnlyExpiredSafeIdempotencyRecords(t *testing.T) {
	installBytePlusRealPersonJobTestDeps(t)
	completed := model.APIIdempotencyRecord{
		UserId: 7, Route: "retention", KeyHash: strings.Repeat("c", 64), RequestHash: strings.Repeat("d", 64),
		Status: model.APIIdempotencyStatusCompleted, ResourceType: model.APIIdempotencyResourceTypeAsset, ResourcePublicId: "ast_completed",
		ResponseStatus: http.StatusOK, ResponsePayload: `{"id":"ast_completed"}`,
		LeaseUpdatedTime: 100, ExpiresAt: 900, CreatedTime: 100, UpdatedTime: 100,
	}
	unknown := model.APIIdempotencyRecord{
		UserId: 7, Route: "retention", KeyHash: strings.Repeat("e", 64), RequestHash: strings.Repeat("f", 64),
		Status: model.APIIdempotencyStatusOutcomeUnknown, ResourceType: model.APIIdempotencyResourceTypeAsset, ResourcePublicId: "ast_unknown_retained",
		LeaseUpdatedTime: 100, ExpiresAt: 900, CreatedTime: 100, UpdatedTime: 100,
	}
	require.NoError(t, model.DB.Create(&completed).Error)
	require.NoError(t, model.DB.Create(&unknown).Error)

	result := RunBytePlusRealPersonJobsOnce(context.Background(), 1_000, 20)
	require.NoError(t, result.Err)

	var completedCount, unknownCount int64
	require.NoError(t, model.DB.Model(&model.APIIdempotencyRecord{}).Where("id = ?", completed.Id).Count(&completedCount).Error)
	require.NoError(t, model.DB.Model(&model.APIIdempotencyRecord{}).Where("id = ?", unknown.Id).Count(&unknownCount).Error)
	require.Zero(t, completedCount)
	require.Equal(t, int64(1), unknownCount)
}

func TestTerminalTempCleanupCannotRegressToPending(t *testing.T) {
	installBytePlusRealPersonJobTestDeps(t)
	object := model.BytePlusAssetTempObject{
		UserId: 7, ChannelId: 101, Bucket: "private-assets", ObjectKey: "tmp/cleaned",
		CleanupStatus: model.BytePlusTempObjectCleanupCleaned, CleanupLeaseUpdatedTime: 100,
		CleanedTime: 200, CreatedTime: 100, UpdatedTime: 200,
	}
	require.NoError(t, model.DB.Create(&object).Error)

	updated, err := model.RetryBytePlusAssetTempObjectCleanup(object.Id, object.CleanupLeaseUpdatedTime, 1_100, 1_000)
	require.NoError(t, err)
	require.False(t, updated)

	var stored model.BytePlusAssetTempObject
	require.NoError(t, model.DB.First(&stored, object.Id).Error)
	require.Equal(t, model.BytePlusTempObjectCleanupCleaned, stored.CleanupStatus)
	require.Equal(t, int64(200), stored.CleanedTime)
}

func TestExpiredSignedURLGetsOneFinalAssetQueryThenObjectCleanup(t *testing.T) {
	deps := installBytePlusRealPersonJobTestDeps(t)
	profile := seedActiveRealPersonProfile(t, 7, 101, "rph_expired_url")
	asset := seedRealPersonAssetRow(t, "ast_expired_url", 7, profile.Id, 101, "Image", model.BytePlusAssetStatusProcessing, "upstream-processing", 100, "")
	object := model.BytePlusAssetTempObject{
		AssetId: &asset.Id, UserId: 7, ChannelId: 101, Bucket: "private-assets", ObjectKey: "tmp/expired-url",
		SignedURLExpiresAt: 900, CleanupStatus: model.BytePlusTempObjectCleanupPending,
		CreatedTime: 100, UpdatedTime: 100,
	}
	require.NoError(t, model.DB.Create(&object).Error)
	deps.client.assetStatus = BytePlusAssetStatus{UpstreamAssetID: "upstream-processing", Status: model.BytePlusAssetStatusProcessing, RequestID: "req-status"}

	result := RunBytePlusRealPersonJobsOnce(context.Background(), 1_000, 20)
	require.NoError(t, result.Err)
	require.Equal(t, 1, deps.client.getAssetCalls)
	require.Equal(t, 1, deps.store.deleteCalls)

	var storedAsset model.BytePlusAsset
	require.NoError(t, model.DB.First(&storedAsset, asset.Id).Error)
	require.Equal(t, model.BytePlusAssetStatusProcessing, storedAsset.Status)
	var storedObject model.BytePlusAssetTempObject
	require.NoError(t, model.DB.First(&storedObject, object.Id).Error)
	require.Equal(t, model.BytePlusTempObjectCleanupCleaned, storedObject.CleanupStatus)
}

func TestProcessingStatusSyncCannotOverwriteDeletingOrDeleted(t *testing.T) {
	deps := installBytePlusRealPersonJobTestDeps(t)
	profile := seedActiveRealPersonProfile(t, 7, 101, "rph_terminal_sync")
	deleting := seedRealPersonAssetRow(t, "ast_terminal_deleting", 7, profile.Id, 101, "Image", model.BytePlusAssetStatusDeleting, "upstream-deleting", 100, "")
	deleted := seedRealPersonAssetRow(t, "ast_terminal_deleted", 7, profile.Id, 101, "Image", model.BytePlusAssetStatusDeleted, "upstream-deleted", 90, "")
	deps.client.assetStatus = BytePlusAssetStatus{Status: model.BytePlusAssetStatusActive}

	result := RunBytePlusRealPersonJobsOnce(context.Background(), 1_000, 20)
	require.NoError(t, result.Err)
	require.Zero(t, deps.client.getAssetCalls)

	var gotDeleting, gotDeleted model.BytePlusAsset
	require.NoError(t, model.DB.First(&gotDeleting, deleting.Id).Error)
	require.NoError(t, model.DB.First(&gotDeleted, deleted.Id).Error)
	require.Equal(t, model.BytePlusAssetStatusDeleting, gotDeleting.Status)
	require.Equal(t, model.BytePlusAssetStatusDeleted, gotDeleted.Status)
}

func TestMainStartsBytePlusRealPersonJobsOutsideMasterOnlyBlock(t *testing.T) {
	source, err := os.ReadFile("../main.go")
	require.NoError(t, err)
	startIndex := bytes.Index(source, []byte("service.StartBytePlusRealPersonJobs()"))
	masterIndex := bytes.Index(source, []byte("if common.IsMasterNode && constant.UpdateTask"))
	require.NotEqual(t, -1, startIndex)
	require.NotEqual(t, -1, masterIndex)
	require.Less(t, startIndex, masterIndex)
}

type bytePlusRealPersonJobTestDeps struct {
	client *fakeRealPersonAPI
	store  *fakeUploadStore
}

func installBytePlusRealPersonJobTestDeps(t *testing.T) bytePlusRealPersonJobTestDeps {
	t.Helper()
	base := newRealPersonServiceFixture(t)
	store := uploadTestStore()
	oldStoreFactory := bytePlusTempObjectStoreFactory
	bytePlusTempObjectStoreFactory = func(BytePlusCredentials) (BytePlusTempObjectStore, error) { return store, nil }
	t.Cleanup(func() { bytePlusTempObjectStoreFactory = oldStoreFactory })
	return bytePlusRealPersonJobTestDeps{client: base.api, store: store}
}

func seedDueVerificationAssetDeletionAndCleanupRows(t *testing.T) {
	t.Helper()
	profile := seedPendingVerificationForJob(t, 7, 101, "rph_job_verify", 100)
	seedRealPersonAssetRow(t, "ast_job_delete", 7, profile.Id, 101, "Image", model.BytePlusAssetStatusDeleting, "upstream-delete-job", 100, "")
	require.NoError(t, model.DB.Create(&model.BytePlusAssetTempObject{
		UserId: 7, ChannelId: 101, Bucket: "private-assets", ObjectKey: "tmp/job-cleanup",
		CleanupStatus: model.BytePlusTempObjectCleanupPending, NextCleanupAt: 100,
		CreatedTime: 100, UpdatedTime: 100,
	}).Error)
}

func seedPendingVerificationForJob(t *testing.T, userID, channelID int, publicID string, createdTime int64) *model.BytePlusRealPersonProfile {
	t.Helper()
	profile := &model.BytePlusRealPersonProfile{
		PublicId: publicID, UserId: userID, Name: publicID, ChannelId: channelID,
		Status: model.BytePlusRealPersonProfileStatusPendingVerification, CreatedTime: createdTime, UpdatedTime: createdTime,
	}
	require.NoError(t, model.DB.Create(profile).Error)
	sessionPublicID := "rvs_" + publicID
	byted, err := plainRealPersonCipher{}.Encrypt(sessionPublicID, "byted_token", "byted-token-"+publicID)
	require.NoError(t, err)
	session := model.BytePlusVisualValidationSession{
		PublicId: sessionPublicID, ProfileId: profile.Id, CallbackTokenHash: callbackHashForTest(publicID),
		BytedTokenCiphertext: byted, Status: model.BytePlusVisualValidationSessionStatusPending,
		ExpiresAt: 10_000, CreatedTime: createdTime, UpdatedTime: createdTime,
	}
	require.NoError(t, model.DB.Create(&session).Error)
	require.NoError(t, model.DB.Model(profile).Update("current_validation_session_id", session.Id).Error)
	return profile
}

func requireJobFakesSawNoDuplicateSideEffects(t *testing.T, deps bytePlusRealPersonJobTestDeps) {
	t.Helper()
	require.LessOrEqual(t, deps.client.resultCalls, 1)
	require.LessOrEqual(t, deps.client.deleteAssetCalls, 1)
	require.LessOrEqual(t, deps.store.deleteCalls, 1)
}
```

`model/byteplus_asset_temp_object_test.go` 锁定 backlog 与 cleanup claim 使用同一 due predicate：

```go
func TestGetBytePlusRealPersonBacklogSnapshotUsesCleanupClaimDuePredicate(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	const now, staleBefore int64 = 1_000, 900
	require.NoError(t, DB.Create(&BytePlusAsset{
		PublicId: "ast_deleting_backlog", UserId: 7, ChannelId: 101,
		AssetType: "Image", Status: BytePlusAssetStatusDeleting,
		CreatedTime: 600, UpdatedTime: 700,
	}).Error)

	objects := []BytePlusAssetTempObject{
		{UserId: 7, ChannelId: 101, Bucket: "private-assets", ObjectKey: "tmp/due", CleanupStatus: BytePlusTempObjectCleanupPending, NextCleanupAt: 800, CleanupLeaseUpdatedTime: 0, CreatedTime: 500, UpdatedTime: 600},
		{UserId: 7, ChannelId: 101, Bucket: "private-assets", ObjectKey: "tmp/future", CleanupStatus: BytePlusTempObjectCleanupPending, NextCleanupAt: 1_100, CleanupLeaseUpdatedTime: 0, CreatedTime: 400, UpdatedTime: 500},
		{UserId: 7, ChannelId: 101, Bucket: "private-assets", ObjectKey: "tmp/leased", CleanupStatus: BytePlusTempObjectCleanupPending, NextCleanupAt: 800, CleanupLeaseUpdatedTime: 950, CreatedTime: 300, UpdatedTime: 400},
		{UserId: 7, ChannelId: 101, Bucket: "private-assets", ObjectKey: "tmp/cleaned", CleanupStatus: BytePlusTempObjectCleanupCleaned, NextCleanupAt: 0, CleanupLeaseUpdatedTime: 0, CreatedTime: 200, UpdatedTime: 300},
	}
	require.NoError(t, DB.Create(&objects).Error)

	snapshot, err := GetBytePlusRealPersonBacklogSnapshot(now, staleBefore)
	require.NoError(t, err)
	require.EqualValues(t, 1, snapshot.DeletingCount)
	require.EqualValues(t, 300, snapshot.DeletingOldestUpdateAgeSeconds)
	require.EqualValues(t, 1, snapshot.TOSCleanupDueCount)
	require.EqualValues(t, 400, snapshot.TOSCleanupDueOldestUpdateAgeSeconds)

	claimed, err := ClaimDueBytePlusTempObjectCleanups(now, staleBefore, 10)
	require.NoError(t, err)
	require.Len(t, claimed, 1)
	require.Equal(t, "tmp/due", claimed[0].ObjectKey)
}
```

`pkg/perf_metrics/byteplus_real_person_test.go` 锁定首次启用、29 条固定时序、非法 label 和 series cap：

```go
func TestBytePlusRealPersonMetricsEmitExactly29FixedSeriesAfterFirstUse(t *testing.T) {
	resetPerfMetricsStateForTest(t)
	before, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)
	require.NotContains(t, before, "newapi_byteplus_real_person_")

	RecordBytePlusRealPersonOutcomeUnknown("asset")
	RecordBytePlusRealPersonReconcile("verification_status", "success")
	MarkBytePlusRealPersonReconcileSuccess(1_000)
	SetBytePlusRealPersonBacklog("deleting", 3, 42)
	RecordBytePlusRealPersonCallbackStatus(http.StatusNoContent)

	text, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)
	require.Equal(t, 29, countBytePlusRealPersonPrometheusSeries(text))
	requirePrometheusSampleLine(t, text, `newapi_byteplus_real_person_outcome_unknown_total{resource="asset"} 1`)
	requirePrometheusSampleLine(t, text, `newapi_byteplus_real_person_reconcile_total{operation="verification_status",result="success"} 1`)
	requirePrometheusSampleLine(t, text, `newapi_byteplus_real_person_reconcile_last_success_unixtime 1000`)
	requirePrometheusSampleLine(t, text, `newapi_byteplus_real_person_backlog{kind="deleting"} 3`)
	requirePrometheusSampleLine(t, text, `newapi_byteplus_real_person_backlog_oldest_update_age_seconds{kind="deleting"} 42`)
	requirePrometheusSampleLine(t, text, `newapi_byteplus_real_person_callback_total{status="2xx"} 1`)
	requirePrometheusSeriesGaugeMatchesRenderedSamples(t, text)
}

func TestBytePlusRealPersonMetricsIgnoreUnknownLabelsAndDoNotLeakValues(t *testing.T) {
	resetPerfMetricsStateForTest(t)
	RecordBytePlusRealPersonOutcomeUnknown("asset")
	RecordBytePlusRealPersonOutcomeUnknown("ast_secret")
	RecordBytePlusRealPersonReconcile("user-7", "token-secret")
	SetBytePlusRealPersonBacklog("tmp/object-key", 99, 99)
	RecordBytePlusRealPersonCallbackStatus(http.StatusFound)

	text, err := BuildPrometheusText(context.Background())
	require.NoError(t, err)
	require.Equal(t, 29, countBytePlusRealPersonPrometheusSeries(text))
	for _, leaked := range []string{"ast_secret", "user-7", "token-secret", "tmp/object-key"} {
		require.NotContains(t, text, leaked)
	}
}

func TestBytePlusRealPersonMetricsCountTowardSeriesCap(t *testing.T) {
	resetPerfMetricsStateForTest(t)
	RecordBytePlusRealPersonOutcomeUnknown("verification_session")
	t.Setenv(prometheusMaxSeriesPerScrapeEnv, "28")
	text, err := BuildPrometheusText(context.Background())
	require.ErrorContains(t, err, "prometheus series limit exceeded: 29 > 28")
	require.Empty(t, text)
}

func countBytePlusRealPersonPrometheusSeries(text string) int {
	count := 0
	for _, line := range prometheusSampleLines(text) {
		if strings.HasPrefix(line, "newapi_byteplus_real_person_") {
			count++
		}
	}
	return count
}
```

- [ ] **Step 2: 运行协调器测试并确认 RED**

Run: `go test ./service ./model ./pkg/perf_metrics -run 'BytePlusRealPersonJobs|JobRunners|OutcomeUnknown|TempCleanup|ProcessingStatusSync|BacklogSnapshot|BytePlusRealPersonMetrics' -race -count=1`

Expected: FAIL，缺少可领取查询、backlog 快照、29 条固定时序和单轮协调器埋点。

- [ ] **Step 3: 为每类工作添加方言无关的候选查询和逐行 CAS**

模型层新增以下方法；每个 claim 都先用普通 `SELECT ... ORDER BY ... LIMIT ?` 找候选，再逐行条件 `UPDATE`，只返回更新行数为 1 的记录：

```go
func ClaimDueBytePlusVisualValidationSessions(now, staleBefore int64, limit int) ([]BytePlusVisualValidationSession, error)
func ClaimDueBytePlusAssetStatusChecks(now, staleBefore int64, limit int) ([]BytePlusAsset, error)
func ClaimDueBytePlusAssetDeletions(now, staleBefore int64, limit int) ([]BytePlusAsset, error)
func MarkBytePlusAssetOutcomeUnknown(publicID string, now int64) (bool, error)
func MarkBytePlusVerificationSessionOutcomeUnknown(sessionPublicID string, now int64) (bool, error)

type BytePlusRealPersonBacklogSnapshot struct {
	DeletingCount                         int64
	DeletingOldestUpdateAgeSeconds        int64
	TOSCleanupDueCount                    int64
	TOSCleanupDueOldestUpdateAgeSeconds   int64
}

func GetBytePlusRealPersonBacklogSnapshot(now, staleBefore int64) (BytePlusRealPersonBacklogSnapshot, error)
```

Task 6 已定义唯一的 `ClaimDueBytePlusTempObjectCleanups`，本任务直接复用，不再创建第二个同义 claim。把它的候选条件提取为同文件私有 helper `dueBytePlusTempObjectCleanupScope(db *gorm.DB, now, staleBefore int64) *gorm.DB`；claim 与 `GetBytePlusRealPersonBacklogSnapshot` 必须共同使用该 helper，固定条件为 `cleanup_status=Pending AND next_cleanup_at<=now AND (cleanup_lease_updated_time=0 OR cleanup_lease_updated_time<staleBefore)`。backlog 快照使用 GORM 的 `COUNT` 与跨三库可用的 `MIN(updated_time)`，在 Go 中计算 `max(now-oldest, 0)`；`deleting` 统计全部 `status=Deleting` 行，`tos_cleanup_due` 只统计上述当前可领取行。空集合的 count/age 都为 0，不能使用方言专属 interval、filtered aggregate 或 `SKIP LOCKED`。

状态检查候选只包括 `Processing` 且有 upstream ID 的素材；更新回写继续使用现有终态保护，所以 `Deleting/Deleted` 永远不会被轮询改回。临时对象候选包括素材已 `Active/Failed/Deleted`、未绑定对象以及 `signed_url_expires_at <= now`；未绑定对象可凭自身 `user_id/channel_id` 定位渠道和 TOS 凭据。`MarkBytePlusAssetOutcomeUnknown` 只把绑定记录的 `Creating` 素材改为 `Failed/idempotency_outcome_unknown`；`MarkBytePlusVerificationSessionOutcomeUnknown` 按 session public ID 只把该 `Creating` session 和仍以它为 current、尚未激活的档案改为稳定失败态，不能覆盖 `Active` 或新 session。

- [ ] **Step 4: 实现固定低基数指标并接入现有 series 预算**

`pkg/perf_metrics/byteplus_real_person.go` 使用 `sync/atomic` 保存进程内 counter/gauge，不创建 Prometheus registry。公开记录面固定为：

```go
func RecordBytePlusRealPersonOutcomeUnknown(resource string)
func RecordBytePlusRealPersonReconcile(operation, result string)
func MarkBytePlusRealPersonReconcileSuccess(now int64)
func SetBytePlusRealPersonBacklog(kind string, count, oldestUpdateAgeSeconds int64)
func RecordBytePlusRealPersonCallbackStatus(statusCode int)
```

固定 label 表和时序数如下；实现用数组索引/switch 映射，不能用调用方字符串直接构造 label：

```go
var bytePlusRealPersonResources = [...]string{"asset", "verification_session"}
var bytePlusRealPersonOperations = [...]string{
	"verification_status", "asset_status", "asset_delete", "tos_cleanup", "idempotency_recovery", "idempotency_retention",
}
var bytePlusRealPersonResults = [...]string{"success", "retry", "error"}
var bytePlusRealPersonBacklogKinds = [...]string{"deleting", "tos_cleanup_due"}
var bytePlusRealPersonCallbackStatuses = [...]string{"2xx", "429", "other_4xx", "5xx"}

const bytePlusRealPersonPrometheusSeriesCount = 2 + 6*3 + 1 + 2 + 2 + 4 // 29
```

第一次有效调用把包内 `atomic.Bool` 标为 initialized；此后 snapshot/writer 始终输出全部 29 条时序，包括值为 0 的组合。未初始化时不输出这组指标，避免改变现有空状态和低 cap 测试。未知 `resource/operation/result/kind`、3xx 或其他无法分类的 HTTP 状态直接忽略且不能初始化；callback 只把 200–299 映射为 `2xx`、429 映射为 `429`、其他 400–499 映射为 `other_4xx`、500–599 映射为 `5xx`。gauge 的负数输入归零。

`pkg/perf_metrics/prometheus.go` 在计算 cap 之前获取固定 snapshot，并把 `snapshot.seriesCount()` 加入 `baseSeriesCount`；通过 cap 后调用 `writePrometheusBytePlusRealPersonMetrics(&b, snapshot)`。writer 必须为以下名称写出 `HELP`、`TYPE` 和稳定排序的全部样本，且 `newapi_perf_metrics_series` 继续等于实际输出样本数：

```text
newapi_byteplus_real_person_outcome_unknown_total{resource}
newapi_byteplus_real_person_reconcile_total{operation,result}
newapi_byteplus_real_person_reconcile_last_success_unixtime
newapi_byteplus_real_person_backlog{kind}
newapi_byteplus_real_person_backlog_oldest_update_age_seconds{kind}
newapi_byteplus_real_person_callback_total{status}
```

在 `resetPerfMetricsStateForTest` 末尾调用包内 `resetBytePlusRealPersonMetricsForTest()`，逐个清零 atomic 值并把 initialized 复位；这只用于同包测试，生产路径不暴露 reset。

- [ ] **Step 5: 实现可测试的单轮协调器并记录每类结果**

`service/byteplus_real_person_jobs.go`：

```go
const (
	bytePlusRealPersonJobInterval = 15 * time.Second
	bytePlusRealPersonJobLease    = 2 * time.Minute
	bytePlusRealPersonJobBatch    = 50
)

type BytePlusRealPersonJobResult struct {
	Processed int
	Err       error
}

func recordBytePlusRealPersonReconcileN(operation, result string, count int) {
	for index := 0; index < count; index++ {
		perfmetrics.RecordBytePlusRealPersonReconcile(operation, result)
	}
}

func RunBytePlusRealPersonJobsOnce(ctx context.Context, now int64, limit int) BytePlusRealPersonJobResult {
	processed := 0
	unknown, err := model.MarkStaleAPIIdempotencyOutcomeUnknown(now-int64(apiIdempotencyLease.Seconds()), now, limit)
	if err != nil {
		perfmetrics.RecordBytePlusRealPersonReconcile("idempotency_recovery", "error")
		return BytePlusRealPersonJobResult{Processed: processed, Err: err}
	}
	for _, record := range unknown {
		perfmetrics.RecordBytePlusRealPersonOutcomeUnknown(record.ResourceType)
		if err := reconcileBytePlusOutcomeUnknownResource(record, now); err != nil {
			perfmetrics.RecordBytePlusRealPersonReconcile("idempotency_recovery", "error")
			return BytePlusRealPersonJobResult{Processed: processed, Err: err}
		}
		perfmetrics.RecordBytePlusRealPersonReconcile("idempotency_recovery", "success")
		processed++
	}
	steps := []struct {
		operation string
		run       func(context.Context, int64, int) (int, error)
	}{
		{"verification_status", reconcileBytePlusVisualValidationSessions},
		{"asset_status", reconcileBytePlusProcessingAssets},
		{"asset_delete", reconcileBytePlusAssetDeletions},
		{"tos_cleanup", reconcileBytePlusTempObjectCleanups},
	}
	for _, step := range steps {
		count, err := step.run(ctx, now, limit)
		processed += count
		if err != nil {
			perfmetrics.RecordBytePlusRealPersonReconcile(step.operation, "error")
			return BytePlusRealPersonJobResult{Processed: processed, Err: err}
		}
		recordBytePlusRealPersonReconcileN(step.operation, "success", count)
	}
	purged, err := model.DeleteExpiredSafeAPIIdempotencyRecords(now, limit)
	processed += purged
	if err != nil {
		perfmetrics.RecordBytePlusRealPersonReconcile("idempotency_retention", "error")
		return BytePlusRealPersonJobResult{Processed: processed, Err: err}
	}
	recordBytePlusRealPersonReconcileN("idempotency_retention", "success", purged)

	backlog, err := model.GetBytePlusRealPersonBacklogSnapshot(now, now-int64(bytePlusRealPersonJobLease.Seconds()))
	if err != nil {
		return BytePlusRealPersonJobResult{Processed: processed, Err: err}
	}
	perfmetrics.SetBytePlusRealPersonBacklog("deleting", backlog.DeletingCount, backlog.DeletingOldestUpdateAgeSeconds)
	perfmetrics.SetBytePlusRealPersonBacklog("tos_cleanup_due", backlog.TOSCleanupDueCount, backlog.TOSCleanupDueOldestUpdateAgeSeconds)
	perfmetrics.MarkBytePlusRealPersonReconcileSuccess(now)
	return BytePlusRealPersonJobResult{Processed: processed}
}
```

`reconcileBytePlusOutcomeUnknownResource` 只根据 `record.ResourceType + record.ResourcePublicId` 推进本地终态：`asset` 调 `MarkBytePlusAssetOutcomeUnknown`；`verification_session` 调 `MarkBytePlusVerificationSessionOutcomeUnknown(sessionPublicID, now)`，只有它仍是档案 current session 时才能把未激活档案写入稳定失败态。它绝不能调用任何 BytePlus/TOS 方法。`MarkStaleAPIIdempotencyOutcomeUnknown` 返回的记录就是账本 CAS 赢家，因此每条只在这里增加一次对应 `resource` 的 `OutcomeUnknown` counter；重放、资源终态 CAS 失败或后续扫描不得再次增加。

四个业务 reconcile 的返回 count 只表示本轮成功推进的行数；成功把瞬时故障写回退避时间时，在行内记录一次 `result="retry"`，不能计入 success。候选查询/claim 失败、无法写入 retry 状态或其他使该 operation 提前结束的错误记录一次 `result="error"`；普通 CAS 输家既不是 retry 也不是 error。每个 reconcile 对单行错误写脱敏日志后尽量安排退避并继续下一行，不把 GroupId、AssetId、object key、signed URL 或原始 upstream body 写日志。

认证调用复用 Task 5 的可信同步；处理素材终态后把关联 temp object 的 `next_cleanup_at` 设为 now；签名 URL 到期但素材仍 Processing 时最后调用一次 `GetAsset`，无论查询成功与否都清理 TOS，不伪造素材终态。TOS 的 24 小时生命周期规则仅是基础设施兜底，协调器仍必须在素材终态或签名到期后主动运行 outbox 清理。安全幂等 retention cleanup 只删除过期的 `Completed/Failed`，不得删除 `OutcomeUnknown` 或任何非终态记录。只有六类工作全部结束且 DB backlog 快照成功时才更新两个 gauge 和 `last_success_unixtime`；任一错误都保留旧 last-success，让 90 秒发布门禁自动失败。

- [ ] **Step 6: 在所有进程启动，但只用 DB 确保正确性**

```go
var bytePlusRealPersonJobsOnce sync.Once

func StartBytePlusRealPersonJobs() {
	bytePlusRealPersonJobsOnce.Do(func() {
		gopool.Go(func() {
			run := func() {
				result := RunBytePlusRealPersonJobsOnce(context.Background(), bytePlusAssetNow(), bytePlusRealPersonJobBatch)
				if result.Err != nil {
					logger.LogWarn(context.Background(), "byteplus real-person reconciliation failed")
				}
			}
			run()
			ticker := time.NewTicker(bytePlusRealPersonJobInterval)
			defer ticker.Stop()
			for range ticker.C {
				run()
			}
		})
	})
}
```

`sync.Once` 只防止单进程重复启动 ticker，不参与行所有权。把 `service.StartBytePlusRealPersonJobs()` 放在 `main.go` 当前后台任务区、`if common.IsMasterNode && constant.UpdateTask` 之前；函数内部不得检查 `common.IsMasterNode`。

- [ ] **Step 7: 运行协调器、指标与状态机测试并确认 GREEN**

Run: `gofmt -w service/byteplus_real_person_jobs.go service/byteplus_real_person_jobs_test.go model/api_idempotency.go model/api_idempotency_test.go model/byteplus_real_person.go model/byteplus_asset.go model/byteplus_asset_temp_object.go model/byteplus_asset_temp_object_test.go service/byteplus_real_person.go service/byteplus_real_person_asset.go pkg/perf_metrics/byteplus_real_person.go pkg/perf_metrics/byteplus_real_person_test.go pkg/perf_metrics/prometheus.go pkg/perf_metrics/prometheus_test.go main.go`

Run: `go test ./model ./service ./pkg/perf_metrics -run 'BytePlusRealPersonJobs|JobRunners|OutcomeUnknown|TempCleanup|ProcessingStatusSync|BytePlusAssetDeletion|BacklogSnapshot|BytePlusRealPersonMetrics' -race -count=1`

Expected: PASS；`common.IsMasterNode=false` 仍处理工作，两 runner 对同一行最多一个外部副作用，终态和 `OutcomeUnknown` 不回退；首次启用后固定输出 29 条真人时序、非法 label 不扩张基数、series cap fail-closed。

- [ ] **Step 8: 提交多节点恢复与发布指标**

```bash
git add service/byteplus_real_person_jobs.go service/byteplus_real_person_jobs_test.go model/api_idempotency.go model/api_idempotency_test.go model/byteplus_real_person.go model/byteplus_asset.go model/byteplus_asset_temp_object.go model/byteplus_asset_temp_object_test.go service/byteplus_real_person.go service/byteplus_real_person_asset.go pkg/perf_metrics/byteplus_real_person.go pkg/perf_metrics/byteplus_real_person_test.go pkg/perf_metrics/prometheus.go pkg/perf_metrics/prometheus_test.go main.go
git commit -m "Keep verification and cleanup progressing across node turnover" -m "Constraint: Every API node may run the coordinator against SQLite, MySQL, or PostgreSQL" -m "Rejected: Master-only jobs and process locks | either can stall recovery and cannot arbitrate another process" -m "Confidence: high" -m "Scope-risk: broad" -m "Directive: Candidate SELECT never grants ownership; only the subsequent conditional UPDATE does, and fixed metric labels must not accept caller values" -m "Tested: Non-master execution, competing runners, terminal-state protection, backlog snapshots, 29 fixed Prometheus series, series-cap enforcement, deletion retry, cleanup retry, and outcome-unknown recovery under race detection"
```

### Task 10: 扩展 Seedance resolver 为“多素材、最多一个真人档案”

**Files:**
- Modify: `service/byteplus_asset_reference.go`
- Modify: `service/byteplus_asset_reference_test.go`
- Modify: `middleware/distributor_byteplus_asset_test.go`
- Modify: `controller/relay_byteplus_asset_test.go`
- Modify: `relay/channel/task/byteplus/adaptor_test.go`

- [ ] **Step 1: 写出正确基数和冲突优先级失败测试**

```go
const (
	referenceRealAssetA = "ast_1234567890abcdefABCDEF1234567890"
	referenceRealAssetB = "ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	referenceVirtual    = "ast_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
)

func TestResolveBytePlusAssetReferencesAllowsMultipleAssetsFromSameRealPerson(t *testing.T) {
	newRealPersonAssetReferenceDB(t)
	profile := insertReferenceRealPersonProfile(t, 7, 101, "rph_reference_a", model.BytePlusRealPersonProfileStatusActive)
	image := insertBytePlusReferenceAsset(t, 7, 101, referenceRealAssetA, "upstream-image", model.BytePlusAssetStatusActive)
	audio := insertBytePlusReferenceAsset(t, 7, 101, referenceRealAssetB, "upstream-audio", model.BytePlusAssetStatusActive)
	setReferenceAssetProfileAndType(t, image.Id, profile.Id, "Image")
	setReferenceAssetProfileAndType(t, audio.Id, profile.Id, "Audio")
	req := &dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{
		{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "asset://" + referenceRealAssetA}, Role: dto.SeedanceRoleReferenceImage},
		{Type: dto.SeedanceContentAudio, AudioURL: &dto.SeedanceURLObject{URL: "asset://" + referenceRealAssetB}, Role: dto.SeedanceRoleReferenceAudio},
	}}
	resolution, apiErr := ResolveBytePlusAssetReferences(newAssetReferenceContext(), 7, req)
	require.Nil(t, apiErr)
	require.Len(t, resolution.RewriteMap, 2)
	require.Equal(t, 101, resolution.PinnedChannelID)
	require.Equal(t, "asset://upstream-image", resolution.RewriteMap["asset://"+referenceRealAssetA])
	require.Equal(t, "asset://upstream-audio", resolution.RewriteMap["asset://"+referenceRealAssetB])
}

func TestResolveBytePlusAssetReferencesRejectsTwoRealPersonProfiles(t *testing.T) {
	newRealPersonAssetReferenceDB(t)
	firstProfile := insertReferenceRealPersonProfile(t, 7, 101, "rph_reference_a", model.BytePlusRealPersonProfileStatusActive)
	secondProfile := insertReferenceRealPersonProfile(t, 7, 101, "rph_reference_b", model.BytePlusRealPersonProfileStatusActive)
	first := insertBytePlusReferenceAsset(t, 7, 101, referenceRealAssetA, "upstream-a", model.BytePlusAssetStatusActive)
	second := insertBytePlusReferenceAsset(t, 7, 101, referenceRealAssetB, "upstream-b", model.BytePlusAssetStatusActive)
	setReferenceAssetProfileAndType(t, first.Id, firstProfile.Id, "Image")
	setReferenceAssetProfileAndType(t, second.Id, secondProfile.Id, "Image")

	_, apiErr := ResolveBytePlusAssetReferences(nil, 7, imageReferenceRequest(referenceRealAssetA, referenceRealAssetB))
	require.NotNil(t, apiErr)
	require.Equal(t, types.ErrorCodeAssetProfileConflict, apiErr.GetErrorCode())
	require.Equal(t, http.StatusConflict, apiErr.StatusCode)
}

func TestResolveBytePlusAssetReferencesAllowsSameChannelVirtualAndOneRealPerson(t *testing.T) {
	newRealPersonAssetReferenceDB(t)
	profile := insertReferenceRealPersonProfile(t, 7, 101, "rph_reference_a", model.BytePlusRealPersonProfileStatusActive)
	realAsset := insertBytePlusReferenceAsset(t, 7, 101, referenceRealAssetA, "upstream-real", model.BytePlusAssetStatusActive)
	setReferenceAssetProfileAndType(t, realAsset.Id, profile.Id, "Image")
	insertBytePlusReferenceAsset(t, 7, 101, referenceVirtual, "upstream-virtual", model.BytePlusAssetStatusActive)

	resolution, apiErr := ResolveBytePlusAssetReferences(nil, 7, imageReferenceRequest(referenceRealAssetA, referenceVirtual))
	require.Nil(t, apiErr)
	require.Equal(t, 101, resolution.PinnedChannelID)
	require.Len(t, resolution.RewriteMap, 2)
}

func TestResolveBytePlusAssetReferencesReturnsProfileConflictBeforeChannelConflictForTwoPeople(t *testing.T) {
	newRealPersonAssetReferenceDB(t)
	firstProfile := insertReferenceRealPersonProfile(t, 7, 101, "rph_reference_a", model.BytePlusRealPersonProfileStatusActive)
	secondProfile := insertReferenceRealPersonProfile(t, 7, 102, "rph_reference_b", model.BytePlusRealPersonProfileStatusActive)
	first := insertBytePlusReferenceAsset(t, 7, 101, referenceRealAssetA, "upstream-a", model.BytePlusAssetStatusActive)
	second := insertBytePlusReferenceAsset(t, 7, 102, referenceRealAssetB, "upstream-b", model.BytePlusAssetStatusActive)
	setReferenceAssetProfileAndType(t, first.Id, firstProfile.Id, "Image")
	setReferenceAssetProfileAndType(t, second.Id, secondProfile.Id, "Image")

	_, apiErr := ResolveBytePlusAssetReferences(nil, 7, imageReferenceRequest(referenceRealAssetA, referenceRealAssetB))
	require.NotNil(t, apiErr)
	require.Equal(t, types.ErrorCodeAssetProfileConflict, apiErr.GetErrorCode())
	require.NotEqual(t, types.ErrorCodeAssetChannelConflict, apiErr.GetErrorCode())
}

func TestResolveBytePlusAssetReferencesRejectsDeletingAndDeleted(t *testing.T) {
	for _, test := range []struct {
		name       string
		status     string
		code       types.ErrorCode
		httpStatus int
	}{
		{"deleting", model.BytePlusAssetStatusDeleting, types.ErrorCodeAssetNotReady, http.StatusConflict},
		{"deleted", model.BytePlusAssetStatusDeleted, types.ErrorCodeAssetNotFound, http.StatusNotFound},
	} {
		t.Run(test.name, func(t *testing.T) {
			newRealPersonAssetReferenceDB(t)
			profile := insertReferenceRealPersonProfile(t, 7, 101, "rph_"+test.name, model.BytePlusRealPersonProfileStatusActive)
			asset := insertBytePlusReferenceAsset(t, 7, 101, referenceRealAssetA, "upstream-"+test.name, test.status)
			setReferenceAssetProfileAndType(t, asset.Id, profile.Id, "Image")

			_, apiErr := ResolveBytePlusAssetReferences(nil, 7, imageReferenceRequest(referenceRealAssetA))
			require.NotNil(t, apiErr)
			require.Equal(t, test.code, apiErr.GetErrorCode())
			require.Equal(t, test.httpStatus, apiErr.StatusCode)
		})
	}
}

func TestResolveBytePlusAssetReferencesRejectsProfileOwnerOrChannelMismatch(t *testing.T) {
	for _, test := range []struct {
		name           string
		profileUser    int
		profileChannel int
		profileStatus  string
		code           types.ErrorCode
		httpStatus     int
	}{
		{"profile belongs to another user", 8, 101, model.BytePlusRealPersonProfileStatusActive, types.ErrorCodeAssetNotFound, http.StatusNotFound},
		{"profile channel differs", 7, 102, model.BytePlusRealPersonProfileStatusActive, types.ErrorCodeAssetChannelConflict, http.StatusConflict},
		{"profile is not active", 7, 101, model.BytePlusRealPersonProfileStatusPendingVerification, types.ErrorCodeRealPersonNotActive, http.StatusConflict},
	} {
		t.Run(test.name, func(t *testing.T) {
			newRealPersonAssetReferenceDB(t)
			profile := insertReferenceRealPersonProfile(t, test.profileUser, test.profileChannel, "rph_mismatch", test.profileStatus)
			asset := insertBytePlusReferenceAsset(t, 7, 101, referenceRealAssetA, "upstream-a", model.BytePlusAssetStatusActive)
			setReferenceAssetProfileAndType(t, asset.Id, profile.Id, "Image")

			_, apiErr := ResolveBytePlusAssetReferences(nil, 7, imageReferenceRequest(referenceRealAssetA))
			require.NotNil(t, apiErr)
			require.Equal(t, test.code, apiErr.GetErrorCode())
			require.Equal(t, test.httpStatus, apiErr.StatusCode)
		})
	}
}

func TestResolveBytePlusAssetReferencesStillRejectsRealPersonMediaTypeMismatch(t *testing.T) {
	newRealPersonAssetReferenceDB(t)
	profile := insertReferenceRealPersonProfile(t, 7, 101, "rph_reference_a", model.BytePlusRealPersonProfileStatusActive)
	asset := insertBytePlusReferenceAsset(t, 7, 101, referenceRealAssetA, "upstream-video", model.BytePlusAssetStatusActive)
	setReferenceAssetProfileAndType(t, asset.Id, profile.Id, "Video")

	_, apiErr := ResolveBytePlusAssetReferences(nil, 7, imageReferenceRequest(referenceRealAssetA))
	require.NotNil(t, apiErr)
	require.Equal(t, types.ErrorCodeInvalidAssetRequest, apiErr.GetErrorCode())
	require.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
}

func newRealPersonAssetReferenceDB(t *testing.T) {
	t.Helper()
	db := newBytePlusAssetReferenceDB(t)
	require.NoError(t, db.AutoMigrate(&model.BytePlusRealPersonProfile{}))
}

func insertReferenceRealPersonProfile(t *testing.T, userID, channelID int, publicID, status string) model.BytePlusRealPersonProfile {
	t.Helper()
	groupID := "group-" + publicID
	profile := model.BytePlusRealPersonProfile{
		PublicId: publicID, UserId: userID, Name: publicID, ChannelId: channelID,
		UpstreamGroupId: &groupID, Status: status, CreatedTime: 100, UpdatedTime: 100,
	}
	require.NoError(t, model.DB.Create(&profile).Error)
	return profile
}

func setReferenceAssetProfileAndType(t *testing.T, assetID, profileID int64, assetType string) {
	t.Helper()
	require.NoError(t, model.DB.Model(&model.BytePlusAsset{}).Where("id = ?", assetID).Updates(map[string]any{
		"real_person_profile_id": profileID,
		"asset_type": assetType,
	}).Error)
}

func imageReferenceRequest(publicIDs ...string) *dto.SeedanceVideoRequest {
	content := make([]dto.SeedanceContentItem, 0, len(publicIDs))
	for _, publicID := range publicIDs {
		content = append(content, dto.SeedanceContentItem{
			Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "asset://" + publicID}, Role: dto.SeedanceRoleReferenceImage,
		})
	}
	return &dto.SeedanceVideoRequest{Model: "seedance-2.0", Content: content}
}
```

`middleware/distributor_byteplus_asset_test.go` 把测试迁移扩展为 `db.AutoMigrate(&model.Channel{}, &model.Ability{}, &model.BytePlusAsset{}, &model.BytePlusRealPersonProfile{})`，并增加：

```go
func TestBytePlusRealPersonProfileConflictAbortsBeforePinnedChannelSelection(t *testing.T) {
	restoreDB := useMiddlewareBytePlusAssetDBForTest(t)
	defer restoreDB()
	insertMiddlewareBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, 1, 1)
	insertMiddlewareBytePlusAssetChannel(t, 132, "default", common.ChannelStatusEnabled, 1000, 1000)
	insertMiddlewareRealPersonProfile(t, 501, 7, 131, "rph_middleware_a")
	insertMiddlewareRealPersonProfile(t, 502, 7, 132, "rph_middleware_b")
	insertMiddlewareBytePlusAssetWithProfile(t, 7, 131, "ast_1234567890abcdefABCDEF1234567890", "upstream-a", 501)
	insertMiddlewareBytePlusAssetWithProfile(t, 7, 132, "ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "upstream-b", 502)
	model.InitChannelCache()

	router := newBytePlusAssetDistributorRouter(func(c *gin.Context) {
		c.String(http.StatusInternalServerError, "handler should not run")
	})
	recorder := performBytePlusAssetDistributorRequest(router, "", `{
		"model":"seedance-2.0",
		"content":[
			{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"},
			{"type":"image_url","image_url":{"url":"asset://ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},"role":"reference_image"}
		]
	}`)

	require.Equal(t, http.StatusConflict, recorder.Code, recorder.Body.String())
	require.Contains(t, recorder.Body.String(), "asset_profile_conflict")
	require.NotContains(t, recorder.Body.String(), "asset_channel_conflict")
}

func insertMiddlewareRealPersonProfile(t *testing.T, id int64, userID, channelID int, publicID string) {
	t.Helper()
	groupID := "group-" + publicID
	require.NoError(t, model.DB.Create(&model.BytePlusRealPersonProfile{
		Id: id, PublicId: publicID, UserId: userID, Name: publicID, ChannelId: channelID,
		UpstreamGroupId: &groupID, Status: model.BytePlusRealPersonProfileStatusActive,
	}).Error)
}

func insertMiddlewareBytePlusAssetWithProfile(t *testing.T, userID, channelID int, publicID, upstreamID string, profileID int64) {
	t.Helper()
	insertMiddlewareBytePlusAssetWithType(t, userID, channelID, publicID, upstreamID, model.BytePlusAssetStatusActive, "Image")
	require.NoError(t, model.DB.Model(&model.BytePlusAsset{}).Where("public_id = ?", publicID).Update("real_person_profile_id", profileID).Error)
}
```

`controller/relay_byteplus_asset_test.go` 保持 pinned-channel 锁定回归：

```go
func TestBytePlusAssetPinnedLockStillUsesResolvedRealPersonChannel(t *testing.T) {
	restoreDB := useControllerBytePlusAssetDBForTest(t)
	defer restoreDB()
	insertControllerBytePlusChannel(t, 131, common.ChannelStatusEnabled, constant.ChannelTypeBytePlus)
	model.InitChannelCache()

	c := newControllerBytePlusAssetContext()
	common.SetContextKey(c, constant.ContextKeyBytePlusAssetPinnedChannelID, 131)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}, TaskRelayInfo: &relaycommon.TaskRelayInfo{}}
	taskErr := resolveOriginTaskWithBytePlusAssetLock(c, info, func(_ *gin.Context, got *relaycommon.RelayInfo) *dto.TaskError {
		locked := got.LockedChannel.(*model.Channel)
		require.Equal(t, 131, locked.Id)
		return nil
	})
	require.Nil(t, taskErr)
}
```

`relay/channel/task/byteplus/adaptor_test.go` 同时锁定两个真人素材的改写和普通文本/URL不改写：

```go
func TestBuildRequestBodyRewritesMultipleSamePersonAssetsWithoutTouchingTextOrURLs(t *testing.T) {
	a := &TaskAdaptor{}
	info := newTestRelayInfo("https://ark.example", "test-key")
	c := newTestContext(`{
		"model":"seedance-2.0",
		"content":[
			{"type":"text","text":"mention asset://ast_not_a_strict_public_id only as text"},
			{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"},
			{"type":"audio_url","audio_url":{"url":"asset://ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},"role":"reference_audio"},
			{"type":"video_url","video_url":{"url":"https://example.com/reference.mp4"},"role":"reference_video"}
		]
	}`)
	common.SetContextKey(c, constant.ContextKeyBytePlusAssetRewriteMap, map[string]string{
		"asset://ast_1234567890abcdefABCDEF1234567890": "asset://upstream-image",
		"asset://ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa": "asset://upstream-audio",
	})

	body, err := a.BuildRequestBody(c, info)
	require.NoError(t, err)
	raw, err := io.ReadAll(body)
	require.NoError(t, err)
	var got dto.SeedanceVideoRequest
	require.NoError(t, common.Unmarshal(raw, &got))
	require.Equal(t, "asset://upstream-image", got.Content[1].ImageURL.URL)
	require.Equal(t, "asset://upstream-audio", got.Content[2].AudioURL.URL)
	require.Equal(t, "https://example.com/reference.mp4", got.Content[3].VideoURL.URL)
	require.Contains(t, got.Content[0].Text, "asset://ast_not_a_strict_public_id")
}
```

- [ ] **Step 2: 运行 resolver 链路并确认 RED**

Run: `go test ./service ./middleware ./controller ./relay/channel/task/byteplus -run 'BytePlusAsset.*(RealPerson|Profile|Deleting|Deleted|Mixed)|ResolveBytePlusAssetReferences' -count=1`

Expected: FAIL，新 profile 集合校验和显式删除态语义尚不存在。

- [ ] **Step 3: 收集 profile 集合，不限制素材个数**

在 `ResolveBytePlusAssetReferences` 完成所有权素材加载和缺失检查后、渠道冲突检查前加入：

```go
profileIDs := make(map[int64]struct{})
for _, reference := range references {
	asset := byID[reference.PublicID]
	if asset.RealPersonProfileId != nil {
		profileIDs[*asset.RealPersonProfileId] = struct{}{}
	}
}
if len(profileIDs) > 1 {
	return BytePlusAssetReferenceResolution{}, assetError(
		errors.New("assets belong to different real-person profiles"),
		types.ErrorCodeAssetProfileConflict,
		http.StatusConflict,
	)
}
```

绝对不能用 `len(references) > 1`；该判断会错误拒绝同一真人的多张图、视频和音频。若集合恰好一个，使用 `GetBytePlusRealPersonProfileByIDForUser(userID, profileID)` 再次验证档案所有权、`Active` 状态和 `profile.ChannelId == asset.ChannelId`；跨用户按素材 404，渠道不一致按 `asset_channel_conflict`。

- [ ] **Step 4: 显式处理删除态并保持现有改写链**

更新状态 switch：

```go
switch asset.Status {
case model.BytePlusAssetStatusActive:
case model.BytePlusAssetStatusCreating, model.BytePlusAssetStatusProcessing, model.BytePlusAssetStatusDeleting:
	return BytePlusAssetReferenceResolution{PinnedChannelID: pinnedChannelID}, assetError(errors.New("asset is not active"), types.ErrorCodeAssetNotReady, http.StatusConflict)
case model.BytePlusAssetStatusFailed:
	return BytePlusAssetReferenceResolution{PinnedChannelID: pinnedChannelID}, assetError(errors.New("asset failed"), types.ErrorCodeAssetFailed, http.StatusUnprocessableEntity)
case model.BytePlusAssetStatusDeleted:
	return BytePlusAssetReferenceResolution{PinnedChannelID: pinnedChannelID}, assetError(errors.New("asset not found"), types.ErrorCodeAssetNotFound, http.StatusNotFound)
default:
	return BytePlusAssetReferenceResolution{PinnedChannelID: pinnedChannelID}, assetError(errors.New("asset is not active"), types.ErrorCodeAssetNotReady, http.StatusConflict)
}
```

不要修改 `extractBytePlusAssetPublicIDs` 对多个不同 ID 的支持，也不要修改 BytePlus task adaptor 的 rewrite map 形状；中间件继续把 resolver 的单一 pinned channel 写入 context。

- [ ] **Step 5: 运行 resolver、分发、锁定和 adaptor 回归并确认 GREEN**

Run: `gofmt -w service/byteplus_asset_reference.go service/byteplus_asset_reference_test.go middleware/distributor_byteplus_asset_test.go controller/relay_byteplus_asset_test.go relay/channel/task/byteplus/adaptor_test.go`

Run: `go test ./service -run 'ResolveBytePlusAssetReferences|BytePlusAssetErrorsUseStablePublicMessages' -count=1`

Run: `go test ./middleware -run 'BytePlusAsset' -count=1`

Run: `go test ./controller -run 'BytePlusAssetOriginResolver' -count=1`

Run: `go test ./relay/channel/task/byteplus -run 'BuildRequestBody|RewriteBytePlusAssetReferences' -count=1`

Expected: PASS；多个同 profile 素材和同渠道虚拟+真人混用成功，两个 profile 在提交上游前稳定返回 409 `asset_profile_conflict`，删除态不可用。

- [ ] **Step 6: 提交 Seedance 真人边界**

```bash
git add service/byteplus_asset_reference.go service/byteplus_asset_reference_test.go middleware/distributor_byteplus_asset_test.go controller/relay_byteplus_asset_test.go relay/channel/task/byteplus/adaptor_test.go
git commit -m "Keep each Seedance request tied to one certified person" -m "Constraint: BytePlus permits several assets for one person but not a mix of independently verified people" -m "Rejected: Limiting a request to one asset reference | the supported boundary is one profile, not one asset" -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: Preserve multiple same-profile rewrites and same-channel virtual plus real-person mixing" -m "Tested: Profile cardinality, conflict precedence, ownership, channel pinning, media types, deletion states, distributor lock, and adaptor rewrite regression"
```

### Task 11: 暴露 HTTP API、可信 callback、专用限流和路径脱敏

**Files:**
- Create: `controller/byteplus_real_person.go`
- Create: `controller/byteplus_real_person_test.go`
- Modify: `controller/byteplus_asset.go`
- Modify: `controller/byteplus_asset_test.go`
- Modify: `router/asset-router.go`
- Modify: `router/asset_router_test.go`
- Modify: `middleware/rate-limit.go`
- Create: `middleware/real_person_callback_metrics.go`
- Create: `middleware/real_person_callback_metrics_test.go`
- Modify: `middleware/logger.go`
- Create: `middleware/logger_test.go`
- Modify: `service/byteplus_real_person.go`
- Modify: `service/byteplus_real_person_test.go`
- Modify: `i18n/keys.go`
- Modify: `i18n/byteplus_asset_test.go`
- Modify: `i18n/locales/en.yaml`
- Modify: `i18n/locales/zh-CN.yaml`
- Modify: `i18n/locales/zh-TW.yaml`
- Modify: `i18n/locales/pt.yaml`

- [ ] **Step 1: 写出 handler、路由、中间件顺序、callback 和日志失败测试**

```go
func TestCreateRealPersonRequiresTokenModelAccessAndIdempotencyKey(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	oldCreate := createBytePlusRealPerson
	t.Cleanup(func() { createBytePlusRealPerson = oldCreate })
	createBytePlusRealPerson = func(context.Context, int, string, string, int, string, dto.BytePlusRealPersonCreateRequest) (*dto.BytePlusRealPersonResponse, *types.NewAPIError) {
		t.Fatal("service must not be called")
		return nil, nil
	}

	c, recorder := newBytePlusAssetJSONContext(http.MethodPost, "/v1/real-persons", `{"name":"Person A"}`)
	setBytePlusAssetTokenContext(c)
	CreateBytePlusRealPerson(c)
	require.Equal(t, http.StatusBadRequest, recorder.Code)
	require.Contains(t, recorder.Body.String(), string(types.ErrorCodeInvalidRealPersonRequest))

	c, recorder = newBytePlusAssetJSONContext(http.MethodPost, "/v1/real-persons", `{"name":"Person A"}`)
	c.Request.Header.Set("Idempotency-Key", "idem-create")
	setBytePlusAssetTokenContext(c)
	common.SetContextKey(c, constant.ContextKeyTokenModelLimitEnabled, true)
	common.SetContextKey(c, constant.ContextKeyTokenModelLimit, map[string]bool{"gpt-4": true})
	CreateBytePlusRealPerson(c)
	require.Equal(t, http.StatusForbidden, recorder.Code)
	require.Contains(t, recorder.Body.String(), string(types.ErrorCodeAccessDenied))
}

func TestCreateRealPersonAssetDispatchesJSONAndMultipartWithoutFormFile(t *testing.T) {
	oldURL := createBytePlusRealPersonAssetFromURL
	oldMultipart := createBytePlusRealPersonAssetFromMultipart
	t.Cleanup(func() {
		createBytePlusRealPersonAssetFromURL = oldURL
		createBytePlusRealPersonAssetFromMultipart = oldMultipart
	})
	createBytePlusRealPersonAssetFromURL = func(_ context.Context, userID int, personID, key string, request dto.BytePlusRealPersonAssetCreateRequest) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
		require.Equal(t, 123, userID)
		require.Equal(t, "rph_123", personID)
		require.Equal(t, "idem-json", key)
		require.Equal(t, "https://cdn.example.com/person.png", request.URL)
		return &dto.BytePlusAssetResponse{ID: "ast_json", Object: "asset", AssetType: "Image", Status: model.BytePlusAssetStatusProcessing}, nil
	}
	createBytePlusRealPersonAssetFromMultipart = func(_ context.Context, userID int, personID, key string, request *http.Request) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
		require.Equal(t, 123, userID)
		require.Equal(t, "rph_123", personID)
		require.Equal(t, "idem-multipart", key)
		require.Nil(t, request.MultipartForm)
		return &dto.BytePlusAssetResponse{ID: "ast_multipart", Object: "asset", AssetType: "Image", Status: model.BytePlusAssetStatusProcessing}, nil
	}

	c, recorder := newBytePlusAssetJSONContext(http.MethodPost, "/v1/real-persons/rph_123/assets", `{"url":"https://cdn.example.com/person.png","asset_type":"Image"}`)
	c.Params = gin.Params{{Key: "person_id", Value: "rph_123"}}
	c.Request.Header.Set("Idempotency-Key", "idem-json")
	setBytePlusAssetTokenContext(c)
	CreateBytePlusRealPersonAsset(c)
	require.Equal(t, http.StatusOK, recorder.Code)

	c, recorder = newRealPersonMultipartControllerContext(io.LimitReader(endlessByteReader{}, 128))
	c.Params = gin.Params{{Key: "person_id", Value: "rph_123"}}
	c.Request.Header.Set("Idempotency-Key", "idem-multipart")
	setBytePlusAssetTokenContext(c)
	CreateBytePlusRealPersonAsset(c)
	require.Equal(t, http.StatusOK, recorder.Code)

	source, err := os.ReadFile("byteplus_real_person.go")
	require.NoError(t, err)
	for _, forbidden := range []string{"FormFile", "ShouldBind", "ParseMultipartForm"} {
		require.NotContains(t, string(source), forbidden)
	}
}

func TestCreateRealPersonAssetRequiresPersonAndIdempotencyBeforeDispatch(t *testing.T) {
	oldURL := createBytePlusRealPersonAssetFromURL
	oldMultipart := createBytePlusRealPersonAssetFromMultipart
	t.Cleanup(func() {
		createBytePlusRealPersonAssetFromURL = oldURL
		createBytePlusRealPersonAssetFromMultipart = oldMultipart
	})
	createBytePlusRealPersonAssetFromURL = func(context.Context, int, string, string, dto.BytePlusRealPersonAssetCreateRequest) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
		t.Fatal("service must not be called without person_id and Idempotency-Key")
		return nil, nil
	}
	createBytePlusRealPersonAssetFromMultipart = func(context.Context, int, string, string, *http.Request) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
		t.Fatal("service must not be called without person_id and Idempotency-Key")
		return nil, nil
	}

	missingPerson, missingPersonRecorder := newBytePlusAssetJSONContext(http.MethodPost, "/v1/real-persons/%20/assets", `{"url":"https://cdn.example.com/person.png","asset_type":"Image"}`)
	missingPerson.Params = gin.Params{{Key: "person_id", Value: " "}}
	missingPerson.Request.Header.Set("Idempotency-Key", "idem-person")
	setBytePlusAssetTokenContext(missingPerson)
	CreateBytePlusRealPersonAsset(missingPerson)
	require.Equal(t, http.StatusBadRequest, missingPersonRecorder.Code)
	require.Contains(t, missingPersonRecorder.Body.String(), string(types.ErrorCodeInvalidAssetRequest))

	missingKey, missingKeyRecorder := newBytePlusAssetJSONContext(http.MethodPost, "/v1/real-persons/rph_123/assets", `{"url":"https://cdn.example.com/person.png","asset_type":"Image"}`)
	missingKey.Params = gin.Params{{Key: "person_id", Value: "rph_123"}}
	setBytePlusAssetTokenContext(missingKey)
	CreateBytePlusRealPersonAsset(missingKey)
	require.Equal(t, http.StatusBadRequest, missingKeyRecorder.Code)
	require.Contains(t, missingKeyRecorder.Body.String(), string(types.ErrorCodeInvalidAssetRequest))
}

func TestReverifyBlankPersonWritesExactlyOneError(t *testing.T) {
	oldReverify := reverifyBytePlusRealPerson
	t.Cleanup(func() { reverifyBytePlusRealPerson = oldReverify })
	reverifyBytePlusRealPerson = func(context.Context, int, string, string) (*dto.BytePlusRealPersonResponse, *types.NewAPIError) {
		t.Fatal("service must not be called for blank person_id")
		return nil, nil
	}

	c, recorder := newBytePlusAssetJSONContext(http.MethodPost, "/v1/real-persons/%20/verification-sessions", "")
	c.Params = gin.Params{{Key: "person_id", Value: " "}}
	setBytePlusAssetTokenContext(c)
	ReverifyBytePlusRealPerson(c)
	require.Equal(t, http.StatusBadRequest, recorder.Code)
	require.Equal(t, 1, strings.Count(recorder.Body.String(), `"error"`))
}

func TestRealPersonAssetPaginationUsesAssetErrorCode(t *testing.T) {
	oldList := listBytePlusRealPersonAssets
	t.Cleanup(func() { listBytePlusRealPersonAssets = oldList })
	listBytePlusRealPersonAssets = func(context.Context, int, string, int, string) (*dto.BytePlusRealPersonAssetListResponse, *types.NewAPIError) {
		t.Fatal("service must not be called for an invalid limit")
		return nil, nil
	}

	c, recorder := newBytePlusAssetJSONContext(http.MethodGet, "/v1/real-persons/rph_123/assets?limit=0", "")
	c.Params = gin.Params{{Key: "person_id", Value: "rph_123"}}
	setBytePlusAssetTokenContext(c)
	ListBytePlusRealPersonAssets(c)
	require.Equal(t, http.StatusBadRequest, recorder.Code)
	require.Contains(t, recorder.Body.String(), string(types.ErrorCodeInvalidAssetRequest))
}

func TestCreateRealPersonAssetEnforcesMultipartRequestHardLimit(t *testing.T) {
	oldMultipart := createBytePlusRealPersonAssetFromMultipart
	t.Cleanup(func() { createBytePlusRealPersonAssetFromMultipart = oldMultipart })
	createBytePlusRealPersonAssetFromMultipart = func(_ context.Context, _ int, _ string, _ string, request *http.Request) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
		_, err := io.Copy(io.Discard, request.Body)
		var maxErr *http.MaxBytesError
		require.ErrorAs(t, err, &maxErr)
		require.Equal(t, bytePlusMultipartRequestMaxBytes, maxErr.Limit)
		return nil, types.InitOpenAIError(types.ErrorCodeAssetFileTooLarge, http.StatusRequestEntityTooLarge)
	}

	c, recorder := newRealPersonMultipartControllerContext(io.LimitReader(endlessByteReader{}, bytePlusMultipartRequestMaxBytes+1))
	c.Params = gin.Params{{Key: "person_id", Value: "rph_123"}}
	c.Request.Header.Set("Idempotency-Key", "idem-limit")
	setBytePlusAssetTokenContext(c)
	CreateBytePlusRealPersonAsset(c)
	require.Equal(t, http.StatusRequestEntityTooLarge, recorder.Code)
	require.Contains(t, recorder.Body.String(), string(types.ErrorCodeAssetFileTooLarge))
}

func TestRealPersonQueriesHideCrossUserResourcesAsNotFound(t *testing.T) {
	oldGet := getBytePlusRealPerson
	t.Cleanup(func() { getBytePlusRealPerson = oldGet })
	getBytePlusRealPerson = func(context.Context, int, string) (*dto.BytePlusRealPersonResponse, *types.NewAPIError) {
		return nil, types.NewOpenAIError(errors.New("profile belongs to user 999"), types.ErrorCodeRealPersonNotFound, http.StatusNotFound)
	}
	c, recorder := newBytePlusAssetJSONContext(http.MethodGet, "/v1/real-persons/rph_other", "")
	c.Params = gin.Params{{Key: "person_id", Value: "rph_other"}}
	setBytePlusAssetTokenContext(c)
	GetBytePlusRealPerson(c)
	require.Equal(t, http.StatusNotFound, recorder.Code)
	require.Contains(t, recorder.Body.String(), string(types.ErrorCodeRealPersonNotFound))
	require.NotContains(t, recorder.Body.String(), "999")
}

func TestDeleteAssetReturns204ForFirstAndRepeatedCalls(t *testing.T) {
	oldDelete := deleteBytePlusAsset
	t.Cleanup(func() { deleteBytePlusAsset = oldDelete })
	var calls int
	deleteBytePlusAsset = func(_ context.Context, userID int, assetID string) *types.NewAPIError {
		calls++
		require.Equal(t, 123, userID)
		require.Equal(t, "ast_delete", assetID)
		return nil
	}
	for range 2 {
		c, recorder := newBytePlusAssetJSONContext(http.MethodDelete, "/v1/assets/ast_delete", "")
		c.Params = gin.Params{{Key: "asset_id", Value: "ast_delete"}}
		setBytePlusAssetTokenContext(c)
		DeleteBytePlusAsset(c)
		require.Equal(t, http.StatusNoContent, recorder.Code)
		require.Empty(t, recorder.Body.String())
	}
	require.Equal(t, 2, calls)
}

func TestCallbackAlwaysReturns204ForValidUnknownExpiredAndDuplicateTokens(t *testing.T) {
	oldNotify := notifyBytePlusRealPersonVerificationCallback
	t.Cleanup(func() { notifyBytePlusRealPersonVerificationCallback = oldNotify })
	var tokens []string
	notifyBytePlusRealPersonVerificationCallback = func(_ context.Context, token string) { tokens = append(tokens, token) }

	for _, token := range []string{"valid-token", "unknown-token", "expired-token", "valid-token"} {
		c, recorder := newBytePlusAssetJSONContext(http.MethodGet, "/v1/real-person-verifications/callback/"+token+"?resultCode=0", "")
		c.Params = gin.Params{{Key: "callback_token", Value: token}}
		BytePlusRealPersonVerificationCallback(c)
		require.Equal(t, http.StatusNoContent, recorder.Code)
		require.Empty(t, recorder.Body.String())
	}
	require.Equal(t, []string{"valid-token", "unknown-token", "expired-token", "valid-token"}, tokens)

	empty, emptyRecorder := newBytePlusAssetJSONContext(http.MethodGet, "/v1/real-person-verifications/callback/", "")
	empty.Params = gin.Params{{Key: "callback_token", Value: " "}}
	BytePlusRealPersonVerificationCallback(empty)
	require.Equal(t, http.StatusNoContent, emptyRecorder.Code)
	require.Equal(t, []string{"valid-token", "unknown-token", "expired-token", "valid-token"}, tokens)
}

func TestCallbackUsesGetVisualValidateResultRatherThanTrustingResultCode(t *testing.T) {
	oldNotify := notifyBytePlusRealPersonVerificationCallback
	t.Cleanup(func() { notifyBytePlusRealPersonVerificationCallback = oldNotify })
	var tokens []string
	notifyBytePlusRealPersonVerificationCallback = func(_ context.Context, token string) { tokens = append(tokens, token) }

	get, getRecorder := newBytePlusAssetJSONContext(http.MethodGet, "/v1/real-person-verifications/callback/token-get?resultCode=0", "")
	get.Params = gin.Params{{Key: "callback_token", Value: "token-get"}}
	BytePlusRealPersonVerificationCallback(get)
	require.Equal(t, http.StatusNoContent, getRecorder.Code)

	post, postRecorder := newBytePlusAssetJSONContext(http.MethodPost, "/v1/real-person-verifications/callback/token-post?resultCode=0", `{"resultCode":"9999"}`)
	post.Params = gin.Params{{Key: "callback_token", Value: "token-post"}}
	BytePlusRealPersonVerificationCallback(post)
	require.Equal(t, http.StatusNoContent, postRecorder.Code)
	require.Equal(t, []string{"token-get", "token-post"}, tokens)
}

type endlessByteReader struct{}

func (endlessByteReader) Read(p []byte) (int, error) {
	clear(p)
	return len(p), nil
}

func newRealPersonMultipartControllerContext(body io.Reader) (*gin.Context, *httptest.ResponseRecorder) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/real-persons/rph_123/assets", body)
	c.Request.Header.Set("Content-Type", "multipart/form-data; boundary=test-boundary")
	c.Request.Header.Set("Accept-Language", "en")
	return c, recorder
}

```

`service/byteplus_real_person_test.go` 证明只有服务端查询可以激活档案：

```go
func TestNotifyVerificationCallbackUsesServerSideResultAsOnlyAuthority(t *testing.T) {
	fixture := newRealPersonServiceFixture(t)
	response, apiErr := fixture.create("idem-callback", "Person A")
	require.Nil(t, apiErr)

	fixture.api.resultErr = context.DeadlineExceeded
	NotifyBytePlusRealPersonVerificationCallback(context.Background(), "callback-token-1")
	var profile model.BytePlusRealPersonProfile
	require.NoError(t, model.DB.Where("public_id = ?", response.ID).First(&profile).Error)
	require.NotEqual(t, model.BytePlusRealPersonProfileStatusActive, profile.Status)

	fixture.api.resultErr = nil
	fixture.api.result = BytePlusVisualValidationResult{GroupID: "group-server-confirmed", RequestID: "req-result"}
	NotifyBytePlusRealPersonVerificationCallback(context.Background(), "callback-token-1")
	require.NoError(t, model.DB.First(&profile, profile.Id).Error)
	require.Equal(t, model.BytePlusRealPersonProfileStatusActive, profile.Status)
	require.Equal(t, "group-server-confirmed", *profile.UpstreamGroupId)
}
```

`middleware/logger_test.go`：

```go
func TestTemplateSensitiveRequestPathRedactsCallbackToken(t *testing.T) {
	got := templateSensitiveRequestPath("/v1/real-person-verifications/callback/super-secret-token")
	require.Equal(t, "/v1/real-person-verifications/callback/:callback_token", got)
	require.Equal(t, "/v1/assets/ast_public", templateSensitiveRequestPath("/v1/assets/ast_public"))
	require.Equal(t, "/v1/real-person-verifications/callback/", templateSensitiveRequestPath("/v1/real-person-verifications/callback/"))
}
```

`middleware/real_person_callback_metrics_test.go` 证明指标 middleware 能看到内层 limiter/handler 的最终状态：

```go
func TestRealPersonVerificationCallbackMetricsRecordsFinalInnerStatus(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(RealPersonVerificationCallbackMetrics())
	engine.Use(func(c *gin.Context) {
		if c.Request.URL.Path == "/limited" {
			c.AbortWithStatus(http.StatusTooManyRequests)
			return
		}
		c.Next()
	})
	engine.GET("/ok", func(c *gin.Context) { c.Status(http.StatusNoContent) })
	engine.GET("/bad", func(c *gin.Context) { c.Status(http.StatusBadRequest) })
	engine.GET("/failed", func(c *gin.Context) { c.Status(http.StatusInternalServerError) })
	engine.GET("/limited", func(c *gin.Context) { c.Status(http.StatusNoContent) })

	for _, path := range []string{"/ok", "/bad", "/failed", "/limited"} {
		request := httptest.NewRequest(http.MethodGet, path, nil)
		response := httptest.NewRecorder()
		engine.ServeHTTP(response, request)
	}

	text, err := perfmetrics.BuildPrometheusText(context.Background())
	require.NoError(t, err)
	require.Contains(t, text, `newapi_byteplus_real_person_callback_total{status="2xx"} 1`)
	require.Contains(t, text, `newapi_byteplus_real_person_callback_total{status="429"} 1`)
	require.Contains(t, text, `newapi_byteplus_real_person_callback_total{status="other_4xx"} 1`)
	require.Contains(t, text, `newapi_byteplus_real_person_callback_total{status="5xx"} 1`)
}
```

`router/asset_router_test.go` 必须同时覆盖 callback 的 GET 和 POST：

```go
func TestSetBytePlusAssetRouterRegistersRealPersonAndDeleteRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetBytePlusAssetRouter(engine)
	routes := map[string]bool{}
	for _, route := range engine.Routes() {
		routes[route.Method+" "+route.Path] = true
	}
	for _, expected := range []string{
		"DELETE /v1/assets/:asset_id",
		"POST /v1/real-persons",
		"POST /v1/real-persons/:person_id/verification-sessions",
		"GET /v1/real-persons",
		"GET /v1/real-persons/:person_id",
		"POST /v1/real-persons/:person_id/assets",
		"GET /v1/real-persons/:person_id/assets",
		"GET /v1/real-person-verifications/callback/:callback_token",
		"POST /v1/real-person-verifications/callback/:callback_token",
	} {
		require.True(t, routes[expected], "missing route %s", expected)
	}
}

func TestCallbackMetricsMiddlewareIsRegisteredBeforeLimiter(t *testing.T) {
	source, err := os.ReadFile("asset-router.go")
	require.NoError(t, err)
	metricsIndex := bytes.Index(source, []byte("callbackRouter.Use(middleware.RealPersonVerificationCallbackMetrics())"))
	limiterIndex := bytes.Index(source, []byte("callbackRouter.Use(middleware.RealPersonVerificationCallbackRateLimit())"))
	require.NotEqual(t, -1, metricsIndex)
	require.NotEqual(t, -1, limiterIndex)
	require.Less(t, metricsIndex, limiterIndex)
}

func TestRealPersonRoutesApplyGlobalTokenAndModelRateLimits(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetBytePlusAssetRouter(engine)
	for _, test := range []struct{ method, path string }{
		{http.MethodPost, "/v1/real-persons"},
		{http.MethodPost, "/v1/real-persons/rph_123/verification-sessions"},
		{http.MethodGet, "/v1/real-persons"},
		{http.MethodGet, "/v1/real-persons/rph_123"},
		{http.MethodPost, "/v1/real-persons/rph_123/assets"},
		{http.MethodGet, "/v1/real-persons/rph_123/assets"},
		{http.MethodDelete, "/v1/assets/ast_123"},
	} {
		recorder := httptest.NewRecorder()
		engine.ServeHTTP(recorder, httptest.NewRequest(test.method, test.path, nil))
		require.Equal(t, http.StatusUnauthorized, recorder.Code, "%s %s must stop at TokenAuth", test.method, test.path)
	}

	for _, test := range []struct{ method, path, body string }{
		{http.MethodGet, "/v1/real-person-verifications/callback/token-get?resultCode=0", ""},
		{http.MethodPost, "/v1/real-person-verifications/callback/token-post?resultCode=0", `{"resultCode":"9999"}`},
	} {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(test.method, test.path, strings.NewReader(test.body))
		request.Header.Set("Content-Type", "application/json")
		engine.ServeHTTP(recorder, request)
		require.Equal(t, http.StatusNoContent, recorder.Code)
	}

	source, err := os.ReadFile("asset-router.go")
	require.NoError(t, err)
	globalIndex := bytes.Index(source, []byte("GlobalAPIRateLimit()"))
	tokenIndex := bytes.Index(source, []byte("TokenAuth()"))
	modelIndex := bytes.Index(source, []byte("ModelRequestRateLimit()"))
	require.True(t, globalIndex >= 0 && globalIndex < tokenIndex && tokenIndex < modelIndex)
}
```

controller 用互相矛盾的 query/body `resultCode` 只断言 service 收到 path token；service 测试再证明查询失败不能激活、`GetVisualValidateResult` 明确返回 GroupId 才能激活当前 session。

- [ ] **Step 2: 运行 HTTP/i18n/logger 测试并确认 RED**

Run: `go test ./controller ./router ./middleware ./i18n -run 'RealPerson|BytePlusAssetRouter|Callback|SensitiveRequestPath|BytePlusAssetLocale' -count=1`

Expected: FAIL，缺少 handlers/routes、callback 服务、最终状态指标 middleware、专用 limiter、模板化函数和翻译键。

- [ ] **Step 3: 实现 controller DTO 绑定和错误 envelope**

所有用户 handler 复用现有 `bytePlusAssetTokenAllowsModel`、Token context user/group/usingGroup/specific channel。创建类读取 `strings.TrimSpace(c.GetHeader("Idempotency-Key"))` 并在空值时返回对应 400。

素材创建只按 Content-Type 分发：

```go
const bytePlusMultipartRequestMaxBytes int64 = (50 << 20) + (1 << 20)

var (
	createBytePlusRealPerson = service.CreateBytePlusRealPerson
	reverifyBytePlusRealPerson = service.ReverifyBytePlusRealPerson
	listBytePlusRealPersons = service.ListBytePlusRealPersons
	getBytePlusRealPerson = service.GetBytePlusRealPerson
	createBytePlusRealPersonAssetFromURL = service.CreateBytePlusRealPersonAssetFromURL
	createBytePlusRealPersonAssetFromMultipart = service.CreateBytePlusRealPersonAssetFromMultipart
	listBytePlusRealPersonAssets = service.ListBytePlusRealPersonAssets
	deleteBytePlusAsset = service.DeleteBytePlusAsset
	notifyBytePlusRealPersonVerificationCallback = service.NotifyBytePlusRealPersonVerificationCallback
)

func realPersonIdempotencyKey(c *gin.Context, errorCode types.ErrorCode) (string, bool) {
	key := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	if key == "" {
		writeBytePlusAssetError(c, types.InitOpenAIError(errorCode, http.StatusBadRequest))
		return "", false
	}
	return key, true
}

func decodeRealPersonJSON(c *gin.Context, target any, errorCode types.ErrorCode) bool {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 64<<10)
	if err := common.DecodeJsonDisallowUnknownFields(c.Request.Body, target); err != nil {
		writeBytePlusAssetError(c, types.InitOpenAIError(errorCode, http.StatusBadRequest))
		return false
	}
	return true
}

func realPersonPagination(c *gin.Context, errorCode types.ErrorCode) (int, string, bool) {
	limit := 20
	if raw := strings.TrimSpace(c.Query("limit")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 || parsed > 100 {
			writeBytePlusAssetError(c, types.InitOpenAIError(errorCode, http.StatusBadRequest))
			return 0, "", false
		}
		limit = parsed
	}
	return limit, strings.TrimSpace(c.Query("after")), true
}

func CreateBytePlusRealPerson(c *gin.Context) {
	if !bytePlusAssetTokenAllowsModel(c) {
		writeBytePlusAssetModelForbidden(c)
		return
	}
	key, ok := realPersonIdempotencyKey(c, types.ErrorCodeInvalidRealPersonRequest)
	if !ok { return }
	specificChannelID, ok := bytePlusAssetSpecificChannelID(c)
	if !ok {
		writeBytePlusAssetError(c, types.InitOpenAIError(types.ErrorCodeInvalidRealPersonRequest, http.StatusBadRequest))
		return
	}
	var request dto.BytePlusRealPersonCreateRequest
	if !decodeRealPersonJSON(c, &request, types.ErrorCodeInvalidRealPersonRequest) { return }
	response, apiErr := createBytePlusRealPerson(
		c.Request.Context(),
		common.GetContextKeyInt(c, constant.ContextKeyUserId),
		common.GetContextKeyString(c, constant.ContextKeyUserGroup),
		common.GetContextKeyString(c, constant.ContextKeyUsingGroup),
		specificChannelID, key, request,
	)
	if apiErr != nil {
		writeBytePlusAssetError(c, apiErr)
		return
	}
	if response == nil {
		writeBytePlusAssetError(c, types.InitOpenAIError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError))
		return
	}
	c.JSON(http.StatusOK, response)
}

func ReverifyBytePlusRealPerson(c *gin.Context) {
	if !bytePlusAssetTokenAllowsModel(c) { writeBytePlusAssetModelForbidden(c); return }
	personID := strings.TrimSpace(c.Param("person_id"))
	if personID == "" {
		writeBytePlusAssetError(c, types.InitOpenAIError(types.ErrorCodeInvalidRealPersonRequest, http.StatusBadRequest))
		return
	}
	key, ok := realPersonIdempotencyKey(c, types.ErrorCodeInvalidRealPersonRequest)
	if !ok { return }
	response, apiErr := reverifyBytePlusRealPerson(c.Request.Context(), common.GetContextKeyInt(c, constant.ContextKeyUserId), personID, key)
	if apiErr != nil { writeBytePlusAssetError(c, apiErr); return }
	if response == nil {
		writeBytePlusAssetError(c, types.InitOpenAIError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError))
		return
	}
	c.JSON(http.StatusOK, response)
}

func ListBytePlusRealPersons(c *gin.Context) {
	if !bytePlusAssetTokenAllowsModel(c) { writeBytePlusAssetModelForbidden(c); return }
	limit, after, ok := realPersonPagination(c, types.ErrorCodeInvalidRealPersonRequest)
	if !ok { return }
	response, apiErr := listBytePlusRealPersons(c.Request.Context(), common.GetContextKeyInt(c, constant.ContextKeyUserId), limit, after)
	if apiErr != nil { writeBytePlusAssetError(c, apiErr); return }
	if response == nil {
		writeBytePlusAssetError(c, types.InitOpenAIError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError))
		return
	}
	c.JSON(http.StatusOK, response)
}

func GetBytePlusRealPerson(c *gin.Context) {
	if !bytePlusAssetTokenAllowsModel(c) { writeBytePlusAssetModelForbidden(c); return }
	personID := strings.TrimSpace(c.Param("person_id"))
	if personID == "" { writeBytePlusAssetError(c, types.InitOpenAIError(types.ErrorCodeInvalidRealPersonRequest, http.StatusBadRequest)); return }
	response, apiErr := getBytePlusRealPerson(c.Request.Context(), common.GetContextKeyInt(c, constant.ContextKeyUserId), personID)
	if apiErr != nil { writeBytePlusAssetError(c, apiErr); return }
	if response == nil {
		writeBytePlusAssetError(c, types.InitOpenAIError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError))
		return
	}
	c.JSON(http.StatusOK, response)
}

func ListBytePlusRealPersonAssets(c *gin.Context) {
	if !bytePlusAssetTokenAllowsModel(c) { writeBytePlusAssetModelForbidden(c); return }
	personID := strings.TrimSpace(c.Param("person_id"))
	if personID == "" {
		writeBytePlusAssetError(c, types.InitOpenAIError(types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest))
		return
	}
	limit, after, ok := realPersonPagination(c, types.ErrorCodeInvalidAssetRequest)
	if !ok { return }
	response, apiErr := listBytePlusRealPersonAssets(c.Request.Context(), common.GetContextKeyInt(c, constant.ContextKeyUserId), personID, limit, after)
	if apiErr != nil { writeBytePlusAssetError(c, apiErr); return }
	if response == nil {
		writeBytePlusAssetError(c, types.InitOpenAIError(types.ErrorCodeAssetStorageError, http.StatusInternalServerError))
		return
	}
	c.JSON(http.StatusOK, response)
}

func CreateBytePlusRealPersonAsset(c *gin.Context) {
	if !bytePlusAssetTokenAllowsModel(c) {
		writeBytePlusAssetModelForbidden(c)
		return
	}
	personID := strings.TrimSpace(c.Param("person_id"))
	if personID == "" {
		writeBytePlusAssetError(c, types.InitOpenAIError(types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest))
		return
	}
	idempotencyKey, ok := realPersonIdempotencyKey(c, types.ErrorCodeInvalidAssetRequest)
	if !ok { return }
	mediaType, _, err := mime.ParseMediaType(c.GetHeader("Content-Type"))
	if err != nil {
		writeBytePlusAssetError(c, types.InitOpenAIError(types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest))
		return
	}
	userID := common.GetContextKeyInt(c, constant.ContextKeyUserId)
	var response *dto.BytePlusAssetResponse
	var apiErr *types.NewAPIError
	switch mediaType {
	case "application/json":
		var request dto.BytePlusRealPersonAssetCreateRequest
		if !decodeRealPersonJSON(c, &request, types.ErrorCodeInvalidAssetRequest) { return }
		response, apiErr = createBytePlusRealPersonAssetFromURL(c.Request.Context(), userID, personID, idempotencyKey, request)
	case "multipart/form-data":
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, bytePlusMultipartRequestMaxBytes)
		response, apiErr = createBytePlusRealPersonAssetFromMultipart(c.Request.Context(), userID, personID, idempotencyKey, c.Request)
	default:
		writeBytePlusAssetError(c, types.InitOpenAIError(types.ErrorCodeAssetMediaUnsupported, http.StatusUnsupportedMediaType))
		return
	}
	if apiErr != nil {
		writeBytePlusAssetError(c, apiErr)
		return
	}
	if response == nil {
		writeBytePlusAssetError(c, types.InitOpenAIError(types.ErrorCodeAssetStorageError, http.StatusInternalServerError))
		return
	}
	c.JSON(http.StatusOK, response)
}

func DeleteBytePlusAsset(c *gin.Context) {
	if !bytePlusAssetTokenAllowsModel(c) {
		writeBytePlusAssetModelForbidden(c)
		return
	}
	assetID := strings.TrimSpace(c.Param("asset_id"))
	if assetID == "" {
		writeBytePlusAssetError(c, types.InitOpenAIError(types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest))
		return
	}
	if apiErr := deleteBytePlusAsset(c.Request.Context(), common.GetContextKeyInt(c, constant.ContextKeyUserId), assetID); apiErr != nil {
		writeBytePlusAssetError(c, apiErr)
		return
	}
	c.Status(http.StatusNoContent)
}

func BytePlusRealPersonVerificationCallback(c *gin.Context) {
	callbackToken := strings.TrimSpace(c.Param("callback_token"))
	if callbackToken != "" {
		notifyBytePlusRealPersonVerificationCallback(c.Request.Context(), callbackToken)
	}
	c.Status(http.StatusNoContent)
}
```

上面代码是完整 handler 集合。controller 文件不得直接导入 `encoding/json`；严格 JSON 解码必须走仓库已有的 `common.DecodeJsonDisallowUnknownFields`。分页 `limit` 默认 20、最大 100，未知 `after` 由 service 返回对应 400；真人档案 nil 结果映射 `real_person_storage_error`，素材 nil 结果映射 `asset_storage_error`；DELETE service 成功后返回空 body 204。

- [ ] **Step 4: 实现 callback 信号服务并统一 204**

`service/byteplus_real_person.go`：

```go
func NotifyBytePlusRealPersonVerificationCallback(ctx context.Context, callbackToken string) {
	hash := sha256.Sum256([]byte(callbackToken))
	session, err := model.GetBytePlusVisualValidationSessionByCallbackHash(hex.EncodeToString(hash[:]))
	if err != nil || session.ExpiresAt <= bytePlusAssetNow() {
		return
	}
	profile, err := model.GetBytePlusRealPersonProfileByID(session.ProfileId)
	if err != nil || profile.CurrentValidationSessionId == nil || *profile.CurrentValidationSessionId != session.Id {
		return
	}
	_ = SyncBytePlusRealPersonVerification(ctx, profile.UserId, profile)
}
```

controller 不解析、记录或传递 query/body 中的 `resultCode`；状态只由服务端 `GetVisualValidateResult` 查询决定。伪造、过期、重复、旧 session、上游失败或成功都统一返回 204。直接单测调用 handler 且 token 为空时也返回 204 且不唤醒 service；实际 Gin 路由只匹配非空的 `/:callback_token`。内部 DB/上游问题只记录脱敏告警。

- [ ] **Step 5: 注册用户路由、callback 路由和 DELETE**

```go
func SetBytePlusAssetRouter(router *gin.Engine) {
	assetRouter := router.Group("/v1")
	assetRouter.Use(middleware.RouteTag("asset"))
	assetRouter.Use(middleware.GlobalAPIRateLimit())
	assetRouter.Use(middleware.TokenAuth())
	assetRouter.Use(middleware.ModelRequestRateLimit())
	{
		assetRouter.POST("/assets", controller.CreateBytePlusAsset)
		assetRouter.GET("/assets/:asset_id", controller.GetBytePlusAsset)
		assetRouter.DELETE("/assets/:asset_id", controller.DeleteBytePlusAsset)
		assetRouter.POST("/real-persons", controller.CreateBytePlusRealPerson)
		assetRouter.POST("/real-persons/:person_id/verification-sessions", controller.ReverifyBytePlusRealPerson)
		assetRouter.GET("/real-persons", controller.ListBytePlusRealPersons)
		assetRouter.GET("/real-persons/:person_id", controller.GetBytePlusRealPerson)
		assetRouter.POST("/real-persons/:person_id/assets", controller.CreateBytePlusRealPersonAsset)
		assetRouter.GET("/real-persons/:person_id/assets", controller.ListBytePlusRealPersonAssets)
	}

	callbackRouter := router.Group("/v1/real-person-verifications")
	callbackRouter.Use(middleware.RouteTag("real_person_callback"))
	callbackRouter.Use(middleware.RealPersonVerificationCallbackMetrics())
	callbackRouter.Use(middleware.RealPersonVerificationCallbackRateLimit())
	callbackRouter.GET("/callback/:callback_token", controller.BytePlusRealPersonVerificationCallback)
	callbackRouter.POST("/callback/:callback_token", controller.BytePlusRealPersonVerificationCallback)
}
```

BytePlus 官方只说明把 `resultCode` 追加到 CallbackURL，没有承诺 HTTP method。为避免上游实现差异导致认证永远无法被唤醒，Flatkey 对同一随机 callback token 同时接受 GET 和 POST；两条路由共享同一专用 IP limiter、同一 handler 和统一 204 响应。callback 仍只是一条触发信号，任何 method/query/body 都不能直接改变档案状态。指标 middleware 必须注册在 limiter 外层，才能同时记录 handler 的 204、limiter 的 429 和内部 5xx；`RouteTag` 仍保持最外层。

- [ ] **Step 6: 在 formatter 内模板化敏感 path，并加最终状态指标与专用 IP 限流**

`middleware/logger.go`：

```go
func templateSensitiveRequestPath(path string) string {
	const prefix = "/v1/real-person-verifications/callback/"
	if strings.HasPrefix(path, prefix) && strings.TrimPrefix(path, prefix) != "" {
		return prefix + ":callback_token"
	}
	return path
}
```

`SetUpLogger` 的 `fmt.Sprintf` 使用 `templateSensitiveRequestPath(param.Path)`；必须在 formatter 内处理，不能依赖 handler/middleware 在请求后覆盖。`middleware/rate-limit.go` 增加：

`middleware/real_person_callback_metrics.go`：

```go
func RealPersonVerificationCallbackMetrics() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
		perfmetrics.RecordBytePlusRealPersonCallbackStatus(c.Writer.Status())
	}
}
```

该 middleware 不读取 path token、query、body、user ID 或 channel ID；它只在内层链完成后把最终数字状态交给 Task 9 的固定分类函数。`callbackRouter.Use` 顺序必须是 `RouteTag` → `RealPersonVerificationCallbackMetrics` → `RealPersonVerificationCallbackRateLimit`。

`middleware/rate-limit.go` 增加：

```go
func RealPersonVerificationCallbackRateLimit() func(c *gin.Context) {
	return rateLimitFactory(120, 60, "RPV_CB")
}
```

- [ ] **Step 7: 添加四个完整 locale 并覆盖所有新错误码**

在 `i18n/keys.go` 添加以下完整键集合；`MsgAssetUpstreamError` 和 `MsgAssetStorageError` 已存在，保留并继续覆盖：

```go
const (
	MsgRealPersonInvalidRequest     = "real_person.invalid_request"
	MsgRealPersonNotFound           = "real_person.not_found"
	MsgRealPersonNotActive          = "real_person.not_active"
	MsgRealPersonChannelUnavailable = "real_person.channel_unavailable"
	MsgRealPersonStorageError       = "real_person.storage_error"
	MsgVerificationInProgress       = "verification.in_progress"
	MsgVerificationUpstreamError    = "verification.upstream_error"
	MsgIdempotencyConflict          = "idempotency.conflict"
	MsgIdempotencyOutcomeUnknown    = "idempotency.outcome_unknown"
	MsgAssetProfileConflict         = "asset.profile_conflict"
	MsgAssetFileTooLarge            = "asset.file_too_large"
	MsgAssetMediaUnsupported        = "asset.media_unsupported"
	MsgAssetUploadFailed            = "asset.upload_failed"
)
```

在 `bytePlusAssetI18nKey` 的现有 switch 中逐项加入：

```go
case types.ErrorCodeInvalidRealPersonRequest:
	return i18n.MsgRealPersonInvalidRequest
case types.ErrorCodeRealPersonNotFound:
	return i18n.MsgRealPersonNotFound
case types.ErrorCodeRealPersonNotActive:
	return i18n.MsgRealPersonNotActive
case types.ErrorCodeVerificationInProgress:
	return i18n.MsgVerificationInProgress
case types.ErrorCodeIdempotencyConflict:
	return i18n.MsgIdempotencyConflict
case types.ErrorCodeIdempotencyOutcomeUnknown:
	return i18n.MsgIdempotencyOutcomeUnknown
case types.ErrorCodeAssetProfileConflict:
	return i18n.MsgAssetProfileConflict
case types.ErrorCodeAssetFileTooLarge:
	return i18n.MsgAssetFileTooLarge
case types.ErrorCodeAssetMediaUnsupported:
	return i18n.MsgAssetMediaUnsupported
case types.ErrorCodeAssetUploadFailed:
	return i18n.MsgAssetUploadFailed
case types.ErrorCodeVerificationUpstreamError:
	return i18n.MsgVerificationUpstreamError
case types.ErrorCodeRealPersonChannelUnavailable:
	return i18n.MsgRealPersonChannelUnavailable
case types.ErrorCodeRealPersonStorageError:
	return i18n.MsgRealPersonStorageError
```

`i18n/byteplus_asset_test.go` 的语言固定为 `LangEn/LangZhCN/LangZhTW/LangPt`，并用下面的显式列表验证全部公开错误都有非空、非 key 原文的自然语言翻译：

```go
keys := []string{
	MsgAssetInvalidRequest,
	MsgAssetNotFound,
	MsgAssetNotReady,
	MsgAssetFailed,
	MsgAssetChannelConflict,
	MsgAssetChannelUnavailable,
	MsgAssetGroupInitializing,
	MsgAssetUpstreamError,
	MsgAssetStorageError,
	MsgRealPersonInvalidRequest,
	MsgRealPersonNotFound,
	MsgRealPersonNotActive,
	MsgRealPersonChannelUnavailable,
	MsgRealPersonStorageError,
	MsgVerificationInProgress,
	MsgVerificationUpstreamError,
	MsgIdempotencyConflict,
	MsgIdempotencyOutcomeUnknown,
	MsgAssetProfileConflict,
	MsgAssetFileTooLarge,
	MsgAssetMediaUnsupported,
	MsgAssetUploadFailed,
}
```

四个 YAML 都必须为自然语言翻译，不能回退为 key。

controller 的错误映射必须一一对应 Task 3 的 `types.ErrorCode`，并继续清空 `Param/Metadata`。404 对不存在和跨用户保持同一消息；任何上游原文只进入受限脱敏日志，不进入翻译参数。

- [ ] **Step 8: 运行 HTTP、callback、logger、路由和 locale 测试并确认 GREEN**

Run: `gofmt -w controller/byteplus_real_person.go controller/byteplus_real_person_test.go controller/byteplus_asset.go controller/byteplus_asset_test.go router/asset-router.go router/asset_router_test.go middleware/rate-limit.go middleware/real_person_callback_metrics.go middleware/real_person_callback_metrics_test.go middleware/logger.go middleware/logger_test.go service/byteplus_real_person.go service/byteplus_real_person_test.go i18n/keys.go i18n/byteplus_asset_test.go`

Run: `go test ./controller ./router ./middleware ./i18n ./service -run 'RealPerson|BytePlusAssetRouter|Callback|SensitiveRequestPath|BytePlusAssetLocale' -race -count=1`

Expected: PASS；用户路由依次经过 global/token/model limiter，匿名 callback 经过外层固定指标和内层专用 limiter，最终 204/429/other_4xx/5xx 都进入固定时序，所有正常 callback 结果统一 204，日志中没有真实 token。

- [ ] **Step 9: 提交公开 HTTP 与隐私边界**

```bash
git add controller/byteplus_real_person.go controller/byteplus_real_person_test.go controller/byteplus_asset.go controller/byteplus_asset_test.go router/asset-router.go router/asset_router_test.go middleware/rate-limit.go middleware/real_person_callback_metrics.go middleware/real_person_callback_metrics_test.go middleware/logger.go middleware/logger_test.go service/byteplus_real_person.go service/byteplus_real_person_test.go i18n/keys.go i18n/byteplus_asset_test.go i18n/locales/en.yaml i18n/locales/zh-CN.yaml i18n/locales/zh-TW.yaml i18n/locales/pt.yaml
git commit -m "Expose real-person assets without exposing verification authority" -m "Constraint: Callback tokens live in the URL while access logs currently format raw request paths" -m "Rejected: Redacting in the handler | the logger formatter may run after middleware state is lost or before handler cleanup" -m "Confidence: high" -m "Scope-risk: broad" -m "Directive: Callback responses remain uniform 204 signals; only GetVisualValidateResult is authoritative, and metrics must wrap the limiter" -m "Tested: Auth and model access, JSON/multipart dispatch, idempotency header, ownership 404, callback forgery/replay/order, final 204/429/4xx/5xx metrics, dedicated rate limit, route registration, path templates, and four-locale coverage"
```

### Task 12: 锁定 OpenAPI relay 契约并发布真人素材调用文档

**Files:**
- Create: `router/byteplus_real_person_openapi_test.go`
- Modify: `docs/openapi/relay.json`
- Create: `docs/api/byteplus-real-person-asset-api.md`
- Modify: `docs/api/byteplus-asset-api.md`
- Modify: `docs/api/flatkey-video-api.md`
- Do not modify: `docs/openapi/api.json`

- [ ] **Step 1: 写出 relay-only OpenAPI 契约失败测试**

```go
package router

import (
	"os"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestBytePlusRealPersonOpenAPIContract(t *testing.T) {
	relay := readOpenAPIDocument(t, "../docs/openapi/relay.json")
	admin := readOpenAPIDocument(t, "../docs/openapi/api.json")
	relayPaths := openAPIObject(t, relay, "paths")
	adminPaths := openAPIObject(t, admin, "paths")

	servers := relay["servers"].([]any)
	require.NotEmpty(t, servers)
	require.Equal(t, "https://router.flatkey.ai", servers[0].(map[string]any)["url"])

	required := map[string][]string{
		"/v1/real-persons":                                        {"post", "get"},
		"/v1/real-persons/{person_id}":                            {"get"},
		"/v1/real-persons/{person_id}/verification-sessions":      {"post"},
		"/v1/real-persons/{person_id}/assets":                     {"post", "get"},
		"/v1/assets/{asset_id}":                                   {"get", "delete"},
		"/v1/real-person-verifications/callback/{callback_token}": {"get", "post"},
	}
	for path, methods := range required {
		require.Contains(t, relayPaths, path)
		require.NotContains(t, adminPaths, path, "relay API must not be added to docs/openapi/api.json")
		for _, method := range methods {
			requireOpenAPIOperation(t, relayPaths, path, method)
		}
	}

	createPerson := requireOpenAPIOperation(t, relayPaths, "/v1/real-persons", "post")
	requireBearerSecurity(t, createPerson)
	requireRequiredHeader(t, createPerson, "Idempotency-Key")
	requireRequestContentType(t, createPerson, "application/json")
	requireResponseStatus(t, createPerson, "200")

	for _, operation := range []map[string]any{
		requireOpenAPIOperation(t, relayPaths, "/v1/real-persons", "get"),
		requireOpenAPIOperation(t, relayPaths, "/v1/real-persons/{person_id}", "get"),
		requireOpenAPIOperation(t, relayPaths, "/v1/real-persons/{person_id}/assets", "get"),
		requireOpenAPIOperation(t, relayPaths, "/v1/assets/{asset_id}", "delete"),
	} {
		requireBearerSecurity(t, operation)
	}

	reverify := requireOpenAPIOperation(t, relayPaths, "/v1/real-persons/{person_id}/verification-sessions", "post")
	requireBearerSecurity(t, reverify)
	requireRequiredHeader(t, reverify, "Idempotency-Key")

	createAsset := requireOpenAPIOperation(t, relayPaths, "/v1/real-persons/{person_id}/assets", "post")
	requireBearerSecurity(t, createAsset)
	requireRequiredHeader(t, createAsset, "Idempotency-Key")
	requireRequestContentType(t, createAsset, "application/json")
	requireRequestContentType(t, createAsset, "multipart/form-data")
	multipart := openAPIObject(t, openAPIObject(t, openAPIObject(t, createAsset, "requestBody"), "content"), "multipart/form-data")
	multipartSchema := openAPIObject(t, multipart, "schema")
	require.ElementsMatch(t, []any{"file", "asset_type"}, multipartSchema["required"])
	multipartProperties := openAPIObject(t, multipartSchema, "properties")
	require.Equal(t, "binary", openAPIObject(t, multipartProperties, "file")["format"])
	require.Contains(t, multipartProperties, "name")

	deleteAsset := requireOpenAPIOperation(t, relayPaths, "/v1/assets/{asset_id}", "delete")
	requireResponseStatus(t, deleteAsset, "204")

	for _, method := range []string{"get", "post"} {
		callback := requireOpenAPIOperation(t, relayPaths, "/v1/real-person-verifications/callback/{callback_token}", method)
		requireExplicitNoSecurity(t, callback)
		requireResponseStatus(t, callback, "204")
	}

	components := openAPIObject(t, relay, "components")
	schemas := openAPIObject(t, components, "schemas")
	for _, schemaName := range []string{
		"BytePlusRealPersonCreateRequest",
		"BytePlusRealPerson",
		"BytePlusRealPersonList",
		"BytePlusRealPersonAssetCreateRequest",
		"BytePlusRealPersonAssetList",
		"BytePlusAsset",
	} {
		require.Contains(t, schemas, schemaName)
	}

	assetProperties := openAPIObject(t, openAPIObject(t, schemas, "BytePlusAsset"), "properties")
	for _, property := range []string{"id", "object", "asset_type", "status", "name", "asset_uri", "failure_code", "created_at"} {
		require.Contains(t, assetProperties, property)
	}
	assetRequired := openAPIObject(t, schemas, "BytePlusAsset")["required"].([]any)
	require.NotContains(t, assetRequired, "moderation", "real-person asset responses omit moderation")

	propertyNames := map[string]bool{}
	for _, schemaName := range []string{"BytePlusRealPerson", "BytePlusRealPersonList", "BytePlusRealPersonAssetCreateRequest", "BytePlusRealPersonAssetList", "BytePlusAsset"} {
		collectOpenAPIPropertyNames(schemas[schemaName], propertyNames)
	}
	for _, forbidden := range []string{
		"upstream_group_id", "group_id", "channel_id", "upstream_asset_id", "byted_token",
		"h5_link", "callback_token", "tos_url", "object_key", "source_url", "signed_url",
		"project_name", "access_key_id", "secret_access_key",
	} {
		require.False(t, propertyNames[forbidden], "sensitive schema property %q must not be public", forbidden)
	}
}

func readOpenAPIDocument(t *testing.T, path string) map[string]any {
	t.Helper()
	body, err := os.ReadFile(path)
	require.NoError(t, err)
	var document map[string]any
	require.NoError(t, common.Unmarshal(body, &document))
	require.Equal(t, "3.0.1", document["openapi"])
	return document
}

func openAPIObject(t *testing.T, object map[string]any, key string) map[string]any {
	t.Helper()
	value, ok := object[key].(map[string]any)
	require.True(t, ok, "%q must be an object", key)
	return value
}

func requireOpenAPIOperation(t *testing.T, paths map[string]any, path, method string) map[string]any {
	t.Helper()
	pathItem := openAPIObject(t, paths, path)
	operation, ok := pathItem[method].(map[string]any)
	require.True(t, ok, "%s %s must be documented", strings.ToUpper(method), path)
	return operation
}

func requireBearerSecurity(t *testing.T, operation map[string]any) {
	t.Helper()
	security, ok := operation["security"].([]any)
	require.True(t, ok)
	require.NotEmpty(t, security)
	first := security[0].(map[string]any)
	require.Contains(t, first, "BearerAuth")
}

func requireExplicitNoSecurity(t *testing.T, operation map[string]any) {
	t.Helper()
	security, ok := operation["security"].([]any)
	require.True(t, ok, "anonymous callback must override global security")
	require.Empty(t, security)
}

func requireRequiredHeader(t *testing.T, operation map[string]any, name string) {
	t.Helper()
	parameters, ok := operation["parameters"].([]any)
	require.True(t, ok)
	for _, raw := range parameters {
		parameter := raw.(map[string]any)
		if parameter["in"] == "header" && parameter["name"] == name {
			require.Equal(t, true, parameter["required"])
			return
		}
	}
	require.Failf(t, "required header missing", "%s", name)
}

func requireRequestContentType(t *testing.T, operation map[string]any, contentType string) {
	t.Helper()
	requestBody := openAPIObject(t, operation, "requestBody")
	require.Equal(t, true, requestBody["required"])
	content := openAPIObject(t, requestBody, "content")
	require.Contains(t, content, contentType)
}

func requireResponseStatus(t *testing.T, operation map[string]any, status string) {
	t.Helper()
	responses := openAPIObject(t, operation, "responses")
	response := openAPIObject(t, responses, status)
	require.NotEmpty(t, response["description"])
}

func collectOpenAPIPropertyNames(value any, names map[string]bool) {
	switch typed := value.(type) {
	case map[string]any:
		if properties, ok := typed["properties"].(map[string]any); ok {
			for name := range properties {
				names[name] = true
			}
		}
		for _, child := range typed {
			collectOpenAPIPropertyNames(child, names)
		}
	case []any:
		for _, child := range typed {
			collectOpenAPIPropertyNames(child, names)
		}
	}
}
```

- [ ] **Step 2: 运行 OpenAPI 契约测试并确认 RED**

Run: `go test ./router -run TestBytePlusRealPersonOpenAPIContract -count=1`

Expected: FAIL；`relay.json` 尚无真人档案、双输入素材、DELETE、GET/POST callback 与公开 schema，且 `servers` 尚未固定为 `https://router.flatkey.ai`。`docs/openapi/api.json` 必须继续不包含真人 relay 路径。

- [ ] **Step 3: 在 `relay.json` 添加完整路径、状态码和双 content type**

把根级 `servers` 从空数组改为：

```json
"servers": [
  {"url": "https://router.flatkey.ai"}
]
```

在 `components.responses` 中加入一个复用的公开错误响应：

```json
"BytePlusAssetError": {
  "description": "OpenAI-compatible public error envelope",
  "content": {
    "application/json": {
      "schema": {"$ref": "#/components/schemas/ErrorResponse"}
    }
  }
}
```

在 `paths` 中加入以下精确 operation；所有用户 operation 显式声明 `BearerAuth`，callback 显式写 `"security": []` 覆盖根级鉴权：

```json
"/v1/real-persons": {
  "post": {
    "summary": "创建真人档案并启动认证",
    "operationId": "createBytePlusRealPerson",
    "tags": ["素材库"],
    "security": [{"BearerAuth": []}],
    "parameters": [{"name":"Idempotency-Key","in":"header","required":true,"schema":{"type":"string","minLength":1,"maxLength":255}}],
    "requestBody": {"required":true,"content":{"application/json":{"schema":{"$ref":"#/components/schemas/BytePlusRealPersonCreateRequest"}}}},
    "responses": {
      "200":{"description":"档案和一次性认证链接","content":{"application/json":{"schema":{"$ref":"#/components/schemas/BytePlusRealPerson"}}}},
      "400":{"$ref":"#/components/responses/BytePlusAssetError"},
      "403":{"$ref":"#/components/responses/BytePlusAssetError"},
      "409":{"$ref":"#/components/responses/BytePlusAssetError"},
      "500":{"$ref":"#/components/responses/BytePlusAssetError"},
      "502":{"$ref":"#/components/responses/BytePlusAssetError"},
      "503":{"$ref":"#/components/responses/BytePlusAssetError"}
    }
  },
  "get": {
    "summary": "列出当前用户的真人档案",
    "operationId": "listBytePlusRealPersons",
    "tags": ["素材库"],
    "security": [{"BearerAuth": []}],
    "parameters": [
      {"name":"limit","in":"query","required":false,"schema":{"type":"integer","minimum":1,"maximum":100,"default":20}},
      {"name":"after","in":"query","required":false,"schema":{"type":"string"}}
    ],
    "responses": {
      "200":{"description":"真人档案游标列表","content":{"application/json":{"schema":{"$ref":"#/components/schemas/BytePlusRealPersonList"}}}},
      "400":{"$ref":"#/components/responses/BytePlusAssetError"},
      "403":{"$ref":"#/components/responses/BytePlusAssetError"},
      "500":{"$ref":"#/components/responses/BytePlusAssetError"}
    }
  }
},
"/v1/real-persons/{person_id}": {
  "get": {
    "summary": "查询真人档案",
    "operationId": "getBytePlusRealPerson",
    "tags": ["素材库"],
    "security": [{"BearerAuth": []}],
    "parameters": [{"name":"person_id","in":"path","required":true,"schema":{"type":"string","pattern":"^rph_[A-Za-z0-9]+$"}}],
    "responses": {
      "200":{"description":"真人档案","content":{"application/json":{"schema":{"$ref":"#/components/schemas/BytePlusRealPerson"}}}},
      "400":{"$ref":"#/components/responses/BytePlusAssetError"},
      "403":{"$ref":"#/components/responses/BytePlusAssetError"},
      "404":{"$ref":"#/components/responses/BytePlusAssetError"},
      "500":{"$ref":"#/components/responses/BytePlusAssetError"}
    }
  }
},
"/v1/real-persons/{person_id}/verification-sessions": {
  "post": {
    "summary": "重新发起真人认证",
    "operationId": "reverifyBytePlusRealPerson",
    "tags": ["素材库"],
    "security": [{"BearerAuth": []}],
    "parameters": [
      {"name":"person_id","in":"path","required":true,"schema":{"type":"string","pattern":"^rph_[A-Za-z0-9]+$"}},
      {"name":"Idempotency-Key","in":"header","required":true,"schema":{"type":"string","minLength":1,"maxLength":255}}
    ],
    "responses": {
      "200":{"description":"新认证会话和一次性链接","content":{"application/json":{"schema":{"$ref":"#/components/schemas/BytePlusRealPerson"}}}},
      "400":{"$ref":"#/components/responses/BytePlusAssetError"},
      "403":{"$ref":"#/components/responses/BytePlusAssetError"},
      "404":{"$ref":"#/components/responses/BytePlusAssetError"},
      "409":{"$ref":"#/components/responses/BytePlusAssetError"},
      "500":{"$ref":"#/components/responses/BytePlusAssetError"},
      "502":{"$ref":"#/components/responses/BytePlusAssetError"},
      "503":{"$ref":"#/components/responses/BytePlusAssetError"}
    }
  }
},
"/v1/real-persons/{person_id}/assets": {
  "post": {
    "summary": "从公网 HTTPS URL 或本地文件创建真人素材",
    "operationId": "createBytePlusRealPersonAsset",
    "tags": ["素材库"],
    "security": [{"BearerAuth": []}],
    "parameters": [
      {"name":"person_id","in":"path","required":true,"schema":{"type":"string","pattern":"^rph_[A-Za-z0-9]+$"}},
      {"name":"Idempotency-Key","in":"header","required":true,"schema":{"type":"string","minLength":1,"maxLength":255}}
    ],
    "requestBody": {
      "required": true,
      "content": {
        "application/json": {"schema":{"$ref":"#/components/schemas/BytePlusRealPersonAssetCreateRequest"}},
        "multipart/form-data": {
          "schema": {
            "type":"object",
            "required":["file","asset_type"],
            "properties": {
              "file":{"type":"string","format":"binary","description":"本地图片、视频或音频"},
              "asset_type":{"type":"string","enum":["Image","Video","Audio"]},
              "name":{"type":"string","maxLength":128}
            }
          }
        }
      }
    },
    "responses": {
      "200":{"description":"真人素材创建请求已提交","content":{"application/json":{"schema":{"$ref":"#/components/schemas/BytePlusAsset"}}}},
      "400":{"$ref":"#/components/responses/BytePlusAssetError"},
      "403":{"$ref":"#/components/responses/BytePlusAssetError"},
      "404":{"$ref":"#/components/responses/BytePlusAssetError"},
      "409":{"$ref":"#/components/responses/BytePlusAssetError"},
      "413":{"$ref":"#/components/responses/BytePlusAssetError"},
      "415":{"$ref":"#/components/responses/BytePlusAssetError"},
      "500":{"$ref":"#/components/responses/BytePlusAssetError"},
      "502":{"$ref":"#/components/responses/BytePlusAssetError"},
      "503":{"$ref":"#/components/responses/BytePlusAssetError"}
    }
  },
  "get": {
    "summary": "列出真人档案下的素材",
    "operationId": "listBytePlusRealPersonAssets",
    "tags": ["素材库"],
    "security": [{"BearerAuth": []}],
    "parameters": [
      {"name":"person_id","in":"path","required":true,"schema":{"type":"string","pattern":"^rph_[A-Za-z0-9]+$"}},
      {"name":"limit","in":"query","required":false,"schema":{"type":"integer","minimum":1,"maximum":100,"default":20}},
      {"name":"after","in":"query","required":false,"schema":{"type":"string"}}
    ],
    "responses": {
      "200":{"description":"真人素材游标列表","content":{"application/json":{"schema":{"$ref":"#/components/schemas/BytePlusRealPersonAssetList"}}}},
      "400":{"$ref":"#/components/responses/BytePlusAssetError"},
      "403":{"$ref":"#/components/responses/BytePlusAssetError"},
      "404":{"$ref":"#/components/responses/BytePlusAssetError"},
      "500":{"$ref":"#/components/responses/BytePlusAssetError"}
    }
  }
},
"/v1/real-person-verifications/callback/{callback_token}": {
  "get": {
    "summary":"BytePlus 真人认证唤醒信号",
    "operationId":"notifyBytePlusRealPersonVerificationByGet",
    "tags":["素材库"],
    "security":[],
    "parameters":[{"name":"callback_token","in":"path","required":true,"schema":{"type":"string"}}],
    "responses":{"204":{"description":"信号已接收；不返回认证结果"}}
  },
  "post": {
    "summary":"BytePlus 真人认证唤醒信号",
    "operationId":"notifyBytePlusRealPersonVerificationByPost",
    "tags":["素材库"],
    "security":[],
    "parameters":[{"name":"callback_token","in":"path","required":true,"schema":{"type":"string"}}],
    "responses":{"204":{"description":"信号已接收；不返回认证结果"}}
  }
}
```

在现有 `/v1/assets/{asset_id}` path item 中保留 GET 并新增：

```json
"delete": {
  "summary":"幂等删除素材",
  "operationId":"deleteBytePlusAsset",
  "tags":["素材库"],
  "security":[{"BearerAuth":[]}],
  "parameters":[{"name":"asset_id","in":"path","required":true,"schema":{"type":"string","pattern":"^ast_[A-Za-z0-9]{32}$"}}],
  "responses": {
    "204":{"description":"删除已接受或素材已删除"},
    "400":{"$ref":"#/components/responses/BytePlusAssetError"},
    "403":{"$ref":"#/components/responses/BytePlusAssetError"},
    "404":{"$ref":"#/components/responses/BytePlusAssetError"},
    "500":{"$ref":"#/components/responses/BytePlusAssetError"}
  }
}
```

- [ ] **Step 4: 添加公开 schema，扩展现有素材响应而不泄露内部字段**

在 `components.schemas` 加入：

```json
"BytePlusRealPersonCreateRequest": {
  "type":"object",
  "required":["name"],
  "additionalProperties":false,
  "properties":{"name":{"type":"string","minLength":1,"maxLength":64}}
},
"BytePlusRealPerson": {
  "type":"object",
  "required":["id","object","name","status","created_at"],
  "properties": {
    "id":{"type":"string","pattern":"^rph_[A-Za-z0-9]+$"},
    "object":{"type":"string","enum":["real_person"]},
    "name":{"type":"string"},
    "status":{"type":"string","enum":["pending_verification","verifying","active","failed","expired"]},
    "verification_url":{"type":"string","format":"uri","description":"仅创建或重新认证的安全重放窗口内出现的一次性链接"},
    "verification_expires_at":{"type":"integer","format":"int64"},
    "created_at":{"type":"integer","format":"int64"}
  }
},
"BytePlusRealPersonList": {
  "type":"object",
  "required":["object","data","has_more"],
  "properties": {
    "object":{"type":"string","enum":["list"]},
    "data":{"type":"array","items":{"$ref":"#/components/schemas/BytePlusRealPerson"}},
    "has_more":{"type":"boolean"},
    "next_after":{"type":"string"}
  }
},
"BytePlusRealPersonAssetCreateRequest": {
  "type":"object",
  "required":["url","asset_type"],
  "additionalProperties":false,
  "properties": {
    "url":{"type":"string","format":"uri","pattern":"^https://"},
    "asset_type":{"type":"string","enum":["Image","Video","Audio"]},
    "name":{"type":"string","maxLength":128}
  }
},
"BytePlusRealPersonAssetList": {
  "type":"object",
  "required":["object","data","has_more"],
  "properties": {
    "object":{"type":"string","enum":["list"]},
    "data":{"type":"array","items":{"$ref":"#/components/schemas/BytePlusAsset"}},
    "has_more":{"type":"boolean"},
    "next_after":{"type":"string"}
  }
}
```

把现有 `BytePlusAsset.required` 改为 `id/object/asset_type/status/created_at`，保留可选 `moderation` 以兼容虚拟素材，并给 `properties` 增加：

```json
"name":{"type":"string","description":"真人素材名称；虚拟素材省略"},
"asset_uri":{"type":"string","pattern":"^asset://ast_[A-Za-z0-9]{32}$","description":"可直接放入 Seedance content[] 的公开引用"},
"failure_code":{"type":"string","description":"Failed 状态的稳定失败码"}
```

`status.enum` 加入 `Deleting`；`Deleted` 行不会由详情或列表返回。任何新 schema 都不得出现测试列出的内部属性。

- [ ] **Step 5: 编写完整真人素材 API 文档**

创建 `docs/api/byteplus-real-person-asset-api.md`，内容如下：

````markdown
# Flatkey 真人素材库 API

Base URL：`https://router.flatkey.ai`

本文档说明如何用 Flatkey API Key 为一个用户创建多个独立真人档案，完成 BytePlus 真人认证，并从公网 HTTPS URL 或本地文件创建可复用素材。调用方不会接触 BytePlus/TOS 凭据、GroupId 或上游 AssetId。

## 鉴权与幂等

用户接口使用 `Authorization: Bearer <FLATKEY_API_KEY>`，并要求 Token 可访问 `seedance-2.0`。以下写接口必须提供非空 `Idempotency-Key`：

- `POST /v1/real-persons`
- `POST /v1/real-persons/{person_id}/verification-sessions`
- `POST /v1/real-persons/{person_id}/assets`

同一用户、同一路由、同一规范请求使用相同 key 会重放同一结果；相同 key 配不同请求返回 `409 idempotency_conflict`。如果上游调用结果不明，返回 `502 idempotency_outcome_unknown`，客户端不得用同一 key 触发第二次上游创建。

## 接口总览

| 方法与路径 | 用途 |
| --- | --- |
| `POST /v1/real-persons` | 创建真人档案和一次性认证链接 |
| `POST /v1/real-persons/{person_id}/verification-sessions` | 为未激活档案重新认证 |
| `GET /v1/real-persons` | 游标列出当前用户的档案 |
| `GET /v1/real-persons/{person_id}` | 查询档案状态 |
| `POST /v1/real-persons/{person_id}/assets` | 用 URL 或本地文件创建真人素材 |
| `GET /v1/real-persons/{person_id}/assets` | 游标列出该档案素材，默认隐藏 Deleted |
| `GET /v1/assets/{asset_id}` | 查询素材状态 |
| `DELETE /v1/assets/{asset_id}` | 幂等删除素材，成功统一 204 |

## 1. 创建并认证真人档案

```bash
curl -sS https://router.flatkey.ai/v1/real-persons \
  -H "Authorization: Bearer $FLATKEY_API_KEY" \
  -H "Idempotency-Key: person-alice-001" \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice"}'
```

成功响应示例：

```json
{
  "id":"rph_1234567890abcdef1234567890abcdef",
  "object":"real_person",
  "name":"Alice",
  "status":"pending_verification",
  "verification_url":"https://example.byteplus.com/one-time-session",
  "verification_expires_at":1785293800,
  "created_at":1785292000
}
```

让真人本人在 30 分钟内打开 `verification_url` 完成认证。该链接只在创建/重新认证的安全重放窗口内返回；普通 GET/list 不返回链接。状态为 `pending_verification`、`verifying`、`active`、`failed` 或 `expired`。只有 `active` 档案可创建或引用真人素材。

重新认证：

```bash
curl -sS -X POST "https://router.flatkey.ai/v1/real-persons/$PERSON_ID/verification-sessions" \
  -H "Authorization: Bearer $FLATKEY_API_KEY" \
  -H "Idempotency-Key: person-alice-reverify-001"
```

## 2. 用公网 HTTPS URL 创建素材

```bash
curl -sS "https://router.flatkey.ai/v1/real-persons/$PERSON_ID/assets" \
  -H "Authorization: Bearer $FLATKEY_API_KEY" \
  -H "Idempotency-Key: alice-image-url-001" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://cdn.example.com/alice/front.png","asset_type":"Image","name":"front"}'
```

URL 必须为上游可访问的公网 HTTPS 地址；localhost、内网地址、带 user info 的 URL 或被 SSRF 策略拒绝的地址不接受。

## 3. 只有本地文件时创建素材

不需要客户先提供 URL。使用 `multipart/form-data`，服务端会把请求流直接写入同区域私有 TOS，不落应用磁盘，也不把完整文件缓冲进内存。

```bash
curl -sS "https://router.flatkey.ai/v1/real-persons/$PERSON_ID/assets" \
  -H "Authorization: Bearer $FLATKEY_API_KEY" \
  -H "Idempotency-Key: alice-video-file-001" \
  -F "file=@./alice-reference.mp4" \
  -F "asset_type=Video" \
  -F "name=reference-video"
```

文件限制：

| 类型 | MIME | 大小 |
| --- | --- | ---: |
| Image | JPEG、PNG、WebP、BMP、TIFF、GIF、HEIC、HEIF | **严格小于 30 MiB** |
| Video | MP4、MOV | **小于等于 50 MiB** |
| Audio | MP3、WAV | **小于等于 15 MiB** |

整个 multipart 请求还有 `50 MiB + 1 MiB envelope allowance` 的硬上限。文件超限返回 `413 asset_file_too_large`；类型或 MIME 不支持返回 `415 asset_media_unsupported`。

## 4. 素材响应、轮询和列表

```json
{
  "id":"ast_1234567890abcdef1234567890abcdef",
  "object":"asset",
  "asset_type":"Video",
  "status":"Processing",
  "name":"reference-video",
  "asset_uri":"asset://ast_1234567890abcdef1234567890abcdef",
  "created_at":1785292000
}
```

用 `GET /v1/assets/{asset_id}` 轮询，直到 `Active` 或 `Failed`。`Failed` 返回稳定 `failure_code`。列表使用 `?limit=20&after=ast_...`，默认 20、最大 100，按创建时间和本地 ID倒序稳定分页；未知游标返回 400，Deleted 不出现在列表。

## 5. 在 Seedance 中引用

一个请求可以引用同一真人档案的多个素材，也可以混合同一 BytePlus 渠道的虚拟素材。一个请求不能引用两个不同真人档案；否则在任何上游提交前返回 `409 asset_profile_conflict`。

```json
{
  "model":"seedance-2.0",
  "content":[
    {"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdef1234567890abcdef"},"role":"reference_image"},
    {"type":"audio_url","audio_url":{"url":"asset://ast_abcdef1234567890abcdef1234567890"},"role":"reference_audio"},
    {"type":"text","text":"Create a natural speaking portrait"}
  ]
}
```

素材容器必须匹配 `asset_type`：Image 放 `image_url`，Video 放 `video_url`，Audio 放 `audio_url`。Processing、Failed、Deleting、Deleted 或未 Active 的档案不能用于新任务。

## 6. 删除

```bash
curl -i -X DELETE "https://router.flatkey.ai/v1/assets/$ASSET_ID" \
  -H "Authorization: Bearer $FLATKEY_API_KEY"
```

第一次 DELETE 先把本地素材置为 `Deleting`，立即禁止新引用；第一次和重复调用都返回空 body 204。物理删除在当前请求或后台协调器中完成。跨用户与不存在素材都按 404 脱敏。

## 7. 稳定错误码

| HTTP | code | 含义 |
| ---: | --- | --- |
| 400 | `invalid_real_person_request` / `invalid_asset_request` | 请求、ID、分页或 JSON 非法 |
| 404 | `real_person_not_found` / `asset_not_found` | 不存在或不属于当前用户 |
| 409 | `real_person_not_active` | 档案尚未认证成功 |
| 409 | `verification_in_progress` | 当前认证仍在有效期内 |
| 409 | `idempotency_conflict` | 相同 key 对应不同请求 |
| 502 | `idempotency_outcome_unknown` | 上游调用结果不明，禁止自动重试 |
| 409 | `asset_profile_conflict` | 一个 Seedance 请求混入两个真人档案 |
| 413 | `asset_file_too_large` | 文件或请求超限 |
| 415 | `asset_media_unsupported` | 类型、MIME 或 content type 不支持 |
| 500 | `real_person_storage_error` / `asset_storage_error` | Flatkey 存储错误 |
| 502 | `verification_upstream_error` / `asset_upstream_error` | BytePlus 返回失败或不可判定响应 |
| 503 | `real_person_channel_unavailable` | 档案绑定渠道不可用；不会漂移到其他渠道 |

## 8. 安全边界

- API 和普通日志不返回或记录 BytedToken、callback token、H5 密文、GroupId、上游 AssetId、ProjectName、TOS URL/对象键或完整渠道密钥。
- callback 是内部唤醒路由，GET/POST 都只返回 204；query/body 的 `resultCode` 不是认证依据。
- 最终认证结果只信任服务端调用 `GetVisualValidateResult` 得到的 GroupId。
- 本地文件的 TOS 签名 URL 只存在于内存，临时对象由 outbox 主动清理，24 小时生命周期只是最后兜底。

发布与回滚证据见 [真人素材发布检查清单](./byteplus-real-person-release-checklist.md)。
````

- [ ] **Step 6: 同步现有素材与视频文档的精确边界**

在 `docs/api/byteplus-asset-api.md` 做以下确定性改动：

1. 把所有 `https://api.example.com` 示例替换为 `https://router.flatkey.ai`。
2. 接口总览新增 `DELETE /v1/assets/{asset_id}`，删除“当前没有素材删除”和“没有幂等键”的全局断言；改为“旧的 `POST /v1/assets` 虚拟素材入口仍只接受 JSON URL 且不要求幂等键，真人写入口要求幂等键”。
3. 在开头加入：

```markdown
> 真人认证、每用户多真人档案、本地文件上传和真人素材列表请使用 [Flatkey 真人素材库 API](./byteplus-real-person-asset-api.md)。现有 `POST /v1/assets` 继续保持虚拟素材兼容契约。
```

4. 把调用方检查清单的“同一个视频请求中的所有素材应来自同一渠道”扩展为：

```markdown
- 同一个视频请求中的所有素材必须来自同一渠道；真人素材还必须至多来自一个真人档案。同真人的多个素材、同渠道虚拟素材与一个真人档案可以混用。
- 真人素材 DELETE 先进入 Deleting 并立即不可引用；重复 DELETE 返回 204。
```

在 `docs/api/flatkey-video-api.md` 的“多模态输入”后加入：

```markdown
### Seedance 真人素材引用

`seedance-2.0` 的 `/v1/videos` `content[]` 可以使用 `asset://ast_...`。同一请求允许同一真人档案的多个 Image/Video/Audio 素材，也允许混合同一 BytePlus 渠道的虚拟素材；如果非空真人档案 ID 集合大于 1，请求在提交上游前返回 `409 asset_profile_conflict`。素材类型必须与 `image_url`、`video_url`、`audio_url` 容器匹配，Deleting/Deleted 素材不可引用。

创建、认证、本地文件上传、轮询与删除见 [Flatkey 真人素材库 API](./byteplus-real-person-asset-api.md)。
```

这两份文档的 Base URL 都必须使用 `https://router.flatkey.ai`；不要改 `docs/openapi/api.json`，不要新增 website 页面。

- [ ] **Step 7: 运行 OpenAPI、JSON 和文档安全检查并确认 GREEN**

Run: `gofmt -w router/byteplus_real_person_openapi_test.go`

Run: `go test ./router -run 'BytePlusRealPersonOpenAPIContract|BytePlusAssetRouter' -count=1`

Run: `powershell -NoProfile -Command "Get-Content docs/openapi/relay.json -Raw | ConvertFrom-Json | Out-Null"`

Run: `rg -n "https://api\.example\.com|Image.*<= ?30|Image.*小于等于 ?30|BytedToken|upstream_group_id|upstream_asset_id|secret_access_key|object_key" docs/api/byteplus-real-person-asset-api.md docs/api/byteplus-asset-api.md docs/api/flatkey-video-api.md docs/openapi/relay.json`

Expected: Go tests PASS；JSON 解析退出码 0；安全扫描只允许文档“不得暴露 BytedToken”这类否定说明，不允许 schema/响应示例出现敏感字段；所有图片限制写成严格 `<30 MiB`，不是 `<=30 MiB`；`git diff -- docs/openapi/api.json` 为空。

- [ ] **Step 8: 提交 relay 契约与调用方文档**

```bash
git add router/byteplus_real_person_openapi_test.go docs/openapi/relay.json docs/api/byteplus-real-person-asset-api.md docs/api/byteplus-asset-api.md docs/api/flatkey-video-api.md
git commit -m "Make certified-person assets usable without customer-hosted files" -m "Constraint: Customers may have only local media while the upstream accepts fetchable URLs" -m "Rejected: Requiring callers to host files | Flatkey can stream into a private same-region TOS bucket without returning a signed URL" -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: Keep the relay contract in relay.json; api.json is the admin API specification" -m "Tested: Relay-only paths, bearer and idempotency headers, JSON and multipart bodies, callback methods, DELETE 204, schema privacy, and documentation examples"
```

### Task 13: 收口发布证据、三库验证、受控集成和安全回滚

**Files:**
- Create: `docs/api/byteplus-real-person-release-checklist.md`

- [ ] **Step 1: 创建可执行的发布检查清单**

创建 `docs/api/byteplus-real-person-release-checklist.md`，完整内容如下：

```markdown
# BytePlus 真人素材库发布检查清单

本清单是 `https://router.flatkey.ai` 真人档案、真人素材、本地文件上传、Seedance 引用和删除能力的发布门禁。任何未通过项都不得用“后续补测”替代。

## 发布身份

- Release commit:
- Staging revision:
- Production router revision:
- Production console revision:
- 验证日期与操作者:

## A. 外部前置条件

- [ ] BytePlus staging 与 production 账号分别拥有 invited-only 真人素材库权限和 Advanced Creation Rights。
- [ ] 每个启用渠道都有同区域私有 TOS bucket、最小权限身份和 24 小时生命周期规则。
- [ ] staging/production 分别配置自己的 HTTPS `BYTEPLUS_REAL_PERSON_CALLBACK_BASE_URL`，不交叉使用。
- [ ] 32-byte 应用加密密钥已通过 Secret Manager 注入所有需要处理认证与协调任务的 Go 节点。
- [ ] 只有经过验证的渠道设置 `real_person_assets.enabled=true`；legacy BytePlus key 不会隐式开启真人能力。
- [ ] 数据库账号具备创建新表、可空列和索引的权限。

官方契约复核链接（发布证据必须记录复核日期，不复制登录态页面内容或凭据）：

- [Private real-human asset library guide](https://docs.byteplus.com/en/docs/ModelArk/2333589)
- [Real-human portrait library guide](https://docs.byteplus.com/en/docs/ModelArk/2333602)
- [CreateVisualValidateSession](https://docs.byteplus.com/en/docs/ModelArk/2333587)
- [GetVisualValidateResult](https://docs.byteplus.com/en/docs/ModelArk/2333588)
- [CreateAsset](https://docs.byteplus.com/en/docs/ModelArk/2318271)
- [DeleteAsset](https://docs.byteplus.com/en/docs/ModelArk/2318278)
- [DeleteAssetGroup](https://docs.byteplus.com/en/docs/ModelArk/2341606)
- [Upload files by using an internal TOS presigned URL](https://docs.byteplus.com/en/docs/ModelArk/2551760)
- [Virtual portrait library guide](https://docs.byteplus.com/en/docs/ModelArk/2333565)

## B. 自动化证据

| Gate | 命令/证据 | 结果 |
| --- | --- | --- |
| 定向 race | `go test -race ...` 输出 | 未执行 |
| 定向 vet | `go vet` 受影响包输出 | 未执行 |
| 全仓 vet | `go vet ./...` 输出或既有基线差异 | 未执行 |
| 全仓 tests | `go test ./...` 输出或既有基线差异 | 未执行 |
| SQLite migration | dialect smoke 输出 | 未执行 |
| MySQL migration | 专用空库 smoke 输出 | 未执行 |
| PostgreSQL migration | 专用空库 smoke 输出 | 未执行 |
| OpenAPI JSON | parse + contract test 输出 | 未执行 |
| Secrets | 变更范围扫描 + schema 隐私测试 | 未执行 |

全仓既有基线可能仍包含根包缺少 `web/classic/dist` 和 Windows SQLite TempDir 文件句柄问题。只有首个失败包、错误文本和基线一致且不在功能影响面时才可记录为既有缺口；任何新增失败都必须修复。

## C. 受控 BytePlus/TOS 集成矩阵

所有测试使用专用测试渠道、专用用户和无生产数据的素材。证据只记录 Flatkey 公共 ID、HTTP 状态和脱敏日志查询，不复制凭据、callback token、BytedToken、签名 URL、GroupId、上游 AssetId 或对象键。

| 场景 | 期望 | 证据 |
| --- | --- | --- |
| 用户 A 创建并认证真人 1 | Active，独立 `rph_` ID | 未执行 |
| 用户 A 创建并认证真人 2 | Active，另一个 `rph_` ID | 未执行 |
| 用户 B 查询/引用用户 A | 404，响应无所有权细节 | 未执行 |
| HTTPS URL Image | 最终 Active | 未执行 |
| 本地 Image | `<30 MiB` 成功，`30 MiB` 拒绝 | 未执行 |
| 本地 Video | `<=50 MiB` 成功，超限拒绝 | 未执行 |
| 本地 Audio | `<=15 MiB` 成功，超限拒绝 | 未执行 |
| MIME/格式错误与多人脸 | 稳定公开错误，不泄露上游原文 | 未执行 |
| 同一真人多个素材 | Seedance 可提交 | 未执行 |
| 同渠道虚拟 + 一个真人 | Seedance 可提交 | 未执行 |
| 两个真人档案 | 上游调用前 `409 asset_profile_conflict` | 未执行 |
| 第一次与重复 DELETE | 都为 204，只发生一次上游删除 | 未执行 |
| 删除后新引用 | 立即拒绝 | 未执行 |
| TOS cleanup 成功 | 终态后对象主动删除 | 未执行 |
| TOS cleanup 故障 | outbox 重试，24h lifecycle 兜底 | 未执行 |
| callback 丢失/重复/乱序 | 轮询收敛，旧 session 不覆盖新 session | 未执行 |
| 日志与 API 安全 | 无敏感字段或完整源 URL | 未执行 |

## D. 部署建议

- Router deploy: **required**。新增 `/v1` 档案、素材、callback、DELETE、Seedance resolver 和共享鉴权/限流路径。
- Other Go deploy targets: **newapi-console required**。生产为共享 Go 二进制与共享数据库；迁移和所有节点协调器需要 console/router 运行同版本。
- Staging: **required first**。只从远程 `staging` 分支触发 `gcp-deploy-staging.yml`，先完成上面的受控矩阵。
- Website deploy: **not required**。`website/**` 没有改动，不触发 `gcp-deploy-website.yml`。
- Terraform/Cloudflare: **not required**。TOS bucket、最小权限与生命周期是独立外部前置，不在现有 GCP Terraform 中创建。
- Production workflow: 获授权操作者把已验证 feature PR 合入 `main` 后，`gcp-deploy.yml` 由 push 自动触发；分别审批 `deploy console` 与 `deploy router`，确保同一镜像都完成。`workflow_dispatch deploy_target=both` 只用于必要的手动重跑，不是主发布路径；自动化代理不得合并或推送 `main`。

## E. 观测门禁

完成 C 矩阵并清除所有故障注入后，记录 UTC/CST 开始时间；等待一次 30 秒 scrape 后，在窗口第 1 分钟内执行 Step 6 的 GET/POST callback probe，再连续观察 staging，直到开始时间后至少 30 分钟。这样在窗口结束查询 `[30m]` 时两次 probe 仍在范围内。自定义指标证据来自 Grafana `Google-Prometheus` 数据源；Cloud Run 5xx 来自 Cloud Monitoring PromQL。counter 跨节点使用 `sum(increase(...[30m]))`，DB 派生 gauge 与 last-success 使用 `max(...)`，不得把 gauge 按实例求和。

| Gate | 查询 | GO 阈值 |
| --- | --- | ---: |
| OutcomeUnknown | `sum(increase(newapi_byteplus_real_person_outcome_unknown_total[30m]))` | `0` |
| 协调器 error | `sum(increase(newapi_byteplus_real_person_reconcile_total{result="error"}[30m]))` | `0` |
| callback 异常 | `sum(increase(newapi_byteplus_real_person_callback_total{status=~"429|other_4xx|5xx"}[30m]))` | `0` |
| GET/POST callback 探针 | `sum(increase(newapi_byteplus_real_person_callback_total{status="2xx"}[30m]))` | `>= 2` |
| 协调器新鲜度 | `time() - max(newapi_byteplus_real_person_reconcile_last_success_unixtime)` | `< 90` 秒 |
| 窗口结束 backlog | `max by (kind) (newapi_byteplus_real_person_backlog{kind=~"deleting|tos_cleanup_due"})` | 两个 kind 都为 `0` |
| 窗口内最老未推进年龄 | `max_over_time((max by (kind) (newapi_byteplus_real_person_backlog_oldest_update_age_seconds{kind=~"deleting|tos_cleanup_due"}))[30m:])` | 两个 kind 都 `< 300` 秒 |
| Staging Cloud Run HTTP 5xx | `sum(increase(run_googleapis_com:request_count{monitored_resource="cloud_run_revision",service_name="newapi-staging",response_code_class="5xx"}[30m]))` | `0` |

- [ ] 每条查询保存开始/结束时间、数据源、可复现 query、返回值和 dashboard/query 链接或脱敏截图。
- [ ] 两个 backlog kind 在窗口结束均为 0，且整个窗口的 oldest age 未达到 300 秒。
- [ ] callback `2xx` 增量至少 2，明确覆盖 Step 6 的 GET 与 POST probe；429、other_4xx、5xx 增量均为 0。
- [ ] 任一查询无数据、阈值不通过或 series 缺失都记为 `NO-GO`，不得按 0 处理或用“已知问题”豁免。

## F. 回滚

首选能力级回滚，不先回滚二进制：

1. 把所有渠道的 `real_person_assets.enabled` 设为 `false`，阻止新档案和新真人素材创建。
2. 保持当前版本的 callback、档案/素材查询、DELETE、状态轮询和 TOS outbox cleanup 正常运行。
3. 保留新增表、列和索引；不删除上游真人组，不清空 tombstone/outbox/幂等账本。
4. 等待认证会话、Deleting 素材和临时对象全部收敛。
5. 只有当前二进制本身导致严重故障且上述收敛已完成时，才通过 `gcp-rollback.yml` 分别回滚 router/console revision；不得恢复已停用的 legacy `newapi` service。

回滚演练证据：

- Capability disabled time:
- New creates blocked:
- Callback/query/delete/cleanup still healthy:
- Pending sessions/assets/objects drained:
- Re-enable decision:

## G. 发布决定

- [ ] 所有自动化 gate 通过，或仅有逐条记录且确认与本变更无关的既有基线失败。
- [ ] 受控集成矩阵全部通过。
- [ ] 回滚能力已演练且不依赖删除 schema。
- [ ] Router 与 console 同版本部署计划已审批，website 明确不部署。

只有以上四项全部勾选，结论才可写为 `GO`；否则结论为 `NO-GO`。
```

- [ ] **Step 2: 运行定向 race、vet 和功能回归**

Run:

```powershell
go test -race ./model ./service ./controller ./router ./middleware ./dto ./types ./pkg/perf_metrics ./relay/channel/task/byteplus -run 'APIIdempotency|BytePlus|RealPerson|AssetReference|Callback|SensitiveRequestPath|Multipart' -count=1
go vet ./model ./service ./controller ./router ./middleware ./dto ./types ./pkg/perf_metrics ./relay/channel/task/byteplus
```

Expected: 全部 PASS，无 race report；多节点单赢家、`CallingUpstream -> OutcomeUnknown`、multipart loser cleanup、session CAS、删除租约、callback、路由、schema 隐私和 Seedance resolver 回归均被命中。把完整命令、退出码和日志制品位置写入清单 B。

- [ ] **Step 3: 运行全仓 vet、build 和 tests，区分新增失败与既有基线**

Run:

```powershell
go vet ./...
go build ./...
go test ./... -count=1
```

Expected: 优先要求全部 PASS。若仍出现设计规格已记录的 `web/classic/dist` embed 或 Windows SQLite TempDir 句柄基线失败，保存首个失败包、完整错误和退出码，并与未改动基线逐字比较；不得把任何受影响包、新迁移、新 race 或新 API 失败归类为基线。任何功能相关失败都返回对应任务修复后重跑本步骤。

- [ ] **Step 4: 在 SQLite、MySQL 和 PostgreSQL 专用空库运行迁移 smoke**

先验证 SQLite；外部方言环境变量为空时测试应明确 SKIP：

```powershell
Remove-Item Env:TEST_MYSQL_DSN -ErrorAction SilentlyContinue
Remove-Item Env:TEST_POSTGRES_DSN -ErrorAction SilentlyContinue
go test ./model -run TestBytePlusRealPersonDialectMigrations -count=1 -v
```

再由受控 CI/操作者预先注入两个只用于本测试的空库 DSN，命令本身不回显 DSN：

```powershell
if ([string]::IsNullOrWhiteSpace($env:TEST_MYSQL_DSN)) { throw 'TEST_MYSQL_DSN must point to a dedicated empty test database' }
if ([string]::IsNullOrWhiteSpace($env:TEST_POSTGRES_DSN)) { throw 'TEST_POSTGRES_DSN must point to a dedicated empty test database' }
go test ./model -run TestBytePlusRealPersonDialectMigrations -count=1 -v
```

Expected: SQLite/MySQL/PostgreSQL 子测试全部 PASS；建表、重复迁移、nullable unique、条件 CAS 与 cleanup 后无残留表均通过。测试若检测到目标表预先存在必须 FAIL，不得改用共享或生产数据库。

- [ ] **Step 5: 解析 OpenAPI、验证 relay-only 边界并扫描变更中的密钥形状**

Run:

```powershell
go test ./router -run TestBytePlusRealPersonOpenAPIContract -count=1
Get-Content docs/openapi/relay.json -Raw | ConvertFrom-Json | Out-Null
git diff --quiet main...HEAD -- docs/openapi/api.json
if ($LASTEXITCODE -eq 0) { 'docs/openapi/api.json unchanged' } else { throw 'docs/openapi/api.json must not change' }
$changed = @(git diff --diff-filter=ACMR --name-only main...HEAD)
if ($changed.Count -eq 0) { throw 'expected feature changes relative to main' }
rg -n --pcre2 '(AKIA|AKLT)[A-Za-z0-9]{16,}|sk-[A-Za-z0-9_-]{24,}|X-Tos-Signature=[A-Fa-f0-9]{16,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----' -- $changed
if ($LASTEXITCODE -eq 1) { 'no credential-shaped values found' } elseif ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } else { throw 'credential-shaped value found in changed files' }
```

Expected: contract test PASS、JSON 解析成功、`api.json` 零 diff、密钥形状扫描零匹配。测试夹具只使用 `sk-example` 等短占位值；不得通过把真实值加入 allowlist 来消除发现。

- [ ] **Step 6: 在 staging 完成两用户、两真人、URL 与三类本地文件受控验证**

受控操作者在 shell 中预先设置但不回显：`FLATKEY_TOKEN_USER_A`、`FLATKEY_TOKEN_USER_B`、`PERSON_A1_ID`、`PERSON_A2_ID`、`REAL_PERSON_HTTPS_URL`、`REAL_PERSON_IMAGE_FILE`、`REAL_PERSON_VIDEO_FILE`、`REAL_PERSON_AUDIO_FILE`。先确认三个本地路径存在，再执行：

```powershell
@($env:REAL_PERSON_IMAGE_FILE, $env:REAL_PERSON_VIDEO_FILE, $env:REAL_PERSON_AUDIO_FILE) | ForEach-Object {
  if (-not (Test-Path -LiteralPath $_ -PathType Leaf)) { throw "missing controlled test file: $_" }
}

curl.exe -sS "https://staging-router.flatkey.ai/v1/real-persons/$env:PERSON_A1_ID/assets" `
  -H "Authorization: Bearer $env:FLATKEY_TOKEN_USER_A" `
  -H "Idempotency-Key: staging-url-video-001" `
  -H "Content-Type: application/json" `
  --data-binary "{`"url`":`"$env:REAL_PERSON_HTTPS_URL`",`"asset_type`":`"Video`",`"name`":`"url-video`"}"

curl.exe -sS "https://staging-router.flatkey.ai/v1/real-persons/$env:PERSON_A1_ID/assets" `
  -H "Authorization: Bearer $env:FLATKEY_TOKEN_USER_A" `
  -H "Idempotency-Key: staging-local-image-001" `
  -F "file=@$env:REAL_PERSON_IMAGE_FILE" -F "asset_type=Image" -F "name=local-image"

curl.exe -sS "https://staging-router.flatkey.ai/v1/real-persons/$env:PERSON_A1_ID/assets" `
  -H "Authorization: Bearer $env:FLATKEY_TOKEN_USER_A" `
  -H "Idempotency-Key: staging-local-video-001" `
  -F "file=@$env:REAL_PERSON_VIDEO_FILE" -F "asset_type=Video" -F "name=local-video"

curl.exe -sS "https://staging-router.flatkey.ai/v1/real-persons/$env:PERSON_A1_ID/assets" `
  -H "Authorization: Bearer $env:FLATKEY_TOKEN_USER_A" `
  -H "Idempotency-Key: staging-local-audio-001" `
  -F "file=@$env:REAL_PERSON_AUDIO_FILE" -F "asset_type=Audio" -F "name=local-audio"
```

随后按清单 C 完成：两个真人认证；用户 B 的 404 隔离；大小/MIME/多人脸失败；同真人多素材；同渠道虚拟+真人；两个 profile 冲突；首次/重复 DELETE；cleanup 故障注入；callback 丢失、重复和乱序。清除全部故障注入，记录清单 E 的观察窗口开始时间，等待一次 30 秒 scrape 后，在第 1 分钟内使用随机不存在 token 验证匿名 callback 的两个 method；不在 shell 历史中使用真实 callback token：

```powershell
$probe = [guid]::NewGuid().ToString('N')
curl.exe -i -sS "https://staging-router.flatkey.ai/v1/real-person-verifications/callback/$probe?resultCode=0"
curl.exe -i -sS -X POST "https://staging-router.flatkey.ai/v1/real-person-verifications/callback/$probe?resultCode=9999" -H "Content-Type: application/json" --data-binary '{"resultCode":"0"}'
```

Expected: callback 两次均空 body 204；URL 和本地文件路径都可用；完整矩阵与日志脱敏检查通过。清除故障注入后按清单 E 连续观察 30 分钟，保存全部八条查询证据并满足固定阈值。每行只把脱敏证据写入清单，不把真实 token、签名 URL 或上游 ID复制进文档。若 BytePlus 权限、TOS、真实素材或任一观测时序缺失，本步骤标记 `NO-GO`，不能用单元测试代替。

- [ ] **Step 7: 写入部署结论并演练只关创建能力的回滚**

依据 `.github/workflows/gcp-deploy.yml` 和 `deploy/gcp/docs/DEPLOYMENT.md` 在清单 D 保持以下结论：Router deploy required、`newapi-console` 同版本 required、Website deploy not required、Terraform/Cloudflare not required。staging 验证后，由用户/获授权操作者把 feature PR 合入 `main`；push 自动触发生产 workflow。先定位该 push 对应的 run，再分别完成 `deploy console` 与 `deploy router` 环境审批：

```powershell
gh run list --workflow gcp-deploy.yml --branch main --event push --limit 5
```

只有自动触发的 run 需要重跑且获授权操作者明确选择手动入口时，才使用 `gh workflow run gcp-deploy.yml --ref main -f deploy_target=both`；它不是主路径。本实现任务不合并/推送 `main`，也不执行生产 workflow；这里只验证 runbook 与两个审批目标。回滚演练必须先在 staging 把渠道 `real_person_assets.enabled` 关闭，确认新 create 被阻断而 callback/query/delete/cleanup 仍健康，再重新开启。revision 回滚命令只记录为严重故障的后备路径：

```powershell
gh workflow run gcp-rollback.yml -f rollback_target=router -f revision=$env:PREVIOUS_ROUTER_REVISION
gh workflow run gcp-rollback.yml -f rollback_target=console -f revision=$env:PREVIOUS_CONSOLE_REVISION
```

Expected: 清单最终明确 `GO` 或 `NO-GO`；能力级回滚保留所有收敛路径；没有 website job、legacy `newapi` service、schema 删除或自动上游真人组删除步骤。

- [ ] **Step 8: 提交发布门禁文档**

```bash
git add docs/api/byteplus-real-person-release-checklist.md
git commit -m "Require evidence before enabling certified-person assets" -m "Constraint: BytePlus permissions, private TOS lifecycle, and three database dialects cannot be inferred from unit tests alone" -m "Rejected: Rolling back the binary before cleanup drains | it would remove callback, delete, and outbox convergence paths" -m "Confidence: high" -m "Scope-risk: narrow" -m "Directive: Disable real_person_assets.enabled first and preserve schema plus convergence workers during rollback" -m "Tested: Targeted race and vet suites, full repository checks, three-dialect migration smoke, OpenAPI parsing, credential-shape scan, controlled two-user integration matrix, and rollback drill"
```
