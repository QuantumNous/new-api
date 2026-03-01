package controller

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/pkg/ionet"
	"github.com/go-fuego/fuego"
)

// --- internal helpers (refactored to return errors instead of writing to gin.Context) ---

func getIoAPIKey() (string, error) {
	common.OptionMapRWMutex.RLock()
	enabled := common.OptionMap["model_deployment.ionet.enabled"] == "true"
	apiKey := common.OptionMap["model_deployment.ionet.api_key"]
	common.OptionMapRWMutex.RUnlock()
	if !enabled || strings.TrimSpace(apiKey) == "" {
		return "", fmt.Errorf("io.net model deployment is not enabled or api key missing")
	}
	return apiKey, nil
}

func getIoClient() (*ionet.Client, error) {
	apiKey, err := getIoAPIKey()
	if err != nil {
		return nil, err
	}
	return ionet.NewClient(apiKey), nil
}

func getIoEnterpriseClient() (*ionet.Client, error) {
	apiKey, err := getIoAPIKey()
	if err != nil {
		return nil, err
	}
	return ionet.NewEnterpriseClient(apiKey), nil
}

// --- pure helpers (no context dependency) ---

func mapIoNetDeployment(d ionet.Deployment) dto.DeploymentItem {
	var created int64
	if d.CreatedAt.IsZero() {
		created = time.Now().Unix()
	} else {
		created = d.CreatedAt.Unix()
	}

	timeRemainingHours := d.ComputeMinutesRemaining / 60
	timeRemainingMins := d.ComputeMinutesRemaining % 60
	var timeRemaining string
	if timeRemainingHours > 0 {
		timeRemaining = fmt.Sprintf("%d hour %d minutes", timeRemainingHours, timeRemainingMins)
	} else if timeRemainingMins > 0 {
		timeRemaining = fmt.Sprintf("%d minutes", timeRemainingMins)
	} else {
		timeRemaining = "completed"
	}

	hardwareInfo := fmt.Sprintf("%s %s x%d", d.BrandName, d.HardwareName, d.HardwareQuantity)

	return dto.DeploymentItem{
		ID:                      d.ID,
		DeploymentName:          d.Name,
		ContainerName:           d.Name,
		Status:                  strings.ToLower(d.Status),
		Type:                    "Container",
		TimeRemaining:           timeRemaining,
		TimeRemainingMinutes:    d.ComputeMinutesRemaining,
		HardwareInfo:            hardwareInfo,
		HardwareName:            d.HardwareName,
		BrandName:               d.BrandName,
		HardwareQuantity:        d.HardwareQuantity,
		CompletedPercent:        d.CompletedPercent,
		ComputeMinutesServed:    d.ComputeMinutesServed,
		ComputeMinutesRemaining: d.ComputeMinutesRemaining,
		CreatedAt:               created,
		UpdatedAt:               created,
		ModelName:               "",
		ModelVersion:            "",
		InstanceCount:           d.HardwareQuantity,
		ResourceConfig: dto.DeploymentResourceConfig{
			CPU:    "",
			Memory: "",
			GPU:    strconv.Itoa(d.HardwareQuantity),
		},
		Description: "",
		Provider:    "io.net",
	}
}

func mapContainerEvents(events []ionet.ContainerEvent) []dto.ContainerEventItem {
	items := make([]dto.ContainerEventItem, 0, len(events))
	for _, event := range events {
		items = append(items, dto.ContainerEventItem{
			Time:    event.Time.Unix(),
			Message: event.Message,
		})
	}
	return items
}

func computeStatusCounts(total int, deployments []ionet.Deployment) map[string]int64 {
	counts := map[string]int64{
		"all": int64(total),
	}

	for _, status := range []string{"running", "completed", "failed", "deployment requested", "termination requested", "destroyed"} {
		counts[status] = 0
	}

	for _, d := range deployments {
		status := strings.ToLower(strings.TrimSpace(d.Status))
		counts[status] = counts[status] + 1
	}

	return counts
}

// --- handlers ---

func GetModelDeploymentSettings(c fuego.ContextNoBody) (*dto.Response[dto.DeploymentSettingsResponse], error) {
	common.OptionMapRWMutex.RLock()
	enabled := common.OptionMap["model_deployment.ionet.enabled"] == "true"
	hasAPIKey := strings.TrimSpace(common.OptionMap["model_deployment.ionet.api_key"]) != ""
	common.OptionMapRWMutex.RUnlock()

	return dto.Ok(dto.DeploymentSettingsResponse{
		Provider:   "io.net",
		Enabled:    enabled,
		Configured: hasAPIKey,
		CanConnect: enabled && hasAPIKey,
	})
}

func TestIoNetConnection(c fuego.ContextWithBody[dto.TestIoNetConnectionRequest]) (*dto.Response[dto.TestConnectionResponse], error) {
	req, err := c.Body()
	if err != nil {
		return dto.Fail[dto.TestConnectionResponse]("invalid request payload")
	}

	apiKey := strings.TrimSpace(req.APIKey)
	if apiKey == "" {
		common.OptionMapRWMutex.RLock()
		storedKey := strings.TrimSpace(common.OptionMap["model_deployment.ionet.api_key"])
		common.OptionMapRWMutex.RUnlock()
		if storedKey == "" {
			return dto.Fail[dto.TestConnectionResponse]("api_key is required")
		}
		apiKey = storedKey
	}

	client := ionet.NewEnterpriseClient(apiKey)
	result, err := client.GetMaxGPUsPerContainer()
	if err != nil {
		if apiErr, ok := err.(*ionet.APIError); ok {
			message := strings.TrimSpace(apiErr.Message)
			if message == "" {
				message = "failed to validate api key"
			}
			return dto.Fail[dto.TestConnectionResponse](message)
		}
		return dto.Fail[dto.TestConnectionResponse](err.Error())
	}

	totalHardware := 0
	totalAvailable := 0
	if result != nil {
		totalHardware = len(result.Hardware)
		totalAvailable = result.Total
		if totalAvailable == 0 {
			for _, hw := range result.Hardware {
				totalAvailable += hw.Available
			}
		}
	}

	return dto.Ok(dto.TestConnectionResponse{
		HardwareCount:  totalHardware,
		TotalAvailable: totalAvailable,
	})
}

func GetAllDeployments(c fuego.ContextWithParams[dto.GetAllDeploymentsParams]) (*dto.Response[dto.DeploymentListResponse], error) {
	p, _ := dto.ParseParams[dto.GetAllDeploymentsParams](c)
	pageInfo := dto.PageInfo(c)

	client, err := getIoEnterpriseClient()
	if err != nil {
		return dto.Fail[dto.DeploymentListResponse](err.Error())
	}

	opts := &ionet.ListDeploymentsOptions{
		Status:    strings.ToLower(strings.TrimSpace(p.Status)),
		Page:      pageInfo.GetPage(),
		PageSize:  pageInfo.GetPageSize(),
		SortBy:    "created_at",
		SortOrder: "desc",
	}

	dl, err := client.ListDeployments(opts)
	if err != nil {
		return dto.Fail[dto.DeploymentListResponse](err.Error())
	}

	items := make([]dto.DeploymentItem, 0, len(dl.Deployments))
	for _, d := range dl.Deployments {
		items = append(items, mapIoNetDeployment(d))
	}

	return dto.Ok(dto.DeploymentListResponse{
		Page:         pageInfo.GetPage(),
		PageSize:     pageInfo.GetPageSize(),
		Total:        dl.Total,
		Items:        items,
		StatusCounts: computeStatusCounts(dl.Total, dl.Deployments),
	})
}

func SearchDeployments(c fuego.ContextWithParams[dto.SearchDeploymentsParams]) (*dto.Response[dto.DeploymentSearchResponse], error) {
	p, _ := dto.ParseParams[dto.SearchDeploymentsParams](c)
	pageInfo := dto.PageInfo(c)

	client, err := getIoEnterpriseClient()
	if err != nil {
		return dto.Fail[dto.DeploymentSearchResponse](err.Error())
	}

	status := strings.ToLower(strings.TrimSpace(p.Status))
	keyword := strings.TrimSpace(p.Keyword)

	dl, err := client.ListDeployments(&ionet.ListDeploymentsOptions{
		Status:    status,
		Page:      pageInfo.GetPage(),
		PageSize:  pageInfo.GetPageSize(),
		SortBy:    "created_at",
		SortOrder: "desc",
	})
	if err != nil {
		return dto.Fail[dto.DeploymentSearchResponse](err.Error())
	}

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

	items := make([]dto.DeploymentItem, 0, len(filtered))
	for _, d := range filtered {
		items = append(items, mapIoNetDeployment(d))
	}

	total := dl.Total
	if keyword != "" {
		total = len(filtered)
	}

	return dto.Ok(dto.DeploymentSearchResponse{
		Page:     pageInfo.GetPage(),
		PageSize: pageInfo.GetPageSize(),
		Total:    total,
		Items:    items,
	})
}

func GetDeployment(c fuego.ContextNoBody) (*dto.Response[dto.DeploymentDetailResponse], error) {
	client, err := getIoEnterpriseClient()
	if err != nil {
		return dto.Fail[dto.DeploymentDetailResponse](err.Error())
	}

	deploymentID := strings.TrimSpace(c.PathParam("id"))
	if deploymentID == "" {
		return dto.Fail[dto.DeploymentDetailResponse]("deployment ID is required")
	}

	details, err := client.GetDeployment(deploymentID)
	if err != nil {
		return dto.Fail[dto.DeploymentDetailResponse](err.Error())
	}

	return dto.Ok(dto.DeploymentDetailResponse{
		ID:             details.ID,
		DeploymentName: details.ID,
		ModelName:      "",
		ModelVersion:   "",
		Status:         strings.ToLower(details.Status),
		InstanceCount:  details.TotalContainers,
		HardwareID:     details.HardwareID,
		ResourceConfig: dto.DeploymentResourceConfig{
			CPU:    "",
			Memory: "",
			GPU:    strconv.Itoa(details.TotalGPUs),
		},
		CreatedAt:               details.CreatedAt.Unix(),
		UpdatedAt:               details.CreatedAt.Unix(),
		Description:             "",
		AmountPaid:              details.AmountPaid,
		CompletedPercent:        details.CompletedPercent,
		GPUsPerContainer:        details.GPUsPerContainer,
		TotalGPUs:               details.TotalGPUs,
		TotalContainers:         details.TotalContainers,
		HardwareName:            details.HardwareName,
		BrandName:               details.BrandName,
		ComputeMinutesServed:    details.ComputeMinutesServed,
		ComputeMinutesRemaining: details.ComputeMinutesRemaining,
		Locations:               details.Locations,
		ContainerConfig:         details.ContainerConfig,
	})
}

func UpdateDeploymentName(c fuego.ContextWithBody[dto.UpdateDeploymentNameRequest]) (*dto.Response[dto.UpdateNameResponse], error) {
	client, err := getIoEnterpriseClient()
	if err != nil {
		return dto.Fail[dto.UpdateNameResponse](err.Error())
	}

	deploymentID := strings.TrimSpace(c.PathParam("id"))
	if deploymentID == "" {
		return dto.Fail[dto.UpdateNameResponse]("deployment ID is required")
	}

	req, err := c.Body()
	if err != nil {
		return dto.Fail[dto.UpdateNameResponse](err.Error())
	}

	updateReq := &ionet.UpdateClusterNameRequest{
		Name: strings.TrimSpace(req.Name),
	}

	if updateReq.Name == "" {
		return dto.Fail[dto.UpdateNameResponse]("deployment name cannot be empty")
	}

	available, err := client.CheckClusterNameAvailability(updateReq.Name)
	if err != nil {
		return dto.Fail[dto.UpdateNameResponse](fmt.Sprintf("failed to check name availability: %s", err.Error()))
	}

	if !available {
		return dto.Fail[dto.UpdateNameResponse]("deployment name is not available, please choose a different name")
	}

	resp, err := client.UpdateClusterName(deploymentID, updateReq)
	if err != nil {
		return dto.Fail[dto.UpdateNameResponse](err.Error())
	}

	return dto.Ok(dto.UpdateNameResponse{
		Status:  resp.Status,
		Message: resp.Message,
		ID:      deploymentID,
		Name:    updateReq.Name,
	})
}

func UpdateDeployment(c fuego.ContextWithBody[ionet.UpdateDeploymentRequest]) (*dto.Response[dto.DeploymentStatusResponse], error) {
	client, err := getIoEnterpriseClient()
	if err != nil {
		return dto.Fail[dto.DeploymentStatusResponse](err.Error())
	}

	deploymentID := strings.TrimSpace(c.PathParam("id"))
	if deploymentID == "" {
		return dto.Fail[dto.DeploymentStatusResponse]("deployment ID is required")
	}

	req, err := c.Body()
	if err != nil {
		return dto.Fail[dto.DeploymentStatusResponse](err.Error())
	}

	resp, err := client.UpdateDeployment(deploymentID, &req)
	if err != nil {
		return dto.Fail[dto.DeploymentStatusResponse](err.Error())
	}

	return dto.Ok(dto.DeploymentStatusResponse{
		Status:       resp.Status,
		DeploymentID: resp.DeploymentID,
	})
}

func ExtendDeployment(c fuego.ContextWithBody[ionet.ExtendDurationRequest]) (*dto.Response[dto.DeploymentItem], error) {
	client, err := getIoEnterpriseClient()
	if err != nil {
		return dto.Fail[dto.DeploymentItem](err.Error())
	}

	deploymentID := strings.TrimSpace(c.PathParam("id"))
	if deploymentID == "" {
		return dto.Fail[dto.DeploymentItem]("deployment ID is required")
	}

	req, err := c.Body()
	if err != nil {
		return dto.Fail[dto.DeploymentItem](err.Error())
	}

	details, err := client.ExtendDeployment(deploymentID, &req)
	if err != nil {
		return dto.Fail[dto.DeploymentItem](err.Error())
	}

	data := mapIoNetDeployment(ionet.Deployment{
		ID:                      details.ID,
		Status:                  details.Status,
		Name:                    deploymentID,
		CompletedPercent:        float64(details.CompletedPercent),
		HardwareQuantity:        details.TotalGPUs,
		BrandName:               details.BrandName,
		HardwareName:            details.HardwareName,
		ComputeMinutesServed:    details.ComputeMinutesServed,
		ComputeMinutesRemaining: details.ComputeMinutesRemaining,
		CreatedAt:               details.CreatedAt,
	})

	return dto.Ok(data)
}

func DeleteDeployment(c fuego.ContextNoBody) (*dto.Response[dto.DeleteDeploymentResponse], error) {
	client, err := getIoEnterpriseClient()
	if err != nil {
		return dto.Fail[dto.DeleteDeploymentResponse](err.Error())
	}

	deploymentID := strings.TrimSpace(c.PathParam("id"))
	if deploymentID == "" {
		return dto.Fail[dto.DeleteDeploymentResponse]("deployment ID is required")
	}

	resp, err := client.DeleteDeployment(deploymentID)
	if err != nil {
		return dto.Fail[dto.DeleteDeploymentResponse](err.Error())
	}

	return dto.Ok(dto.DeleteDeploymentResponse{
		Status:       resp.Status,
		DeploymentID: resp.DeploymentID,
		Message:      "Deployment termination requested successfully",
	})
}

func CreateDeployment(c fuego.ContextWithBody[ionet.DeploymentRequest]) (*dto.Response[dto.CreateDeploymentResponse], error) {
	client, err := getIoEnterpriseClient()
	if err != nil {
		return dto.Fail[dto.CreateDeploymentResponse](err.Error())
	}

	req, err := c.Body()
	if err != nil {
		return dto.Fail[dto.CreateDeploymentResponse](err.Error())
	}

	resp, err := client.DeployContainer(&req)
	if err != nil {
		return dto.Fail[dto.CreateDeploymentResponse](err.Error())
	}

	return dto.Ok(dto.CreateDeploymentResponse{
		DeploymentID: resp.DeploymentID,
		Status:       resp.Status,
		Message:      "Deployment created successfully",
	})
}

func GetHardwareTypes(c fuego.ContextNoBody) (*dto.Response[dto.HardwareTypesResponse], error) {
	client, err := getIoEnterpriseClient()
	if err != nil {
		return dto.Fail[dto.HardwareTypesResponse](err.Error())
	}

	hardwareTypes, totalAvailable, err := client.ListHardwareTypes()
	if err != nil {
		return dto.Fail[dto.HardwareTypesResponse](err.Error())
	}

	return dto.Ok(dto.HardwareTypesResponse{
		HardwareTypes:  hardwareTypes,
		Total:          len(hardwareTypes),
		TotalAvailable: totalAvailable,
	})
}

func GetLocations(c fuego.ContextNoBody) (*dto.Response[dto.LocationsListResponse], error) {
	client, err := getIoClient()
	if err != nil {
		return dto.Fail[dto.LocationsListResponse](err.Error())
	}

	locationsResp, err := client.ListLocations()
	if err != nil {
		return dto.Fail[dto.LocationsListResponse](err.Error())
	}

	total := locationsResp.Total
	if total == 0 {
		total = len(locationsResp.Locations)
	}

	return dto.Ok(dto.LocationsListResponse{
		Locations: locationsResp.Locations,
		Total:     total,
	})
}

func GetAvailableReplicas(c fuego.ContextWithParams[dto.GetAvailableReplicasParams]) (*dto.Response[*ionet.AvailableReplicasResponse], error) {
	p, _ := dto.ParseParams[dto.GetAvailableReplicasParams](c)
	client, err := getIoEnterpriseClient()
	if err != nil {
		return dto.Fail[*ionet.AvailableReplicasResponse](err.Error())
	}

	if c.QueryParam("hardware_id") == "" {
		return dto.Fail[*ionet.AvailableReplicasResponse]("hardware_id parameter is required")
	}

	hardwareID := p.HardwareID
	if hardwareID <= 0 {
		return dto.Fail[*ionet.AvailableReplicasResponse]("invalid hardware_id parameter")
	}

	gpuCount := p.GpuCount
	if gpuCount <= 0 {
		gpuCount = 1
	}

	replicas, err := client.GetAvailableReplicas(hardwareID, gpuCount)
	if err != nil {
		return dto.Fail[*ionet.AvailableReplicasResponse](err.Error())
	}

	return dto.Ok(replicas)
}

func GetPriceEstimation(c fuego.ContextWithBody[ionet.PriceEstimationRequest]) (*dto.Response[*ionet.PriceEstimationResponse], error) {
	client, err := getIoEnterpriseClient()
	if err != nil {
		return dto.Fail[*ionet.PriceEstimationResponse](err.Error())
	}

	req, err := c.Body()
	if err != nil {
		return dto.Fail[*ionet.PriceEstimationResponse](err.Error())
	}

	priceResp, err := client.GetPriceEstimation(&req)
	if err != nil {
		return dto.Fail[*ionet.PriceEstimationResponse](err.Error())
	}

	return dto.Ok(priceResp)
}

func CheckClusterNameAvailability(c fuego.ContextWithParams[dto.CheckClusterNameAvailabilityParams]) (*dto.Response[dto.ClusterNameAvailabilityResponse], error) {
	p, _ := dto.ParseParams[dto.CheckClusterNameAvailabilityParams](c)
	client, err := getIoEnterpriseClient()
	if err != nil {
		return dto.Fail[dto.ClusterNameAvailabilityResponse](err.Error())
	}

	clusterName := strings.TrimSpace(p.Name)
	if clusterName == "" {
		return dto.Fail[dto.ClusterNameAvailabilityResponse]("name parameter is required")
	}

	available, err := client.CheckClusterNameAvailability(clusterName)
	if err != nil {
		return dto.Fail[dto.ClusterNameAvailabilityResponse](err.Error())
	}

	return dto.Ok(dto.ClusterNameAvailabilityResponse{
		Available: available,
		Name:      clusterName,
	})
}

func GetDeploymentLogs(c fuego.ContextWithParams[dto.GetDeploymentLogsParams]) (*dto.Response[string], error) {
	p, _ := dto.ParseParams[dto.GetDeploymentLogsParams](c)
	client, err := getIoClient()
	if err != nil {
		return dto.Fail[string](err.Error())
	}

	deploymentID := strings.TrimSpace(c.PathParam("id"))
	if deploymentID == "" {
		return dto.Fail[string]("deployment ID is required")
	}

	containerID := p.ContainerID
	if containerID == "" {
		return dto.Fail[string]("container_id parameter is required")
	}

	limit := p.Limit
	if limit <= 0 {
		limit = 100
	}
	if limit > 1000 {
		limit = 1000
	}

	opts := &ionet.GetLogsOptions{
		Level:  p.Level,
		Stream: p.Stream,
		Limit:  limit,
		Cursor: p.Cursor,
		Follow: p.Follow,
	}

	if p.StartTime != "" {
		if t, err := time.Parse(time.RFC3339, p.StartTime); err == nil {
			opts.StartTime = &t
		}
	}
	if p.EndTime != "" {
		if t, err := time.Parse(time.RFC3339, p.EndTime); err == nil {
			opts.EndTime = &t
		}
	}

	rawLogs, err := client.GetContainerLogsRaw(deploymentID, containerID, opts)
	if err != nil {
		return dto.Fail[string](err.Error())
	}

	return dto.Ok(rawLogs)
}

func ListDeploymentContainers(c fuego.ContextNoBody) (*dto.Response[dto.ContainerListResponse], error) {
	client, err := getIoEnterpriseClient()
	if err != nil {
		return dto.Fail[dto.ContainerListResponse](err.Error())
	}

	deploymentID := strings.TrimSpace(c.PathParam("id"))
	if deploymentID == "" {
		return dto.Fail[dto.ContainerListResponse]("deployment ID is required")
	}

	containers, err := client.ListContainers(deploymentID)
	if err != nil {
		return dto.Fail[dto.ContainerListResponse](err.Error())
	}

	items := make([]dto.ContainerItem, 0)
	if containers != nil {
		items = make([]dto.ContainerItem, 0, len(containers.Workers))
		for _, ctr := range containers.Workers {
			items = append(items, dto.ContainerItem{
				ContainerID:      ctr.ContainerID,
				DeviceID:         ctr.DeviceID,
				Status:           strings.ToLower(strings.TrimSpace(ctr.Status)),
				Hardware:         ctr.Hardware,
				BrandName:        ctr.BrandName,
				CreatedAt:        ctr.CreatedAt.Unix(),
				UptimePercent:    ctr.UptimePercent,
				GPUsPerContainer: ctr.GPUsPerContainer,
				PublicURL:        ctr.PublicURL,
				Events:           mapContainerEvents(ctr.ContainerEvents),
			})
		}
	}

	total := 0
	if containers != nil {
		total = containers.Total
	}

	return dto.Ok(dto.ContainerListResponse{
		Total:      total,
		Containers: items,
	})
}

func GetContainerDetails(c fuego.ContextNoBody) (*dto.Response[dto.ContainerDetailResponse], error) {
	client, err := getIoEnterpriseClient()
	if err != nil {
		return dto.Fail[dto.ContainerDetailResponse](err.Error())
	}

	deploymentID := strings.TrimSpace(c.PathParam("id"))
	if deploymentID == "" {
		return dto.Fail[dto.ContainerDetailResponse]("deployment ID is required")
	}

	containerID := strings.TrimSpace(c.PathParam("container_id"))
	if containerID == "" {
		return dto.Fail[dto.ContainerDetailResponse]("container ID is required")
	}

	details, err := client.GetContainerDetails(deploymentID, containerID)
	if err != nil {
		return dto.Fail[dto.ContainerDetailResponse](err.Error())
	}
	if details == nil {
		return dto.Fail[dto.ContainerDetailResponse]("container details not found")
	}

	return dto.Ok(dto.ContainerDetailResponse{
		DeploymentID:     deploymentID,
		ContainerID:      details.ContainerID,
		DeviceID:         details.DeviceID,
		Status:           strings.ToLower(strings.TrimSpace(details.Status)),
		Hardware:         details.Hardware,
		BrandName:        details.BrandName,
		CreatedAt:        details.CreatedAt.Unix(),
		UptimePercent:    details.UptimePercent,
		GPUsPerContainer: details.GPUsPerContainer,
		PublicURL:        details.PublicURL,
		Events:           mapContainerEvents(details.ContainerEvents),
	})
}
