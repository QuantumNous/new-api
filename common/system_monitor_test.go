package common

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newTestContainerUsage 在临时目录中构造 cgroup 文件，避免依赖运行环境的真实 cgroup。
func newTestContainerUsage(t *testing.T, schedulableCPUs float64, files map[string]string) *containerUsage {
	t.Helper()
	root := t.TempDir()
	for name, content := range files {
		writeTestCgroupFile(t, filepath.Join(root, name), content)
	}
	return &containerUsage{cgroupRoot: root, schedulableCPUs: schedulableCPUs}
}

func writeTestCgroupFile(t *testing.T, path string, content string) {
	t.Helper()
	require.NoError(t, os.MkdirAll(filepath.Dir(path), 0o755))
	require.NoError(t, os.WriteFile(path, []byte(content), 0o600))
}

func TestContainerCPUSaturation(t *testing.T) {
	tests := []struct {
		name            string
		schedulableCPUs float64
		files           map[string]string
		usageFile       string
		usageAfter      string
		want            float64
	}{
		{
			name:            "cgroup v2 quota",
			schedulableCPUs: 4,
			files:           map[string]string{"cpu.max": "200000 100000\n", "cpu.stat": "usage_usec 1000000\nuser_usec 900000\n"},
			usageFile:       "cpu.stat",
			usageAfter:      "usage_usec 6000000\n", // 5 秒用 1 核，配额 2 核
			want:            50,
		},
		{
			name:            "fractional quota",
			schedulableCPUs: 4,
			files:           map[string]string{"cpu.max": "50000 100000\n", "cpu.stat": "usage_usec 1000000\n"},
			usageFile:       "cpu.stat",
			usageAfter:      "usage_usec 3500000\n", // 5 秒用 0.5 核，配额 0.5 核
			want:            100,
		},
		{
			name:            "quota above schedulable CPUs",
			schedulableCPUs: 1,
			files:           map[string]string{"cpu.max": "200000 100000\n", "cpu.stat": "usage_usec 1000000\n"},
			usageFile:       "cpu.stat",
			usageAfter:      "usage_usec 6000000\n", // cpuset 只有 1 核，已打满
			want:            100,
		},
		{
			name:            "cgroup v1 quota",
			schedulableCPUs: 4,
			files: map[string]string{
				"cpu/cpu.cfs_quota_us":  "200000\n",
				"cpu/cpu.cfs_period_us": "100000\n",
				"cpuacct/cpuacct.usage": "1000000000\n",
			},
			usageFile:  "cpuacct/cpuacct.usage",
			usageAfter: "11000000000\n", // 纳秒：5 秒用 2 核
			want:       100,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			usage := newTestContainerUsage(t, tt.schedulableCPUs, tt.files)
			base := time.Date(2026, 9, 11, 3, 0, 0, 0, time.UTC)
			_, ok := usage.cpuSaturation(base)
			assert.False(t, ok, "首次采样只建立基线")

			writeTestCgroupFile(t, filepath.Join(usage.cgroupRoot, tt.usageFile), tt.usageAfter)
			got, ok := usage.cpuSaturation(base.Add(5 * time.Second))
			require.True(t, ok)
			assert.InDelta(t, tt.want, got, 0.01)
		})
	}
}

func TestContainerCPUSaturationFallsBackWithoutQuota(t *testing.T) {
	tests := []struct {
		name  string
		files map[string]string
	}{
		{name: "cgroup v2 unlimited", files: map[string]string{"cpu.max": "max 100000\n", "cpu.stat": "usage_usec 1000000\n"}},
		{name: "cgroup v1 unlimited", files: map[string]string{"cpu/cpu.cfs_quota_us": "-1\n", "cpu/cpu.cfs_period_us": "100000\n", "cpuacct/cpuacct.usage": "1000\n"}},
		{name: "no cgroup files"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			usage := newTestContainerUsage(t, 4, tt.files)
			base := time.Date(2026, 9, 11, 3, 0, 0, 0, time.UTC)
			usage.cpuSaturation(base)
			_, ok := usage.cpuSaturation(base.Add(5 * time.Second))
			assert.False(t, ok, "没有配额时交由调用方回退宿主机口径")
		})
	}
}

func TestContainerMemoryUsageUsesWorkingSet(t *testing.T) {
	tests := []struct {
		name  string
		files map[string]string
		want  float64
	}{
		{
			name: "cgroup v2 excludes inactive file cache",
			files: map[string]string{
				"memory.current": "266338304\n",
				"memory.max":     "268435456\n",
				"memory.stat":    "anon 4435968\nfile 253362176\ninactive_file 251662336\n",
			},
			want: 5.4672,
		},
		{
			name: "cgroup v2 high working set keeps protection",
			files: map[string]string{
				"memory.current": "255852544\n",
				"memory.max":     "268435456\n",
				"memory.stat":    "anon 254803968\ninactive_file 1048576\n",
			},
			want: 94.9219,
		},
		{
			name: "cgroup v1 uses hierarchical inactive file cache",
			files: map[string]string{
				"memory/memory.usage_in_bytes": "805306368\n",
				"memory/memory.limit_in_bytes": "1610612736\n",
				"memory/memory.stat":           "inactive_file 999\ntotal_inactive_file 268435456\n",
			},
			want: 33.3333,
		},
		{
			name: "cache larger than usage does not underflow",
			files: map[string]string{
				"memory.current": "1000\n",
				"memory.max":     "268435456\n",
				"memory.stat":    "inactive_file 2000\n",
			},
			want: 0,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := newTestContainerUsage(t, 4, tt.files).memoryUsage()
			require.True(t, ok)
			assert.InDelta(t, tt.want, got, 0.001)
		})
	}
}

func TestContainerMemoryUsageFallsBackWhenUnavailable(t *testing.T) {
	limited := map[string]string{"memory.current": "266338304\n", "memory.max": "268435456\n"}
	tests := []struct {
		name  string
		files map[string]string
		stat  string
	}{
		{name: "cgroup v2 unlimited", files: map[string]string{"memory.current": "1000\n", "memory.max": "max\n"}, stat: "inactive_file 0\n"},
		{name: "cgroup v1 unlimited", files: map[string]string{
			"memory/memory.usage_in_bytes": "1000\n",
			"memory/memory.limit_in_bytes": "9223372036854771712\n",
			"memory/memory.stat":           "total_inactive_file 0\n",
		}},
		{name: "memory.stat missing", files: limited},
		{name: "inactive file field missing", files: limited, stat: "anon 4435968\n"},
		{name: "inactive file field corrupt", files: limited, stat: "inactive_file abc\n"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			usage := newTestContainerUsage(t, 4, tt.files)
			if tt.stat != "" {
				writeTestCgroupFile(t, filepath.Join(usage.cgroupRoot, "memory.stat"), tt.stat)
			}
			_, ok := usage.memoryUsage()
			assert.False(t, ok, "拿不到可信工作集时交由调用方回退宿主机口径")
		})
	}
}

func TestSystemOverloadRequiresConsecutiveSamples(t *testing.T) {
	config := PerformanceMonitorConfig{Enabled: true, CPUThreshold: 90, MemoryThreshold: 90, DiskThreshold: 95}
	now := time.Date(2026, 9, 11, 3, 0, 0, 0, time.UTC)
	cpuSamples := []struct {
		usage        float64
		wantOverload bool
	}{
		{usage: 95, wantOverload: false},
		{usage: 95, wantOverload: false},
		{usage: 95, wantOverload: true},
		{usage: 95, wantOverload: true},
		{usage: 50, wantOverload: false}, // 回落即恢复
		{usage: 95, wantOverload: false}, // 重新累计
		{usage: 95, wantOverload: false},
		{usage: 95, wantOverload: true},
	}

	var detector overloadDetector
	for i, sample := range cpuSamples {
		status := SystemStatus{CPUUsage: sample.usage, SampledAt: now}
		detector.mark(&status, config)
		overload := CheckSystemOverload(status, config, now)
		if !sample.wantOverload {
			assert.Nil(t, overload, "sample %d", i+1)
			continue
		}
		require.NotNil(t, overload, "sample %d", i+1)
		assert.Equal(t, "system_cpu_overloaded", overload.Code)
	}
}

func TestCheckSystemOverload(t *testing.T) {
	now := time.Date(2026, 9, 11, 3, 0, 0, 0, time.UTC)
	enabled := PerformanceMonitorConfig{Enabled: true, CPUThreshold: 90, MemoryThreshold: 90, DiskThreshold: 95}
	cpuOverloaded := SystemStatus{CPUUsage: 99.5, CPUOverloaded: true, SampledAt: now}
	tests := []struct {
		name        string
		status      SystemStatus
		config      PerformanceMonitorConfig
		wantCode    string
		wantMessage string
	}{
		{
			name:        "fresh cpu overload",
			status:      cpuOverloaded,
			config:      enabled,
			wantCode:    "system_cpu_overloaded",
			wantMessage: "system cpu overloaded (current: 99.5%, threshold: 90%)",
		},
		{
			name:        "fresh memory overload",
			status:      SystemStatus{MemoryUsage: 96.2, MemoryOverloaded: true, SampledAt: now},
			config:      enabled,
			wantCode:    "system_memory_overloaded",
			wantMessage: "system memory overloaded (current: 96.2%, threshold: 90%)",
		},
		{
			name:        "fresh disk overload",
			status:      SystemStatus{DiskUsage: 97, DiskOverloaded: true, SampledAt: now},
			config:      enabled,
			wantCode:    "system_disk_overloaded",
			wantMessage: "system disk overloaded (current: 97.0%, threshold: 95%)",
		},
		{
			name:        "lowered threshold reports the active threshold",
			status:      cpuOverloaded,
			config:      PerformanceMonitorConfig{Enabled: true, CPUThreshold: 80},
			wantCode:    "system_cpu_overloaded",
			wantMessage: "system cpu overloaded (current: 99.5%, threshold: 80%)",
		},
		{name: "monitor disabled", status: cpuOverloaded, config: PerformanceMonitorConfig{Enabled: false, CPUThreshold: 90}},
		{name: "cpu threshold disabled at runtime", status: cpuOverloaded, config: PerformanceMonitorConfig{Enabled: true, CPUThreshold: 0}},
		{name: "cpu threshold raised above usage", status: cpuOverloaded, config: PerformanceMonitorConfig{Enabled: true, CPUThreshold: 100}},
		{name: "stale sample", status: SystemStatus{CPUUsage: 99.5, CPUOverloaded: true, SampledAt: now.Add(-31 * time.Second)}, config: enabled},
		{name: "missing sample", status: SystemStatus{CPUUsage: 99.5, CPUOverloaded: true}, config: enabled},
		{name: "usage above threshold without consecutive samples", status: SystemStatus{CPUUsage: 99.5, SampledAt: now}, config: enabled},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			overload := CheckSystemOverload(tt.status, tt.config, now)
			if tt.wantCode == "" {
				assert.Nil(t, overload)
				return
			}
			require.NotNil(t, overload)
			assert.Equal(t, tt.wantCode, overload.Code)
			assert.Equal(t, tt.wantMessage, overload.Error())
		})
	}
}
