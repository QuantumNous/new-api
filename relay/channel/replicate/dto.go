package replicate

type PredictionResponse struct {
	ID     string           `json:"id"`
	Status string           `json:"status"`
	Output any              `json:"output"`
	Error  *PredictionError `json:"error"`
	Urls   struct {
		Get string `json:"get"`
	} `json:"urls"`
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
