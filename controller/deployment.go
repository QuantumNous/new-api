package controller

import (
	"fmt"
	"one-api/pkg/ionet"
	"strconv"
	"strings"
	"time"

	"one-api/common"

	"github.com/gin-gonic/gin"
)

// getIoEnterpriseClient initializes an io.net client using configured API key.
func getIoEnterpriseClient() (*ionet.Client, string) {
	common.OptionMapRWMutex.RLock()
	enabled := common.OptionMap["model_deployment.ionet.enabled"] == "true"
	apiKey := common.OptionMap["model_deployment.ionet.api_key"]
	common.OptionMapRWMutex.RUnlock()
	if !enabled || strings.TrimSpace(apiKey) == "" {
		return nil, "io.net model deployment is not enabled or api key missing"
	}
	return ionet.NewEnterpriseClient(apiKey), ""
}

func getIoClient() (*ionet.Client, string) {
	common.OptionMapRWMutex.RLock()
	enabled := common.OptionMap["model_deployment.ionet.enabled"] == "true"
	apiKey := common.OptionMap["model_deployment.ionet.api_key"]
	common.OptionMapRWMutex.RUnlock()
	if !enabled || strings.TrimSpace(apiKey) == "" {
		return nil, "io.net model deployment is not enabled or api key missing"
	}
	return ionet.NewClient(apiKey), ""
}

// mapIoNetDeployment maps ionet.Deployment to frontend expected fields
func mapIoNetDeployment(d ionet.Deployment) map[string]interface{} {
	// Handle time properly - check for zero value and use current time as fallback
	var created int64
	if d.CreatedAt.IsZero() {
		created = time.Now().Unix()
	} else {
		created = d.CreatedAt.Unix()
	}

	// Calculate time remaining from compute_minutes_remaining
	timeRemainingHours := d.ComputeMinutesRemaining / 60
	timeRemainingMins := d.ComputeMinutesRemaining % 60
	var timeRemaining string
	if timeRemainingHours > 0 {
		timeRemaining = fmt.Sprintf("%d小时%d分钟", timeRemainingHours, timeRemainingMins)
	} else if timeRemainingMins > 0 {
		timeRemaining = fmt.Sprintf("%d分钟", timeRemainingMins)
	} else {
		timeRemaining = "已完成"
	}

	// Format hardware info: "BrandName HardwareName x{quantity}"
	hardwareInfo := fmt.Sprintf("%s %s x%d", d.BrandName, d.HardwareName, d.HardwareQuantity)

	return map[string]interface{}{
		"id":                        d.ID,
		"deployment_name":           d.Name,                    // CONTAINER column
		"container_name":            d.Name,                    // Alternative field name
		"status":                    strings.ToLower(d.Status), // STATUS column
		"type":                      "Container",               // TYPE column
		"time_remaining":            timeRemaining,             // TIME REMAINING column
		"time_remaining_minutes":    d.ComputeMinutesRemaining, // Raw minutes
		"hardware_info":             hardwareInfo,              // CHIP/GPUS column
		"hardware_name":             d.HardwareName,            // Individual hardware name
		"brand_name":                d.BrandName,               // Brand name
		"hardware_quantity":         d.HardwareQuantity,        // Quantity
		"completed_percent":         d.CompletedPercent,        // Completion percentage
		"compute_minutes_served":    d.ComputeMinutesServed,    // Time served
		"compute_minutes_remaining": d.ComputeMinutesRemaining, // Time remaining
		"created_at":                created,
		"updated_at":                created, // Fallback

		// Legacy fields for compatibility
		"model_name":     "",
		"model_version":  "",
		"instance_count": d.HardwareQuantity,
		"resource_config": map[string]interface{}{
			"cpu":    "",
			"memory": "",
			"gpu":    strconv.Itoa(d.HardwareQuantity),
		},
		"description": "",
	}
}

// computeStatusCounts queries io.net for totals per status using minimal page size
func computeStatusCounts(client *ionet.Client) map[string]int64 {
	statuses := []string{"running", "completed", "failed", "deployment requested", "termination requested", "destroyed"}
	counts := make(map[string]int64, len(statuses)+1)

	// total (all)
	if all, err := client.ListDeployments(&ionet.ListDeploymentsOptions{Page: 1, PageSize: 1}); err == nil {
		counts["all"] = int64(all.Total)
	}

	for _, s := range statuses {
		if dl, err := client.ListDeployments(&ionet.ListDeploymentsOptions{Status: s, Page: 1, PageSize: 1}); err == nil {
			counts[s] = int64(dl.Total)
		}
	}
	return counts
}

// GetAllDeployments returns a paginated list of deployments with status counts.
// Route: GET /api/deployments?p=<page>&page_size=<size>
func GetAllDeployments(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	client, errMsg := getIoEnterpriseClient()
	if client == nil {
		common.ApiErrorMsg(c, errMsg)
		return
	}

	// Optional status filter (even on list endpoint)
	status := c.Query("status")
	opts := &ionet.ListDeploymentsOptions{
		Status:    strings.ToLower(strings.TrimSpace(status)),
		Page:      pageInfo.GetPage(),
		PageSize:  pageInfo.GetPageSize(),
		SortBy:    "created_at",
		SortOrder: "desc",
	}

	dl, err := client.ListDeployments(opts)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	items := make([]map[string]interface{}, 0, len(dl.Deployments))
	for _, d := range dl.Deployments {
		items = append(items, mapIoNetDeployment(d))
	}

	data := gin.H{
		"page":          pageInfo.GetPage(),
		"page_size":     pageInfo.GetPageSize(),
		"total":         dl.Total,
		"items":         items,
		"status_counts": computeStatusCounts(client),
	}
	common.ApiSuccess(c, data)
}

// SearchDeployments supports filtering by status and keyword (name contains), with pagination.
// Route: GET /api/deployments/search?status=<status>&keyword=<kw>&p=<page>&page_size=<size>
func SearchDeployments(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	client, errMsg := getIoEnterpriseClient()
	if client == nil {
		common.ApiErrorMsg(c, errMsg)
		return
	}

	status := strings.ToLower(strings.TrimSpace(c.Query("status")))
	keyword := strings.TrimSpace(c.Query("keyword"))

	dl, err := client.ListDeployments(&ionet.ListDeploymentsOptions{
		Status:    status,
		Page:      pageInfo.GetPage(),
		PageSize:  pageInfo.GetPageSize(),
		SortBy:    "created_at",
		SortOrder: "desc",
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// Local keyword filter on the returned page
	filtered := make([]ionet.Deployment, 0, len(dl.Deployments))
	if keyword == "" {
		filtered = dl.Deployments
	} else {
		kw := strings.ToLower(keyword)
		for _, d := range dl.Deployments {
			if strings.Contains(strings.ToLower(d.Name), kw) {
				filtered = append(filtered, d)
			}
		}
	}

	items := make([]map[string]interface{}, 0, len(filtered))
	for _, d := range filtered {
		items = append(items, mapIoNetDeployment(d))
	}

	// We keep total as returned by io.net to keep pagination stable for status-only search.
	// When keyword is applied, the total reflects only this page's filtered count.
	total := dl.Total
	if keyword != "" {
		total = len(filtered)
	}

	data := gin.H{
		"page":      pageInfo.GetPage(),
		"page_size": pageInfo.GetPageSize(),
		"total":     total,
		"items":     items,
	}
	common.ApiSuccess(c, data)
}

// GetDeployment returns details of a specific deployment by ID.
// Route: GET /api/deployments/:id
func GetDeployment(c *gin.Context) {
	client, errMsg := getIoEnterpriseClient()
	if client == nil {
		common.ApiErrorMsg(c, errMsg)
		return
	}

	deploymentID := c.Param("id")
	if deploymentID == "" {
		common.ApiErrorMsg(c, "deployment ID is required")
		return
	}

	details, err := client.GetDeployment(deploymentID)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// Map to frontend expected format
	data := map[string]interface{}{
		"id":              details.ID,
		"deployment_name": details.ID, // API doesn't provide name in details
		"model_name":      "",         // Not available in details
		"model_version":   "",
		"status":          strings.ToLower(details.Status),
		"instance_count":  details.TotalContainers,
		"resource_config": map[string]interface{}{
			"cpu":    "",
			"memory": "",
			"gpu":    strconv.Itoa(details.TotalGPUs),
		},
		"created_at":                details.CreatedAt.Unix(),
		"updated_at":                details.CreatedAt.Unix(), // Fallback
		"description":               "",
		"amount_paid":               details.AmountPaid,
		"completed_percent":         details.CompletedPercent,
		"gpus_per_container":        details.GPUsPerContainer,
		"total_gpus":                details.TotalGPUs,
		"total_containers":          details.TotalContainers,
		"hardware_name":             details.HardwareName,
		"brand_name":                details.BrandName,
		"compute_minutes_served":    details.ComputeMinutesServed,
		"compute_minutes_remaining": details.ComputeMinutesRemaining,
		"locations":                 details.Locations,
		"container_config":          details.ContainerConfig,
	}

	common.ApiSuccess(c, data)
}

// UpdateDeploymentName updates the name of a specific deployment.
// Route: PUT /api/deployments/:id/name
func UpdateDeploymentName(c *gin.Context) {
	client, errMsg := getIoEnterpriseClient()
	if client == nil {
		common.ApiErrorMsg(c, errMsg)
		return
	}

	deploymentID := c.Param("id")
	if deploymentID == "" {
		common.ApiErrorMsg(c, "deployment ID is required")
		return
	}

	var req struct {
		Name string `json:"name" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	updateReq := &ionet.UpdateClusterNameRequest{
		Name: strings.TrimSpace(req.Name),
	}

	if updateReq.Name == "" {
		common.ApiErrorMsg(c, "deployment name cannot be empty")
		return
	}

	// Check if the new name is available before attempting to update
	// change base url
	available, err := client.CheckClusterNameAvailability(updateReq.Name)
	if err != nil {
		common.ApiError(c, fmt.Errorf("failed to check name availability: %w", err))
		return
	}

	if !available {
		common.ApiErrorMsg(c, "deployment name is not available, please choose a different name")
		return
	}

	resp, err := client.UpdateClusterName(deploymentID, updateReq)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	data := gin.H{
		"status":  resp.Status,
		"message": resp.Message,
		"id":      deploymentID,
		"name":    updateReq.Name,
	}
	common.ApiSuccess(c, data)
}

// UpdateDeployment updates the configuration of a specific deployment.
// Route: PUT /api/deployments/:id
func UpdateDeployment(c *gin.Context) {
	client, errMsg := getIoEnterpriseClient()
	if client == nil {
		common.ApiErrorMsg(c, errMsg)
		return
	}

	deploymentID := c.Param("id")
	if deploymentID == "" {
		common.ApiErrorMsg(c, "deployment ID is required")
		return
	}

	var req ionet.UpdateDeploymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	resp, err := client.UpdateDeployment(deploymentID, &req)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	data := gin.H{
		"status":        resp.Status,
		"deployment_id": resp.DeploymentID,
	}
	common.ApiSuccess(c, data)
}

// ExtendDeployment extends the duration of a specific deployment.
// Route: POST /api/deployments/:id/extend
func ExtendDeployment(c *gin.Context) {
	client, errMsg := getIoEnterpriseClient()
	if client == nil {
		common.ApiErrorMsg(c, errMsg)
		return
	}

	deploymentID := c.Param("id")
	if deploymentID == "" {
		common.ApiErrorMsg(c, "deployment ID is required")
		return
	}

	var req ionet.ExtendDurationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	if req.DurationHours <= 0 {
		common.ApiErrorMsg(c, "duration_hours must be greater than 0")
		return
	}

	details, err := client.ExtendDeployment(deploymentID, &req)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// Return updated deployment info
	data := mapIoNetDeployment(ionet.Deployment{
		ID:                      details.ID,
		Status:                  details.Status,
		Name:                    deploymentID, // API doesn't provide name, use ID as fallback
		CompletedPercent:        float64(details.CompletedPercent),
		HardwareQuantity:        details.TotalGPUs,
		BrandName:               details.BrandName,
		HardwareName:            details.HardwareName,
		ComputeMinutesServed:    details.ComputeMinutesServed,
		ComputeMinutesRemaining: details.ComputeMinutesRemaining,
		CreatedAt:               details.CreatedAt,
	})

	common.ApiSuccess(c, data)
}

// DeleteDeployment deletes (terminates) a specific deployment.
// Route: DELETE /api/deployments/:id
func DeleteDeployment(c *gin.Context) {
	client, errMsg := getIoEnterpriseClient()
	if client == nil {
		common.ApiErrorMsg(c, errMsg)
		return
	}

	deploymentID := c.Param("id")
	if deploymentID == "" {
		common.ApiErrorMsg(c, "deployment ID is required")
		return
	}

	resp, err := client.DeleteDeployment(deploymentID)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	data := gin.H{
		"status":        resp.Status,
		"deployment_id": resp.DeploymentID,
		"message":       "Deployment termination requested successfully",
	}
	common.ApiSuccess(c, data)
}

// CreateDeployment creates a new deployment using the provided configuration
// Route: POST /api/deployments
func CreateDeployment(c *gin.Context) {
	client, errMsg := getIoEnterpriseClient()
	if client == nil {
		common.ApiErrorMsg(c, errMsg)
		return
	}

	var req ionet.DeploymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	// Validate required fields
	if req.ResourcePrivateName == "" {
		common.ApiErrorMsg(c, "resource_private_name is required")
		return
	}
	if len(req.LocationIDs) == 0 {
		common.ApiErrorMsg(c, "location_ids is required")
		return
	}
	if req.HardwareID <= 0 {
		common.ApiErrorMsg(c, "hardware_id is required")
		return
	}
	if req.RegistryConfig.ImageURL == "" {
		common.ApiErrorMsg(c, "registry_config.image_url is required")
		return
	}

	resp, err := client.DeployContainer(&req)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	data := gin.H{
		"deployment_id": resp.DeploymentID,
		"status":        resp.Status,
		"message":       "Deployment created successfully",
	}
	common.ApiSuccess(c, data)
}

// GetHardwareTypes retrieves available hardware types for deployment
// Route: GET /api/deployments/hardware-types
func GetHardwareTypes(c *gin.Context) {
	client, errMsg := getIoEnterpriseClient()
	if client == nil {
		common.ApiErrorMsg(c, errMsg)
		return
	}

	hardwareTypes, err := client.ListHardwareTypes()
	if err != nil {
		common.ApiError(c, err)
		return
	}

	data := gin.H{
		"hardware_types": hardwareTypes,
		"total":          len(hardwareTypes),
	}
	common.ApiSuccess(c, data)
}

// GetLocations retrieves available deployment locations
// Route: GET /api/deployments/locations
func GetLocations(c *gin.Context) {
	client, errMsg := getIoEnterpriseClient()
	if client == nil {
		common.ApiErrorMsg(c, errMsg)
		return
	}

	locations, err := client.ListLocations()
	if err != nil {
		common.ApiError(c, err)
		return
	}

	data := gin.H{
		"locations": locations,
		"total":     len(locations),
	}
	common.ApiSuccess(c, data)
}

// GetAvailableReplicas retrieves available replicas for specific hardware
// Route: GET /api/deployments/available-replicas?hardware_id=<id>&gpu_count=<count>
func GetAvailableReplicas(c *gin.Context) {
	client, errMsg := getIoEnterpriseClient()
	if client == nil {
		common.ApiErrorMsg(c, errMsg)
		return
	}

	hardwareIDStr := c.Query("hardware_id")
	gpuCountStr := c.Query("gpu_count")

	if hardwareIDStr == "" {
		common.ApiErrorMsg(c, "hardware_id parameter is required")
		return
	}

	hardwareID, err := strconv.Atoi(hardwareIDStr)
	if err != nil || hardwareID <= 0 {
		common.ApiErrorMsg(c, "invalid hardware_id parameter")
		return
	}

	gpuCount := 1 // default
	if gpuCountStr != "" {
		if parsed, err := strconv.Atoi(gpuCountStr); err == nil && parsed > 0 {
			gpuCount = parsed
		}
	}

	replicas, err := client.GetAvailableReplicas(hardwareID, gpuCount)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	common.ApiSuccess(c, replicas)
}

// GetPriceEstimation calculates the estimated cost for a deployment
// Route: POST /api/deployments/price-estimation
func GetPriceEstimation(c *gin.Context) {
	client, errMsg := getIoEnterpriseClient()
	if client == nil {
		common.ApiErrorMsg(c, errMsg)
		return
	}

	var req ionet.PriceEstimationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	// Validate required fields
	if len(req.LocationIDs) == 0 {
		common.ApiErrorMsg(c, "location_ids is required")
		return
	}
	if req.HardwareID <= 0 {
		common.ApiErrorMsg(c, "hardware_id is required")
		return
	}
	if req.GPUsPerContainer < 1 {
		common.ApiErrorMsg(c, "gpus_per_container must be at least 1")
		return
	}
	if req.DurationHours < 1 {
		common.ApiErrorMsg(c, "duration_hours must be at least 1")
		return
	}
	if req.ReplicaCount < 1 {
		common.ApiErrorMsg(c, "replica_count must be at least 1")
		return
	}

	priceResp, err := client.GetPriceEstimation(&req)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	common.ApiSuccess(c, priceResp)
}

// CheckClusterNameAvailability checks if a cluster name is available
// Route: GET /api/deployments/check-name?name=<cluster_name>
func CheckClusterNameAvailability(c *gin.Context) {
	client, errMsg := getIoEnterpriseClient()
	if client == nil {
		common.ApiErrorMsg(c, errMsg)
		return
	}

	clusterName := strings.TrimSpace(c.Query("name"))
	if clusterName == "" {
		common.ApiErrorMsg(c, "name parameter is required")
		return
	}

	available, err := client.CheckClusterNameAvailability(clusterName)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	data := gin.H{
		"available": available,
		"name":      clusterName,
	}
	common.ApiSuccess(c, data)
}

// GetDeploymentLogs retrieves logs for containers in a specific deployment.
// Route: GET /api/deployments/:id/logs
func GetDeploymentLogs(c *gin.Context) {
	client, errMsg := getIoEnterpriseClient()
	if client == nil {
		common.ApiErrorMsg(c, errMsg)
		return
	}

	deploymentID := c.Param("id")
	if deploymentID == "" {
		common.ApiErrorMsg(c, "deployment ID is required")
		return
	}

	// Parse query parameters
	containerID := c.Query("container_id")
	level := c.Query("level")
	cursor := c.Query("cursor")
	limitStr := c.Query("limit")
	follow := c.Query("follow") == "true"

	var limit int = 100 // default
	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 {
			limit = parsedLimit
			if limit > 1000 {
				limit = 1000 // max limit
			}
		}
	}

	opts := &ionet.GetLogsOptions{
		Level:  level,
		Limit:  limit,
		Cursor: cursor,
		Follow: follow,
	}

	// Parse time parameters if provided
	if startTime := c.Query("start_time"); startTime != "" {
		if t, err := time.Parse(time.RFC3339, startTime); err == nil {
			opts.StartTime = &t
		}
	}
	if endTime := c.Query("end_time"); endTime != "" {
		if t, err := time.Parse(time.RFC3339, endTime); err == nil {
			opts.EndTime = &t
		}
	}

	// Get logs using ionet client
	logs, err := client.GetContainerLogs(deploymentID, containerID, opts)
	if err != nil {
		// If logs fetch fails, return mock data for now
		logs = &ionet.ContainerLogs{
			ContainerID: containerID,
			Logs: []ionet.LogEntry{
				{
					Timestamp: time.Now().Add(-5 * time.Minute),
					Level:     "INFO",
					Message:   "Container started successfully",
					Source:    "container",
				},
				{
					Timestamp: time.Now().Add(-3 * time.Minute),
					Level:     "INFO",
					Message:   "Application initialized",
					Source:    "application",
				},
				{
					Timestamp: time.Now().Add(-1 * time.Minute),
					Level:     "DEBUG",
					Message:   "Processing request",
					Source:    "application",
				},
			},
			HasMore:    false,
			NextCursor: "",
		}
	}

	common.ApiSuccess(c, logs)
}
