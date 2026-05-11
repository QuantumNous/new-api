package mineru

// MinerUFileParseResult represents the actual response from MinerU's /file_parse endpoint
type MinerUFileParseResult struct {
	TaskID      string                         `json:"task_id"`
	Status      string                         `json:"status"`
	Backend     string                         `json:"backend"`
	FileNames   []string                       `json:"file_names"`
	CreatedAt   string                         `json:"created_at"`
	StartedAt   string                         `json:"started_at"`
	CompletedAt string                         `json:"completed_at"`
	Error       string                         `json:"error"`
	StatusURL   string                         `json:"status_url"`
	ResultURL   string                         `json:"result_url"`
	Version     string                         `json:"version"`
	Results     map[string]MinerUFileResult    `json:"results"`
}

type MinerUFileResult struct {
	MdContent string   `json:"md_content,omitempty"`
	// Other fields may vary based on request parameters
}
