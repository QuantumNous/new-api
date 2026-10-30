package setting

import (
	"strconv"
	"sync/atomic"

	"github.com/QuantumNous/new-api/common"
)

const DefaultUserMaxConcurrencyOptionKey = "DefaultUserMaxConcurrency"

var defaultUserMaxConcurrency atomic.Int64

// GetDefaultUserMaxConcurrency returns the limit applied when a new user is created.
func GetDefaultUserMaxConcurrency() int {
	return int(defaultUserMaxConcurrency.Load())
}

func ValidateDefaultUserMaxConcurrency(value string) error {
	limit, err := strconv.ParseInt(value, 10, 32)
	if err != nil || limit < 0 {
		return common.NewMessage("Default maximum concurrency must be an integer between 0 and 2147483647")
	}
	return nil
}

func UpdateDefaultUserMaxConcurrency(value string) error {
	if err := ValidateDefaultUserMaxConcurrency(value); err != nil {
		return err
	}
	limit, _ := strconv.ParseInt(value, 10, 32)
	defaultUserMaxConcurrency.Store(limit)
	return nil
}
