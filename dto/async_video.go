package dto

type AsyncVideoTaskError struct {
	Message string `json:"message"`
	Code    string `json:"code,omitempty"`
}

type AsyncVideoTaskResponse struct {
	ID          string               `json:"id"`
	TaskID      string               `json:"task_id,omitempty"`
	Object      string               `json:"object"`
	Model       string               `json:"model,omitempty"`
	Status      string               `json:"status"`
	URL         string               `json:"url,omitempty"`
	Progress    int                  `json:"progress"`
	CreatedAt   int64                `json:"created_at"`
	CompletedAt int64                `json:"completed_at,omitempty"`
	Seconds     string               `json:"seconds,omitempty"`
	Size        string               `json:"size,omitempty"`
	Error       *AsyncVideoTaskError `json:"error,omitempty"`
}
