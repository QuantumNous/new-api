package operation_setting

import (
	"slices"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

const (
	ModelSquareSortManual = "manual"
	ModelSquareSortUsage  = "usage"
	ModelSquareSortMixed  = "mixed"

	ModelSquareMetricRequests = "requests"
	ModelSquareMetricTokens   = "tokens"
)

// ModelSquareSetting holds the Recommended order of the model square.
type ModelSquareSetting struct {
	SortMode   string   `json:"sort_mode"`   // manual, usage or mixed
	SortMetric string   `json:"sort_metric"` // usage metric: requests or tokens
	SortDays   int      `json:"sort_days"`   // usage period in days: 1, 7 or 30
	SortModels []string `json:"sort_models"` // manual order, or the pinned models in mixed mode
}

// An empty manual list keeps the model square in name order.
var modelSquareSetting = ModelSquareSetting{
	SortMode:   ModelSquareSortManual,
	SortMetric: ModelSquareMetricTokens,
	SortDays:   7,
	SortModels: []string{},
}

func init() {
	config.GlobalConfig.Register("model_square_setting", &modelSquareSetting)
}

func GetModelSquareSetting() *ModelSquareSetting {
	return &modelSquareSetting
}

// ValidateModelSquareOption rejects model square order values the square cannot use.
func ValidateModelSquareOption(key, value string) error {
	setting, ok := strings.CutPrefix(key, "model_square_setting.")
	if !ok {
		return nil
	}
	valid := false
	switch setting {
	case "sort_mode":
		valid = slices.Contains([]string{ModelSquareSortManual, ModelSquareSortUsage, ModelSquareSortMixed}, value)
	case "sort_metric":
		valid = value == ModelSquareMetricRequests || value == ModelSquareMetricTokens
	case "sort_days":
		valid = slices.Contains([]string{"1", "7", "30"}, value)
	case "sort_models":
		var names []string
		valid = common.UnmarshalJsonStr(value, &names) == nil
	}
	if !valid {
		return common.NewMessage("Invalid model square order setting")
	}
	return nil
}
