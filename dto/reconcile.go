package dto

// ListReconcileHourlyRequest is query params for the paginated viewer.
// Empty ChannelIds means "all channels".
type ListReconcileHourlyRequest struct {
	ChannelIds []int  `form:"channel_ids"`
	From       int64  `form:"from" binding:"required"`
	To         int64  `form:"to" binding:"required"`
	ModelName  string `form:"model_name"`
	Page       int    `form:"page"`
	PageSize   int    `form:"page_size"`
}

// ExportReconcileRequest is query params for the monthly export endpoint.
// Empty ChannelIds means export all reconcile-enabled channels for the month.
type ExportReconcileRequest struct {
	ChannelIds []int  `form:"channel_ids"`
	Month      string `form:"month" binding:"required"`
	Format     string `form:"format"`
	ModelName  string `form:"model_name"`
}
