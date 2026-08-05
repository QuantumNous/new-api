package billing_setting

import (
	"fmt"

	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/types"
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
// 两个字段用 types.RWMap 而非裸 map：配置热更新每个同步周期都会重写它们，而计费热路径同时
// 在读。RWMap 让 updateConfigFromMap 的指针分支把写入路由到 RWMap.UnmarshalJSON（持写锁），
// 读取则走 Get（持读锁），二者共享同一把锁。裸 map 在此处会被 Go 运行时判定为并发读写并终止进程。
type BillingSetting struct {
	BillingMode *types.RWMap[string, string] `json:"billing_mode"`
	BillingExpr *types.RWMap[string, string] `json:"billing_expr"`
}

var billingSetting = BillingSetting{
	BillingMode: types.NewRWMap[string, string](),
	BillingExpr: types.NewRWMap[string, string](),
}

func init() {
	config.GlobalConfig.Register("billing_setting", &billingSetting)
}

// emptyBillingMap 是所有 nil 字段共用的只读兜底，永远不会被写入。
var emptyBillingMap = types.NewRWMap[string, string]()

// usableBillingMap 兜住 nil 字段。
//
// 配置项的值若为字面量 "null"，updateConfigFromMap 的指针分支会把字段整个置为 nil
// （setting/config/config.go 的 reflect.Ptr 分支），而 RWMap 的方法会解引用接收者。
// 计费热路径每个请求都要读这两个映射，不能因为一个异常的配置值就 panic。
//
// 这里只读不写：若在读取路径上就地重建映射，读接口就又变成了共享状态的写者。
// 字段本身的复原交给 AfterConfigUpdate。
func usableBillingMap(m *types.RWMap[string, string]) *types.RWMap[string, string] {
	if m == nil {
		return emptyBillingMap
	}
	return m
}

// AfterConfigUpdate 实现 config.PostUpdater，把被 "null" 清空的字段复原成空映射，
// 避免 nil 经 configToMap 再次序列化成 "null" 而长期固化。
func (s *BillingSetting) AfterConfigUpdate() {
	if s.BillingMode == nil {
		s.BillingMode = types.NewRWMap[string, string]()
	}
	if s.BillingExpr == nil {
		s.BillingExpr = types.NewRWMap[string, string]()
	}
}

// ---------------------------------------------------------------------------
// Read accessors (hot path, must be fast)
// ---------------------------------------------------------------------------

func GetBillingMode(model string) string {
	if mode, ok := usableBillingMap(billingSetting.BillingMode).Get(model); ok {
		return mode
	}
	return BillingModeRatio
}

func GetBillingExpr(model string) (string, bool) {
	return usableBillingMap(billingSetting.BillingExpr).Get(model)
}

func GetBillingModeCopy() map[string]string {
	return usableBillingMap(billingSetting.BillingMode).ReadAll()
}

func GetBillingExprCopy() map[string]string {
	return usableBillingMap(billingSetting.BillingExpr).ReadAll()
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
