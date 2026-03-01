package dto

type CodexUsageData struct {
	Success        bool   `json:"success"`
	Message        string `json:"message"`
	UpstreamStatus int    `json:"upstream_status"`
	Data           any    `json:"data"`
}
