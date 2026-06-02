package apimart

// Submit: POST {base}/v1/images/generations
type SubmitRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
	N      int    `json:"n,omitempty"`
	Size   string `json:"size,omitempty"`
}

type SubmitResponse struct {
	Code int `json:"code"`
	Data []struct {
		Status string `json:"status"`
		TaskID string `json:"task_id"`
	} `json:"data"`
	Message string `json:"message,omitempty"`
}

// Poll: GET {base}/v1/tasks/{task_id}
type TaskResponse struct {
	Code int `json:"code"`
	Data struct {
		Status   string `json:"status"` // pending | completed | failed
		Progress int    `json:"progress"`
		Result   struct {
			Images []struct {
				URL []string `json:"url"`
			} `json:"images"`
		} `json:"result"`
		Error string `json:"error,omitempty"`
	} `json:"data"`
	Message string `json:"message,omitempty"`
}
