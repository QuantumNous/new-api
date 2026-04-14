package dto

type AsyncImageTaskError struct {
	Message string `json:"message"`
	Code    string `json:"code,omitempty"`
}

type AsyncImageTaskResponse struct {
	ID          string               `json:"id"`
	TaskID      string               `json:"task_id,omitempty"`
	Object      string               `json:"object"`
	Model       string               `json:"model,omitempty"`
	Status      string               `json:"status"`
	Progress    int                  `json:"progress"`
	CreatedAt   int64                `json:"created_at"`
	CompletedAt int64                `json:"completed_at,omitempty"`
	ResultURL   string               `json:"result_url,omitempty"`
	Data        []ImageData          `json:"data,omitempty"`
	Error       *AsyncImageTaskError `json:"error,omitempty"`
}
