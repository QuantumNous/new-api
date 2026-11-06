package dto

type TaskPluginError struct {
	Code       string `json:"code"`
	Message    string `json:"message"`
	HTTPStatus int    `json:"httpStatus"`
	Retryable  bool   `json:"retryable"`
}

// TaskView is the only persisted-task shape exposed to JavaScript plugins.
// It deliberately excludes ownership, channel, quota, properties, and private
// upstream identifiers. Fields are sorted by JSON name so the encoded view
// orders its keys as an encoded map does; hooks receive it parsed from that
// text.
type TaskView struct {
	CreatedAt  int64  `json:"created_at"`
	Data       any    `json:"data,omitempty"`
	FailReason string `json:"fail_reason"`
	FinishedAt int64  `json:"finished_at,omitempty"`
	Platform   string `json:"platform"`
	Progress   string `json:"progress"`
	Status     string `json:"status"`
	TaskID     string `json:"task_id"`
	UpdatedAt  int64  `json:"updated_at,omitempty"`
}
