package dto

// DeletedCountData is the response data for the delete-orphaned-models endpoint.
type DeletedCountData struct {
	Deleted int64 `json:"deleted"`
}
