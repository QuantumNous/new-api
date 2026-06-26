package service

import (
	"strconv"
	"strings"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

// BuildVideoRequestDataForLog returns user-facing request fields for usage log preview.
func BuildVideoRequestDataForLog(req *relaycommon.TaskSubmitReq) map[string]interface{} {
	if req == nil {
		return nil
	}

	data := map[string]interface{}{}
	if model := strings.TrimSpace(req.Model); model != "" {
		data["model"] = model
	}
	if prompt := strings.TrimSpace(req.Prompt); prompt != "" {
		data["prompt"] = prompt
	}

	seconds := strings.TrimSpace(req.Seconds)
	if seconds == "" && req.Duration > 0 {
		seconds = strconv.Itoa(req.Duration)
	}
	if seconds != "" {
		data["seconds"] = seconds
	}
	if req.Duration > 0 {
		data["duration"] = req.Duration
	}
	if size := strings.TrimSpace(req.Size); size != "" {
		data["size"] = size
	}
	if len(req.Images) > 0 {
		data["image_urls"] = req.Images
	} else if image := strings.TrimSpace(req.Image); image != "" {
		data["image_urls"] = []string{image}
	}

	if len(data) == 0 {
		return nil
	}
	return data
}
