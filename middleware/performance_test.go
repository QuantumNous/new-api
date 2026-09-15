package middleware

import (
	"net/http"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSystemPerformanceCheckRequiresFreshOverloadStatus(t *testing.T) {
	thresholds := common.PerformanceMonitorConfig{
		Enabled:         true,
		CPUThreshold:    90,
		MemoryThreshold: 90,
		DiskThreshold:   90,
	}

	// 采样过期（监控未运行或被阻塞）时不应熔断，避免状态陈旧误伤流量。
	common.SetPerformanceMonitorConfig(thresholds)
	common.SetSystemStatus(common.SystemStatus{
		CPUOverloaded: true,
		SampledAt:     time.Now().Add(-time.Minute),
	})
	assert.Nil(t, checkSystemPerformance(), "过期采样不得触发哨兵")

	// 监控关闭时不熔断。
	common.SetPerformanceMonitorConfig(common.PerformanceMonitorConfig{Enabled: false, CPUThreshold: 90})
	common.SetSystemStatus(common.SystemStatus{CPUOverloaded: true, SampledAt: time.Now()})
	assert.Nil(t, checkSystemPerformance(), "关闭监控时不得触发哨兵")

	// 新采样判定过载时必须熔断，并保留可分类的错误码。
	common.SetPerformanceMonitorConfig(thresholds)
	common.SetSystemStatus(common.SystemStatus{CPUUsage: 99.5, CPUOverloaded: true, SampledAt: time.Now()})
	err := checkSystemPerformance()
	require.Error(t, err, "新鲜采样判定过载时必须熔断")
	assert.Equal(t, http.StatusServiceUnavailable, err.StatusCode)
	assert.Equal(t, "system_cpu_overloaded", string(err.GetErrorCode()))

	// 采样正常时放行。
	common.SetSystemStatus(common.SystemStatus{CPUUsage: 10, SampledAt: time.Now()})
	assert.Nil(t, checkSystemPerformance(), "健康状态必须放行")
}
