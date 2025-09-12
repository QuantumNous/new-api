package controller

import (
    "strconv"
    "strings"

    "one-api/common"
    ionet "one-api/src/service/ionet"

    "github.com/gin-gonic/gin"
)

// getIoNetClient initializes an io.net client using configured API key.
func getIoNetClient() (*ionet.Client, string) {
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
    created := d.CreatedAt.Unix()
    // io.net list does not provide updated time; use created time as fallback
    updated := created
    // resource_config is not provided by io.net list; derive gpu from GPUCount
    // Convert GPUCount to string pointer if >0
    var gpuPtr *string
    if d.GPUCount > 0 {
        gs := strconv.Itoa(d.GPUCount)
        gpuPtr = &gs
    }
    resource := map[string]interface{}{
        "cpu":    "",
        "memory": "",
        "gpu":    gpuPtr,
    }

    return map[string]interface{}{
        "id":              d.ID,
        "deployment_name": d.Name,
        "model_name":      "", // unknown from list API
        "model_version":   "",
        "status":          strings.ToLower(d.Status),
        "instance_count":  d.Replicas,
        "resource_config": resource,
        "created_at":      created,
        "updated_at":      updated,
        "description":     "",
    }
}

// computeStatusCounts queries io.net for totals per status using minimal page size
func computeStatusCounts(client *ionet.Client) map[string]int64 {
    statuses := []string{"running", "deploying", "stopped", "error", "pending"}
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
    client, errMsg := getIoNetClient()
    if client == nil {
        common.ApiErrorMsg(c, errMsg)
        return
    }

    // Optional status filter (even on list endpoint)
    status := c.Query("status")
    opts := &ionet.ListDeploymentsOptions{
        Status:   strings.ToLower(strings.TrimSpace(status)),
        Page:     pageInfo.GetPage(),
        PageSize: pageInfo.GetPageSize(),
        SortBy:   "created_at",
        SortOrder:"desc",
    }

    dl, err := client.ListDeployments(opts)
    if err != nil {
        common.ApiError(c, err)
        return
    }

    items := make([]map[string]interface{}, 0, len(dl.Clusters))
    for _, d := range dl.Clusters {
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
    client, errMsg := getIoNetClient()
    if client == nil {
        common.ApiErrorMsg(c, errMsg)
        return
    }

    status := strings.ToLower(strings.TrimSpace(c.Query("status")))
    keyword := strings.TrimSpace(c.Query("keyword"))

    dl, err := client.ListDeployments(&ionet.ListDeploymentsOptions{
        Status:   status,
        Page:     pageInfo.GetPage(),
        PageSize: pageInfo.GetPageSize(),
        SortBy:   "created_at",
        SortOrder:"desc",
    })
    if err != nil {
        common.ApiError(c, err)
        return
    }

    // Local keyword filter on the returned page
    filtered := make([]ionet.Deployment, 0, len(dl.Clusters))
    if keyword == "" {
        filtered = dl.Clusters
    } else {
        kw := strings.ToLower(keyword)
        for _, d := range dl.Clusters {
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
