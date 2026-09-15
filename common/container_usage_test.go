package common

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func writeCgroupFile(t *testing.T, path, content string) {
	t.Helper()
	require.NoError(t, os.WriteFile(path, []byte(content), 0o600))
}

// isolateCgroupPaths 把 cgroup 路径指向临时目录，避免依赖运行环境。
func isolateCgroupPaths(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	origin := struct {
		v2CPUMax, v2CPUStat, v2MemMax, v2MemCur        string
		v1Quota, v1Period, v1Usage, v1MemMax, v1MemCur string
	}{
		cgroupV2CPUMaxPath, cgroupV2CPUStatPath, cgroupV2MemoryMaxPath, cgroupV2MemoryCurPath,
		cgroupV1CPUQuotaPath, cgroupV1CPUPeriodPath, cgroupV1CPUUsagePath, cgroupV1MemoryMaxPath, cgroupV1MemoryCurPath,
	}
	t.Cleanup(func() {
		cgroupV2CPUMaxPath, cgroupV2CPUStatPath = origin.v2CPUMax, origin.v2CPUStat
		cgroupV2MemoryMaxPath, cgroupV2MemoryCurPath = origin.v2MemMax, origin.v2MemCur
		cgroupV1CPUQuotaPath, cgroupV1CPUPeriodPath = origin.v1Quota, origin.v1Period
		cgroupV1CPUUsagePath = origin.v1Usage
		cgroupV1MemoryMaxPath, cgroupV1MemoryCurPath = origin.v1MemMax, origin.v1MemCur
	})

	cgroupV2CPUMaxPath = filepath.Join(dir, "cpu.max")
	cgroupV2CPUStatPath = filepath.Join(dir, "cpu.stat")
	cgroupV2MemoryMaxPath = filepath.Join(dir, "memory.max")
	cgroupV2MemoryCurPath = filepath.Join(dir, "memory.current")
	cgroupV1CPUQuotaPath = filepath.Join(dir, "cpu.cfs_quota_us")
	cgroupV1CPUPeriodPath = filepath.Join(dir, "cpu.cfs_period_us")
	cgroupV1CPUUsagePath = filepath.Join(dir, "cpuacct.usage")
	cgroupV1MemoryMaxPath = filepath.Join(dir, "memory.limit_in_bytes")
	cgroupV1MemoryCurPath = filepath.Join(dir, "memory.usage_in_bytes")
	return dir
}

func TestCPUSaturationUsesContainerQuota(t *testing.T) {
	dir := isolateCgroupPaths(t)
	writeCgroupFile(t, filepath.Join(dir, "cpu.max"), "200000 100000\n")
	writeCgroupFile(t, filepath.Join(dir, "cpu.stat"), "usage_usec 1000000\nuser_usec 900000\n")

	usage := NewContainerUsage()
	base := time.Date(2026, 9, 11, 3, 0, 0, 0, time.UTC)
	_, ok := usage.CPUSaturation(base)
	assert.False(t, ok, "首次采样只建立基线，不产出使用率")

	// 5 秒内消耗 10 秒 CPU，配额 2 核 => 自身使用 2 核 => 100%。
	writeCgroupFile(t, filepath.Join(dir, "cpu.stat"), "usage_usec 11000000\n")
	got, ok := usage.CPUSaturation(base.Add(5 * time.Second))
	require.True(t, ok, "容器 cgroup 可用时必须返回自身占用")
	assert.InDelta(t, 100, got, 1)
}

func TestCPUSaturationFallsBackWhenQuotaMissing(t *testing.T) {
	dir := isolateCgroupPaths(t)
	writeCgroupFile(t, filepath.Join(dir, "cpu.max"), "max 100000\n")
	writeCgroupFile(t, filepath.Join(dir, "cpu.stat"), "usage_usec 1000000\n")

	usage := NewContainerUsage()
	_, ok := usage.CPUSaturation(time.Now())
	assert.False(t, ok, "未设置配额时不给出容器口径，交由调用方回退")
}

func TestCPUSaturationSupportsCgroupV1(t *testing.T) {
	dir := isolateCgroupPaths(t)
	// 不创建 cgroup v2 文件，读取失败后应回退到 cgroup v1 路径。
	writeCgroupFile(t, filepath.Join(dir, "cpu.cfs_quota_us"), "200000\n")
	writeCgroupFile(t, filepath.Join(dir, "cpu.cfs_period_us"), "100000\n")
	// cpuacct.usage 为纳秒口径：起始 1s CPU。
	writeCgroupFile(t, filepath.Join(dir, "cpuacct.usage"), "1000000000\n")

	usage := NewContainerUsage()
	base := time.Date(2026, 9, 11, 3, 0, 0, 0, time.UTC)
	_, ok := usage.CPUSaturation(base)
	assert.False(t, ok)

	writeCgroupFile(t, filepath.Join(dir, "cpuacct.usage"), "11000000000\n")
	got, ok := usage.CPUSaturation(base.Add(5 * time.Second))
	require.True(t, ok, "cgroup v1 也应支持容器口径")
	assert.InDelta(t, 100, got, 1)
}

func TestMemoryUsageUsesContainerLimit(t *testing.T) {
	dir := isolateCgroupPaths(t)
	writeCgroupFile(t, filepath.Join(dir, "memory.current"), "805306368\n") // 768MiB
	writeCgroupFile(t, filepath.Join(dir, "memory.max"), "1610612736\n")    // 1.5GiB

	usage := NewContainerUsage()
	got, ok := usage.MemoryUsage()
	require.True(t, ok, "容器内存上限可读时必须返回自身占用")
	assert.InDelta(t, 50, got, 0.1)
}

func TestMemoryUsageFallsBackWhenUnlimited(t *testing.T) {
	dir := isolateCgroupPaths(t)
	writeCgroupFile(t, filepath.Join(dir, "memory.usage_in_bytes"), "1000\n")
	writeCgroupFile(t, filepath.Join(dir, "memory.limit_in_bytes"), "9223372036854771712\n")

	usage := NewContainerUsage()
	_, ok := usage.MemoryUsage()
	assert.False(t, ok, "内存未限制时不给出容器口径")
}

func TestOverloadStreakResetsOnHealthySample(t *testing.T) {
	streak := 0
	streak = nextOverloadStreak(streak, true)
	streak = nextOverloadStreak(streak, true)
	assert.Equal(t, 2, streak)
	assert.Equal(t, 0, nextOverloadStreak(streak, false), "健康采样必须清零连续计数")
}

func TestSystemStatusFreshness(t *testing.T) {
	assert.False(t, IsSystemStatusFresh(SystemStatus{}), "零值状态不算新鲜")
	assert.False(t, IsSystemStatusFresh(SystemStatus{SampledAt: time.Now().Add(-time.Minute)}), "过期采样不算新鲜")
	assert.True(t, IsSystemStatusFresh(SystemStatus{SampledAt: time.Now()}), "刚采样的状态应可用")
}
