package model

// The hook point of this package on two spots of upstream: the shipped default
// values in the option map and the seeding that runs once the options table has
// been read. Both live here so model/option.go spends one line on each.

import (
	"maps"

	"github.com/QuantumNous/new-api/common"
)

// HwDefaultOptions holds the empty or shipped value of every option of this
// fork that has one. An option missing from this table has no built-in default
// and stays empty until an operator or a job writes it. It lives next to the
// option keys because two places start from the same table: the option map
// built at startup and the seeding of a fresh database in service/, which reads
// this table too.
var HwDefaultOptions = map[string]string{
	// The TRY and EUR rates are published by the daily price job; until then no
	// rate exists and order creation is refused.
	HwTryPerUsdOption:                "",
	HwEurPerUsdOption:                "",
	HwEurPerUsdDateOption:            "",
	HwEurPresetBaseOption:            "",
	HwMinTopUpTryOption:              "100",
	HwMaxTopUpTryOption:              "20000",
	HwMaxOpenOrdersOption:            "3",
	HwLowBalancePercentOption:        "10",
	HwLowBalanceMinTryOption:         "0",
	HwWindowCapacityUSDOption:        "",
	HwPhase0MeasurementDoneOption:    "false",
	HwCustomerWindowCeilingUSDOption: "",
	HwCheckoutReturnURLOption:        "",
	HwBonusUsdMinOption:              "10",
	HwBonusUsdAmountOption:           "1",
	HwBonusEurMinOption:              "10",
	HwBonusEurAmountOption:           "1",
	HwBonusTryMinOption:              "500",
	HwBonusTryAmountOption:           "50",
	HwUpstreamPromptOverheadOption:   "",
	// The source URLs of the daily price snapshot and the published USD/TRY
	// rate; the keys are literals because their constants live in service/,
	// which imports this package.
	"HwPriceListURL":  "",
	"HwFxURL":         "",
	"HwTryPerUsdDate": "",
}

// hwAddOptionDefaults puts our defaults in the option map a caller is building.
// Upstream reads the same map afterwards, so a key we share keeps its shipped
// value unless the database overrides it.
func hwAddOptionDefaults() {
	maps.Copy(common.OptionMap, HwDefaultOptions)
}

// hwOptionHook runs the startup seeding of our option defaults. It is set once
// during startup and read on every start of the option map, so the server
// rebuilds the defaults whenever it reloads its options from the database.
var hwOptionHook func()

// SetHwOptionHook registers the startup seeding that InitOptionMap runs after it
// has read the options table. Passing nil removes it; the tests use that to keep
// a case from seeding a database it did not ask for.
func SetHwOptionHook(hook func()) {
	hwOptionHook = hook
}

// hwRunOptionHook runs the seeding once the option map reflects the database.
// It stays quiet for a caller that never opened the database.
func hwRunOptionHook(openDatabase bool) {
	if openDatabase && hwOptionHook != nil {
		hwOptionHook()
	}
}
