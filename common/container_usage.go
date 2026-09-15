package common

import (
	"os"
	"strconv"
	"strings"
	"time"
)

// 容器自身资源采样。
//
// 历史实现直接读取宿主机口径（/proc/stat 与 /proc/meminfo），把同节点其它
// 工作负载的占用也算成本进程过载，导致正常的 relay 流量被 503 熔断。这里
// 改为优先读取当前容器的 cgroup 配额与用量，只有在拿不到 cgroup 数据时才由
// 调用方回退到宿主机口径。

// 路径变量而不是常量，便于测试注入临时目录。
var (
	cgroupV2CPUMaxPath    = "/sys/fs/cgroup/cpu.max"
	cgroupV2CPUStatPath   = "/sys/fs/cgroup/cpu.stat"
	cgroupV2MemoryMaxPath = "/sys/fs/cgroup/memory.max"
	cgroupV2MemoryCurPath = "/sys/fs/cgroup/memory.current"

	cgroupV1CPUQuotaPath  = "/sys/fs/cgroup/cpu/cpu.cfs_quota_us"
	cgroupV1CPUPeriodPath = "/sys/fs/cgroup/cpu/cpu.cfs_period_us"
	cgroupV1CPUUsagePath  = "/sys/fs/cgroup/cpuacct/cpuacct.usage"
	cgroupV1MemoryMaxPath = "/sys/fs/cgroup/memory/memory.limit_in_bytes"
	cgroupV1MemoryCurPath = "/sys/fs/cgroup/memory/memory.usage_in_bytes"

	// cgroup v1 用接近 int64 上限的值表示"未限制"。
	unlimitedMemoryBytes = uint64(1) << 60
)

// ContainerUsage 记录上一次采样点，用来计算区间内的 CPU 占用。
type ContainerUsage struct {
	cpuLastUsec    uint64
	cpuLastSampled time.Time
}

func NewContainerUsage() *ContainerUsage {
	return &ContainerUsage{}
}

// CPUSaturation 返回相对容器 CPU 配额的使用率（百分比）。
// ok=false 表示当前环境没有可用的 cgroup CPU 数据，调用方应回退到宿主机口径。
func (u *ContainerUsage) CPUSaturation(now time.Time) (float64, bool) {
	quotaCores, ok := readCgroupCPULimitCores()
	if !ok || quotaCores <= 0 {
		return 0, false
	}
	usageUsec, ok := readCgroupCPUUsageUsec()
	if !ok {
		return 0, false
	}
	if u.cpuLastSampled.IsZero() || usageUsec < u.cpuLastUsec || !now.After(u.cpuLastSampled) {
		u.cpuLastUsec = usageUsec
		u.cpuLastSampled = now
		return 0, false
	}
	elapsed := now.Sub(u.cpuLastSampled)
	if elapsed < time.Second {
		return 0, false
	}
	deltaUsec := usageUsec - u.cpuLastUsec
	u.cpuLastUsec = usageUsec
	u.cpuLastSampled = now

	usedCores := float64(deltaUsec) / 1e6 / elapsed.Seconds()
	return usedCores / quotaCores * 100, true
}

// MemoryUsage 返回相对容器内存上限的使用率（百分比）。
// ok=false 表示没有可用的 cgroup 内存上限，调用方应回退到宿主机口径。
func (u *ContainerUsage) MemoryUsage() (float64, bool) {
	used, limit, ok := readCgroupMemory()
	if !ok || limit == 0 {
		return 0, false
	}
	return float64(used) / float64(limit) * 100, true
}

// CPULimitCores 返回当前容器的 CPU 配额（核）。ok=false 表示未限制或不可读。
func (u *ContainerUsage) CPULimitCores() (float64, bool) {
	return readCgroupCPULimitCores()
}

func readCgroupCPULimitCores() (float64, bool) {
	if raw, err := os.ReadFile(cgroupV2CPUMaxPath); err == nil {
		fields := strings.Fields(string(raw))
		if len(fields) < 2 {
			return 0, false
		}
		if strings.EqualFold(fields[0], "max") {
			return 0, false
		}
		quota, err := strconv.ParseFloat(fields[0], 64)
		if err != nil || quota <= 0 {
			return 0, false
		}
		period, err := strconv.ParseFloat(fields[1], 64)
		if err != nil || period <= 0 {
			return 0, false
		}
		return quota / period, true
	}

	quotaRaw, err := os.ReadFile(cgroupV1CPUQuotaPath)
	if err != nil {
		return 0, false
	}
	periodRaw, err := os.ReadFile(cgroupV1CPUPeriodPath)
	if err != nil {
		return 0, false
	}
	quota, err := strconv.ParseFloat(strings.TrimSpace(string(quotaRaw)), 64)
	if err != nil || quota <= 0 {
		return 0, false
	}
	period, err := strconv.ParseFloat(strings.TrimSpace(string(periodRaw)), 64)
	if err != nil || period <= 0 {
		return 0, false
	}
	return quota / period, true
}

func readCgroupCPUUsageUsec() (uint64, bool) {
	if raw, err := os.ReadFile(cgroupV2CPUStatPath); err == nil {
		for _, line := range strings.Split(string(raw), "\n") {
			fields := strings.Fields(line)
			if len(fields) != 2 || fields[0] != "usage_usec" {
				continue
			}
			value, err := strconv.ParseUint(fields[1], 10, 64)
			if err != nil {
				return 0, false
			}
			return value, true
		}
		return 0, false
	}

	// cgroup v1 的 cpuacct.usage 单位是纳秒。
	raw, err := os.ReadFile(cgroupV1CPUUsagePath)
	if err != nil {
		return 0, false
	}
	nanos, err := strconv.ParseUint(strings.TrimSpace(string(raw)), 10, 64)
	if err != nil {
		return 0, false
	}
	return nanos / 1000, true
}

func readCgroupMemory() (used uint64, limit uint64, ok bool) {
	if curRaw, err := os.ReadFile(cgroupV2MemoryCurPath); err == nil {
		maxRaw, err := os.ReadFile(cgroupV2MemoryMaxPath)
		if err != nil {
			return 0, 0, false
		}
		limitText := strings.TrimSpace(string(maxRaw))
		if strings.EqualFold(limitText, "max") {
			return 0, 0, false
		}
		limitValue, err := strconv.ParseUint(limitText, 10, 64)
		if err != nil || limitValue == 0 {
			return 0, 0, false
		}
		usedValue, err := strconv.ParseUint(strings.TrimSpace(string(curRaw)), 10, 64)
		if err != nil {
			return 0, 0, false
		}
		return usedValue, limitValue, true
	}

	curRaw, err := os.ReadFile(cgroupV1MemoryCurPath)
	if err != nil {
		return 0, 0, false
	}
	maxRaw, err := os.ReadFile(cgroupV1MemoryMaxPath)
	if err != nil {
		return 0, 0, false
	}
	limitValue, err := strconv.ParseUint(strings.TrimSpace(string(maxRaw)), 10, 64)
	if err != nil || limitValue == 0 || limitValue >= unlimitedMemoryBytes {
		return 0, 0, false
	}
	usedValue, err := strconv.ParseUint(strings.TrimSpace(string(curRaw)), 10, 64)
	if err != nil {
		return 0, 0, false
	}
	return usedValue, limitValue, true
}
