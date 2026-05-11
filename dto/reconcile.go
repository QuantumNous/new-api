package dto

// ListReconcileHourlyRequest is query params for the paginated viewer.
// channel_id == 0 means "all channels".
type ListReconcileHourlyRequest struct {
	ChannelId int    `form:"channel_id"`
	From      int64  `form:"from" binding:"required"`
	To        int64  `form:"to" binding:"required"`
	ModelName string `form:"model_name"`
	Page      int    `form:"page"`
	PageSize  int    `form:"page_size"`
}

// ExportReconcileRequest is query params for the monthly export endpoint.
// ChannelId == 0 means export all reconcile-enabled channels for the month.
type ExportReconcileRequest struct {
	ChannelId int    `form:"channel_id"`
	Month     string `form:"month" binding:"required"`
	Format    string `form:"format"`
	ModelName string `form:"model_name"`
}
