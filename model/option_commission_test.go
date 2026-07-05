package model

import (
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestCommissionOptionDispatch(t *testing.T) {
	// 初始化 OptionMap
	common.OptionMapRWMutex.Lock()
	common.OptionMap = make(map[string]string)
	common.OptionMapRWMutex.Unlock()

	// 保存原始值
	origEnabled := common.CommissionEnabled
	origSettle := common.CommissionRealTimeSettle
	origAntiSpam := common.AntiSpamEnabled
	origMaxInvites := common.MaxDailyInvites
	origSameIP := common.CommissionSameIPLimit
	defer func() {
		// 恢复原始值
		common.CommissionEnabled = origEnabled
		common.CommissionRealTimeSettle = origSettle
		common.AntiSpamEnabled = origAntiSpam
		common.MaxDailyInvites = origMaxInvites
		common.CommissionSameIPLimit = origSameIP
	}()

	tests := []struct {
		key      string
		value    string
		checkFn  func() bool
		expected bool
	}{
		{
			key:   "CommissionEnabled",
			value: "true",
			checkFn: func() bool {
				return common.CommissionEnabled == true
			},
			expected: true,
		},
		{
			key:   "CommissionEnabled",
			value: "false",
			checkFn: func() bool {
				return common.CommissionEnabled == false
			},
			expected: true,
		},
		{
			key:   "CommissionRealTimeSettleEnabled",
			value: "true",
			checkFn: func() bool {
				return common.CommissionRealTimeSettle == true
			},
			expected: true,
		},
		{
			key:   "CommissionRealTimeSettleEnabled",
			value: "false",
			checkFn: func() bool {
				return common.CommissionRealTimeSettle == false
			},
			expected: true,
		},
		{
			key:   "CommissionAntiSpamEnabled",
			value: "true",
			checkFn: func() bool {
				return common.AntiSpamEnabled == true
			},
			expected: true,
		},
		{
			key:   "CommissionAntiSpamEnabled",
			value: "false",
			checkFn: func() bool {
				return common.AntiSpamEnabled == false
			},
			expected: true,
		},
		{
			key:   "CommissionMaxDailyInvites",
			value: "100",
			checkFn: func() bool {
				return common.MaxDailyInvites == 100
			},
			expected: true,
		},
		{
			key:   "CommissionMaxDailyInvites",
			value: "0",
			checkFn: func() bool {
				return common.MaxDailyInvites == 0
			},
			expected: true,
		},
		{
			key:   "CommissionSameIPLimit",
			value: "10",
			checkFn: func() bool {
				return common.CommissionSameIPLimit == 10
			},
			expected: true,
		},
		{
			key:   "CommissionSameIPLimit",
			value: "0",
			checkFn: func() bool {
				return common.CommissionSameIPLimit == 0
			},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.key+"="+tt.value, func(t *testing.T) {
			err := updateOptionMap(tt.key, tt.value)
			if err != nil {
				t.Fatalf("updateOptionMap(%q, %q) failed: %v", tt.key, tt.value, err)
			}

			if got := tt.checkFn(); got != tt.expected {
				t.Errorf("After updateOptionMap(%q, %q): checkFn() = %v, want %v",
					tt.key, tt.value, got, tt.expected)
			}
		})
	}
}

func TestCommissionOptionRegistration(t *testing.T) {
	// 测试 InitOptionMap 是否注册了所有返佣配置
	expectedKeys := []string{
		"CommissionEnabled",
		"CommissionRealTimeSettleEnabled",
		"CommissionAntiSpamEnabled",
		"CommissionMaxDailyInvites",
		"CommissionSameIPLimit",
	}

	// 初始化 OptionMap
	InitOptionMap()

	for _, key := range expectedKeys {
		if _, exists := common.OptionMap[key]; !exists {
			t.Errorf("OptionMap missing key: %q", key)
		} else {
			t.Logf("✅ Key registered: %s = %s", key, common.OptionMap[key])
		}
	}
}

func TestCommissionOptionValues(t *testing.T) {
	// 验证默认值是否正确注册
	expectedDefaults := map[string]string{
		"CommissionEnabled":              strconv.FormatBool(common.CommissionEnabled),
		"CommissionRealTimeSettleEnabled": strconv.FormatBool(common.CommissionRealTimeSettle),
		"CommissionAntiSpamEnabled":       strconv.FormatBool(common.AntiSpamEnabled),
		"CommissionMaxDailyInvites":       strconv.Itoa(common.MaxDailyInvites),
		"CommissionSameIPLimit":           strconv.Itoa(common.CommissionSameIPLimit),
	}

	// 初始化 OptionMap
	InitOptionMap()

	for key, expected := range expectedDefaults {
		actual, exists := common.OptionMap[key]
		if !exists {
			t.Errorf("OptionMap missing key: %q", key)
			continue
		}
		if actual != expected {
			t.Errorf("OptionMap[%q] = %q, want %q", key, actual, expected)
		} else {
			t.Logf("✅ Default value correct: %s = %s", key, actual)
		}
	}
}
