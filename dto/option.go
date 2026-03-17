package dto

// OptionUpdateRequest is the request body for PUT /api/option/.
type OptionUpdateRequest struct {
	Key   string `json:"key"`
	Value any    `json:"value"`
}
