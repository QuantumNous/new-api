package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

const (
	nextDashboardSystemOnline   = "online"
	nextDashboardSystemDegraded = "degraded"
	currentNodeScope            = "current_node"
)

type nextDashboardNetworkSample struct {
	Timestamp        int64   `json:"timestamp"`
	TxBytesPerSecond float64 `json:"tx_bytes_per_second"`
	RxBytesPerSecond float64 `json:"rx_bytes_per_second"`
}

type nextDashboardSystem struct {
	Status                  string                       `json:"status"`
	Scope                   string                       `json:"scope"`
	SampledAt               int64                        `json:"sampled_at"`
	CPUPercent              *float64                     `json:"cpu_percent"`
	MemoryUsedBytes         *uint64                      `json:"memory_used_bytes"`
	MemoryTotalBytes        *uint64                      `json:"memory_total_bytes"`
	DiskUsedBytes           *uint64                      `json:"disk_used_bytes"`
	DiskTotalBytes          *uint64                      `json:"disk_total_bytes"`
	NetworkTxBytesPerSecond *float64                     `json:"network_tx_bytes_per_second"`
	NetworkRxBytesPerSecond *float64                     `json:"network_rx_bytes_per_second"`
	NetworkSeries           []nextDashboardNetworkSample `json:"network_series"`
	APISuccessRate24h       *float64                     `json:"api_success_rate_24h"`
	Version                 string                       `json:"version"`
}

func buildNextDashboardSystem(status common.SystemStatus, successRate *float64, successRateErr error) nextDashboardSystem {
	response := nextDashboardSystem{
		Status:            nextDashboardSystemOnline,
		Scope:             currentNodeScope,
		SampledAt:         status.SampledAt,
		NetworkSeries:     make([]nextDashboardNetworkSample, 0, len(status.NetworkSeries)),
		APISuccessRate24h: successRate,
		Version:           common.Version,
	}

	if status.CPUAvailable {
		response.CPUPercent = float64Pointer(status.CPUUsage)
	}
	if status.MemoryAvailable {
		response.MemoryUsedBytes = uint64Pointer(status.MemoryUsed)
		response.MemoryTotalBytes = uint64Pointer(status.MemoryTotal)
	}
	if status.DiskAvailable {
		response.DiskUsedBytes = uint64Pointer(status.DiskUsed)
		response.DiskTotalBytes = uint64Pointer(status.DiskTotal)
	}
	if status.NetworkAvailable {
		response.NetworkTxBytesPerSecond = float64Pointer(status.NetworkTxBytesPerSecond)
		response.NetworkRxBytesPerSecond = float64Pointer(status.NetworkRxBytesPerSecond)
	}
	for _, sample := range status.NetworkSeries {
		response.NetworkSeries = append(response.NetworkSeries, nextDashboardNetworkSample{
			Timestamp:        sample.Timestamp,
			TxBytesPerSecond: sample.TxBytesPerSecond,
			RxBytesPerSecond: sample.RxBytesPerSecond,
		})
	}

	if !status.CPUAvailable || !status.MemoryAvailable || !status.DiskAvailable || !status.NetworkAvailable || successRateErr != nil {
		response.Status = nextDashboardSystemDegraded
	}
	return response
}

func float64Pointer(value float64) *float64 { return &value }
func uint64Pointer(value uint64) *uint64    { return &value }

func NextGetDashboardSystem(c *gin.Context) {
	successRate, err := service.GetDashboardAPISuccessRate24h(c.Request.Context())
	common.ApiSuccess(c, buildNextDashboardSystem(common.GetSystemStatus(), successRate, err))
}
