package apimartvideo

import (
	"context"
	"math"
	"strings"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

func motionBillableSeconds(c *gin.Context, videoURL, orientation string, clientEstimate int) int {
	minSec, maxSec := 3, 10
	if strings.EqualFold(strings.TrimSpace(orientation), "video") {
		maxSec = 30
	}

	seconds := 0
	if ctx := c.Request.Context(); strings.TrimSpace(videoURL) != "" {
		if probed, err := service.ProbeRemoteVideoDurationSecondsRound(ctx, videoURL); err == nil && probed > 0 {
			seconds = probed
		}
	}
	if seconds <= 0 && clientEstimate > 0 {
		seconds = clientEstimate
	}
	if seconds <= 0 {
		seconds = defaultBillableSeconds(orientation)
	}
	if seconds < minSec {
		seconds = minSec
	}
	if seconds > maxSec {
		seconds = maxSec
	}
	return seconds
}

func extractBillableSecondsFromApimart(body []byte) int {
	return extractBillableSecondsFromApimartWithMode(body, "std")
}

func extractBillableSecondsFromApimartWithMode(body []byte, mode string) int {
	if len(body) == 0 {
		return 0
	}
	for _, path := range []string{
		"data.duration",
		"data.billable_seconds",
		"data.billable_duration",
		"data.actual_duration",
		"data.output_duration",
		"data.result.duration",
		"data.result.billable_seconds",
	} {
		if v := gjson.GetBytes(body, path).Float(); v > 0 {
			return int(math.Ceil(v))
		}
	}
	if cost := gjson.GetBytes(body, "data.cost").Float(); cost > 0 {
		rate := StdUSDPerSecond
		if strings.EqualFold(strings.TrimSpace(mode), "pro") {
			rate = ProUSDPerSecond
		}
		return int(math.Round(cost / rate))
	}
	return 0
}

func motionControlModelName(task *model.Task) string {
	if task == nil {
		return ""
	}
	if bc := task.PrivateData.BillingContext; bc != nil && strings.TrimSpace(bc.OriginModelName) != "" {
		return bc.OriginModelName
	}
	return task.Properties.OriginModelName
}

func recalcMotionControlQuota(task *model.Task, seconds int) int {
	bc := task.PrivateData.BillingContext
	if bc == nil || seconds <= 0 || task.Quota <= 0 {
		return 0
	}

	preSeconds := 0
	if bc.OtherRatios != nil {
		if s, ok := bc.OtherRatios["seconds"]; ok && s > 0 {
			preSeconds = int(math.Round(s))
		}
	}
	if preSeconds == seconds {
		return 0
	}

	base := float64(task.Quota)
	if bc.OtherRatios != nil {
		for _, r := range bc.OtherRatios {
			if r != 1.0 && r > 0 {
				base /= r
			}
		}
	}

	result := base
	if bc.OtherRatios != nil {
		for k, r := range bc.OtherRatios {
			switch k {
			case "seconds":
				result *= float64(seconds)
			default:
				if r != 1.0 && r > 0 {
					result *= r
				}
			}
		}
	}
	return int(math.Round(result))
}

func (a *TaskAdaptor) AdjustBillingOnComplete(task *model.Task, taskResult *relaycommon.TaskInfo) int {
	if task == nil || taskResult == nil || !IsMotionControlModel(motionControlModelName(task)) {
		return 0
	}

	actualSeconds := taskResult.BillableSeconds
	if actualSeconds <= 0 {
		actualSeconds = extractBillableSecondsFromApimartWithMode(task.Data, motionModeFromTask(task))
	}
	if actualSeconds <= 0 && strings.TrimSpace(taskResult.Url) != "" {
		if probeURL := motionOutputVideoURL(task, taskResult.Url); probeURL != "" {
			if secs, err := service.ProbeRemoteVideoDurationSeconds(context.Background(), probeURL); err == nil && secs > 0 {
				actualSeconds = secs
			}
		}
	}
	if actualSeconds <= 0 {
		if videoURL := motionVideoURLFromTask(task); videoURL != "" {
			if secs, err := service.ProbeRemoteVideoDurationSeconds(context.Background(), videoURL); err == nil && secs > 0 {
				actualSeconds = secs
			}
		}
	}
	if actualSeconds <= 0 {
		return 0
	}
	return recalcMotionControlQuota(task, actualSeconds)
}

func motionVideoURLFromTask(task *model.Task) string {
	if task == nil {
		return ""
	}
	if strings.TrimSpace(task.PrivateData.RequestData) != "" {
		if v := gjson.Get(task.PrivateData.RequestData, "video_url").String(); strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return strings.TrimSpace(gjson.GetBytes(task.Data, "video_url").String())
}

func motionModeFromTask(task *model.Task) string {
	if task == nil {
		return "std"
	}
	if strings.TrimSpace(task.PrivateData.RequestData) != "" {
		if m := gjson.Get(task.PrivateData.RequestData, "mode").String(); strings.TrimSpace(m) != "" {
			return strings.TrimSpace(m)
		}
	}
	if bc := task.PrivateData.BillingContext; bc != nil && bc.OtherRatios != nil {
		if r, ok := bc.OtherRatios["mode"]; ok && r > 1.01 {
			return "pro"
		}
	}
	return "std"
}

func motionOutputVideoURL(task *model.Task, parsedURL string) string {
	if u := strings.TrimSpace(parsedURL); u != "" && !strings.Contains(u, "/v1/videos/") {
		return u
	}
	if task != nil && strings.TrimSpace(task.PrivateData.UpstreamVideoURL) != "" {
		return strings.TrimSpace(task.PrivateData.UpstreamVideoURL)
	}
	return strings.TrimSpace(parsedURL)
}
