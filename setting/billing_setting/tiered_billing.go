package billing_setting

import (
	"fmt"
	"maps"
	"sync/atomic"

	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/samber/lo"
)

const (
	BillingModeRatio      = "ratio"
	BillingModeTieredExpr = "tiered_expr"
	BillingModeField      = "billing_mode"
	BillingExprField      = "billing_expr"
)

// BillingSetting is managed by config.GlobalConfig.Register.
// DB keys: billing_setting.billing_mode, billing_setting.billing_expr
//
// billingSetting 是热更新的写入目标，配置同步会用反射原地改写它，随时可能处于中间状态。
// 读路径一律不得读取该变量，必须走 billingSnapshot，见下方说明。
type BillingSetting struct {
	BillingMode map[string]string `json:"billing_mode"`
	BillingExpr map[string]string `json:"billing_expr"`
}

var billingSetting = BillingSetting{
	BillingMode: make(map[string]string),
	BillingExpr: make(map[string]string),
}

// billingSnapshot 持有一份对读者不可变的副本。
//
// 计费热路径每个请求都要查这两个映射，而配置同步每 60 秒重写它们一次。以整体替换的方式
// 发布快照，读者要么看到旧的一份、要么看到新的一份，不存在中间态；同时读路径不需要加锁，
// 是所有可选方案里最快的。
//
// 这里刻意不使用 types.RWMap：RWMap 只保护映射内容，不保护 *RWMap 指针字段本身的替换，
// 而 updateConfigFromMap 在遇到字面量 "null" 时正会替换该指针（config.go 的 reflect.Ptr
// 分支），于是指针的读写之间仍存在竞争。保持裸 map 加快照既避开了这一点，也让数据库中已有的
// 序列化形式完全不变。
var billingSnapshot atomic.Pointer[BillingSetting]

func init() {
	config.GlobalConfig.Register("billing_setting", &billingSetting)
	publishBillingSnapshot()
}

// AfterConfigUpdate 实现 config.PostUpdater，在热更新写完字段后重新发布快照。
func (s *BillingSetting) AfterConfigUpdate() {
	// 配置值为字面量 "null" 时映射会被置为 nil。读 nil 映射本身是安全的，这里复原成空映射，
	// 只是为了避免 nil 经 configToMap 再次序列化成 "null" 而长期固化。
	if s.BillingMode == nil {
		s.BillingMode = make(map[string]string)
	}
	if s.BillingExpr == nil {
		s.BillingExpr = make(map[string]string)
	}
	publishBillingSnapshot()
}

func publishBillingSnapshot() {
	billingSnapshot.Store(&BillingSetting{
		BillingMode: maps.Clone(billingSetting.BillingMode),
		BillingExpr: maps.Clone(billingSetting.BillingExpr),
	})
}

// ---------------------------------------------------------------------------
// Read accessors (hot path, must be fast)
// ---------------------------------------------------------------------------

func GetBillingMode(model string) string {
	if mode, ok := billingSnapshot.Load().BillingMode[model]; ok {
		return mode
	}
	return BillingModeRatio
}

func GetBillingExpr(model string) (string, bool) {
	expr, ok := billingSnapshot.Load().BillingExpr[model]
	return expr, ok
}

func GetBillingModeCopy() map[string]string {
	return lo.Assign(billingSnapshot.Load().BillingMode)
}

func GetBillingExprCopy() map[string]string {
	return lo.Assign(billingSnapshot.Load().BillingExpr)
}

func GetPricingSyncData(base map[string]any) map[string]any {
	extra := make(map[string]any, 2)
	if modes := GetBillingModeCopy(); len(modes) > 0 {
		extra[BillingModeField] = modes
	}
	if exprs := GetBillingExprCopy(); len(exprs) > 0 {
		extra[BillingExprField] = exprs
	}
	return lo.Assign(base, extra)
}

// ---------------------------------------------------------------------------
// Smoke test (called externally for validation before save)
// ---------------------------------------------------------------------------

func SmokeTestExpr(exprStr string) error {
	return smokeTestExpr(exprStr)
}

func smokeTestExpr(exprStr string) error {
	vectors := []billingexpr.TokenParams{
		{P: 0, C: 0, Len: 0},
		{P: 1000, C: 1000, Len: 1000},
		{P: 100000, C: 100000, Len: 100000},
		{P: 1000000, C: 1000000, Len: 1000000},
	}
	requests := []billingexpr.RequestInput{
		{},
		{
			Headers: map[string]string{
				"anthropic-beta": "fast-mode-2026-02-01",
			},
			Body: []byte(`{"service_tier":"fast","stream_options":{"include_usage":true},"messages":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21]}`),
		},
	}

	for _, v := range vectors {
		for _, request := range requests {
			result, _, err := billingexpr.RunExprWithRequest(exprStr, v, request)
			if err != nil {
				return fmt.Errorf("vector {p=%g, c=%g}: run failed: %w", v.P, v.C, err)
			}
			if result < 0 {
				return fmt.Errorf("vector {p=%g, c=%g}: result %f < 0", v.P, v.C, result)
			}
		}
	}
	return nil
}
