package dto

import "github.com/go-fuego/fuego"

// Response is the generic typed API response wrapper.
// All API endpoints return this shape: {"success": true, "message": "", "data": <T>}
type Response[T any] struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    T      `json:"data"`
}

// PageData is the typed pagination wrapper for list endpoints.
type PageData[T any] struct {
	Page     int `json:"page"`
	PageSize int `json:"page_size"`
	Total    int `json:"total"`
	Items    []T `json:"items"`
}

// MessageResponse is a response with no data field, just success + message.
type MessageResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// PageParams declares standard pagination query parameters (p, page_size).
func PageParams() func(*fuego.BaseRoute) {
	return fuego.GroupOptions(
		fuego.OptionQueryInt("p", "Page number (1-based)"),
		fuego.OptionQueryInt("page_size", "Items per page"),
	)
}
