package replicate

import "encoding/json"

type PredictionResponse struct {
	ID     string          `json:"id"`
	Status string          `json:"status"`
	Output any             `json:"output"`
	Error  json.RawMessage `json:"error"`
}

type PredictionError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Detail  string `json:"detail"`
}

type FileUploadResponse struct {
	Urls struct {
		Get string `json:"get"`
	} `json:"urls"`
}
