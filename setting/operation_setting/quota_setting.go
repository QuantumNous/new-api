package operation_setting

import (
	"fmt"
	"math"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

const (
	// DefaultPreConsumeMaxOutputTokens is the conservative output reservation
	// used when the client declares no output limit.
	DefaultPreConsumeMaxOutputTokens = 8192
	// maxPreConsumeOutputTokens bounds the configurable reservation so a single
	// request cannot reserve an absurd amount of output.
	maxPreConsumeOutputTokens = 1 << 20
)

const (
	EnvPreConsumeOutputReserve   = "PRE_CONSUME_OUTPUT_RESERVE"
	EnvPreConsumeMaxOutputTokens = "PRE_CONSUME_MAX_OUTPUT_TOKENS"
)

type QuotaSetting struct {
	EnableFreeModelPreConsume bool    `json:"enable_free_model_pre_consume"` // 是否对免费模型启用预消耗
	TrustQuotaUSD             float64 `json:"trust_quota_usd"`               // 钱包免预扣门槛，0 表示禁用
	PreConsumeMultiplier      float64 `json:"pre_consume_multiplier"`        // 预计输入费用的预扣倍率，仅影响预留
	// PreConsumeOutputReserve 是否在预扣中计入输出侧预留
	PreConsumeOutputReserve bool `json:"pre_consume_output_reserve"`
	// PreConsumeMaxOutputTokens 预留的输出 token 上限：客户端未声明输出上限时的保守预留，也是声明值的封顶
	PreConsumeMaxOutputTokens int `json:"pre_consume_max_output_tokens"`
}

// defaultQuotaSetting holds the declared defaults, before the environment and
// the saved options apply.
var defaultQuotaSetting = QuotaSetting{
	EnableFreeModelPreConsume: true,
	TrustQuotaUSD:             10,
	PreConsumeMultiplier:      1,
	PreConsumeOutputReserve:   true,
	PreConsumeMaxOutputTokens: DefaultPreConsumeMaxOutputTokens,
}

// 默认配置
var quotaSetting = defaultQuotaSetting

func init() {
	applyQuotaSettingEnvDefaults(&quotaSetting)
	// 注册到全局配置管理器
	config.GlobalConfig.Register("quota_setting", &quotaSetting)
}

// applyQuotaSettingEnvDefaults lets a deployment set the reservation knobs
// without the admin console. The database option wins over the environment:
// the env value is only the default that an explicit option overrides, so the
// environment must seed the settings before the options are loaded.
func applyQuotaSettingEnvDefaults(setting *QuotaSetting) {
	setting.PreConsumeOutputReserve = common.GetEnvOrDefaultBool(EnvPreConsumeOutputReserve, setting.PreConsumeOutputReserve)
	limit := common.GetEnvOrDefault(EnvPreConsumeMaxOutputTokens, setting.PreConsumeMaxOutputTokens)
	if limit < 0 || limit > maxPreConsumeOutputTokens {
		common.SysError(common.LogText("invalid %s: %d, using default value: %d", EnvPreConsumeMaxOutputTokens, limit, setting.PreConsumeMaxOutputTokens))
	} else {
		setting.PreConsumeMaxOutputTokens = limit
	}
}

func GetQuotaSetting() *QuotaSetting {
	return &quotaSetting
}

// ValidateQuotaOption validates reservation settings before they are persisted.
func ValidateQuotaOption(key, value string) error {
	switch key {
	case "quota_setting.trust_quota_usd", "quota_setting.pre_consume_multiplier":
		number, err := strconv.ParseFloat(value, 64)
		if err != nil || math.IsNaN(number) || math.IsInf(number, 0) || number < 0 {
			return fmt.Errorf("%s must be a finite non-negative number", key)
		}
		if key == "quota_setting.pre_consume_multiplier" && number == 0 {
			return fmt.Errorf("%s must be greater than zero", key)
		}
	case "quota_setting.pre_consume_output_reserve":
		if _, err := strconv.ParseBool(value); err != nil {
			return fmt.Errorf("%s must be a boolean", key)
		}
	case "quota_setting.pre_consume_max_output_tokens":
		limit, err := strconv.Atoi(value)
		if err != nil || limit < 0 || limit > maxPreConsumeOutputTokens {
			return fmt.Errorf("%s must be an integer between 0 and %d", key, maxPreConsumeOutputTokens)
		}
	}
	return nil
}

// InputPreConsumeMultiplier rejects invalid runtime settings as well as invalid saves.
func InputPreConsumeMultiplier() (float64, error) {
	multiplier := quotaSetting.PreConsumeMultiplier
	if multiplier <= 0 || math.IsNaN(multiplier) || math.IsInf(multiplier, 0) {
		return 0, fmt.Errorf("pre-consume multiplier must be a finite number greater than zero")
	}
	return multiplier, nil
}

// OutputReserveEnabled reports whether the pre-consume estimate counts an
// output-side reservation.
func OutputReserveEnabled() bool {
	return quotaSetting.PreConsumeOutputReserve
}

// OutputReserveTokenLimit returns the number of output tokens a reservation may
// cover. An out-of-range runtime value falls back to the safe default.
func OutputReserveTokenLimit() int {
	limit := quotaSetting.PreConsumeMaxOutputTokens
	if limit < 0 || limit > maxPreConsumeOutputTokens {
		return DefaultPreConsumeMaxOutputTokens
	}
	return limit
}
