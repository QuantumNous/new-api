package groksubscription

import (
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"

	"github.com/gin-gonic/gin"
)

var _ interface {
	SecondBillingRatios() (map[string]float64, error)
} = (*TaskAdaptor)(nil)

var _ interface {
	AdjustPerCallBillingOnComplete(*model.Task, *relaycommon.TaskInfo) int
} = (*TaskAdaptor)(nil)

func (a *TaskAdaptor) SecondBillingRatios() (map[string]float64, error) {
	return a.secondBilling.Ratios()
}

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	a.secondBilling.Reset()
	if info == nil {
		return nil
	}
	req, err := getVideoRequest(c)
	if err != nil || req == nil {
		return nil
	}
	rules := billing_setting.GetGrokSubscriptionVideoPriceRules(billing_setting.GetVideoPriceRules())
	configured := billing_setting.IsVideoModelConfigured(rules, info.OriginModelName)
	dims, dimsOK := resolveBillingDimensions(req)
	seconds, secondsOK := resolveBillingSeconds(req)
	switch {
	case !dimsOK && configured:
		a.secondBilling.Err = taskcommon.UnpriceableDimensionError(info.OriginModelName, "resolution", stringValue(req.Resolution))
	case !secondsOK && configured:
		a.secondBilling.Err = taskcommon.UnpriceableDurationError(info.OriginModelName, "request duration is not billable")
	case dimsOK && secondsOK:
		a.secondBilling.Model = info.OriginModelName
		a.secondBilling.Dims = dims
		a.secondBilling.Seconds = seconds
		a.secondBilling.ModelPrice = info.PriceData.ModelPrice
		a.secondBilling.Rules = rules
	}
	return nil
}

func resolveBillingDimensions(req *VideoRequest) (map[string]string, bool) {
	if req == nil {
		return nil, false
	}
	dims := map[string]string{"action": req.Action}
	switch req.Action {
	case actionGenerate:
		resolution := stringValue(req.Resolution)
		if resolution == "" {
			resolution = taskcommon.Resolution480p
		}
		label, ok := taskcommon.NormalizeResolution(resolution)
		if !ok {
			return nil, false
		}
		dims["resolution"] = label
		dims["has_video"] = "false"
		return dims, true
	case actionEdit, actionExtend:
		dims["has_video"] = "true"
		return dims, true
	default:
		return nil, false
	}
}

func resolveBillingSeconds(req *VideoRequest) (float64, bool) {
	if req == nil {
		return 0, false
	}
	switch req.Action {
	case actionGenerate, actionExtend:
		if req.Duration == nil || *req.Duration <= 0 {
			return 0, false
		}
		return float64(*req.Duration), true
	case actionEdit:
		return 1, true
	default:
		return 0, false
	}
}

func (a *TaskAdaptor) AdjustBillingOnComplete(_ *model.Task, _ *relaycommon.TaskInfo) int {
	return 0
}

func (a *TaskAdaptor) AdjustPerCallBillingOnComplete(_ *model.Task, _ *relaycommon.TaskInfo) int {
	return 0
}
