package common

import (
	"os"
	"path/filepath"
	"runtime"
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

const (
	defaultCgroupRoot = "/sys/fs/cgroup"
	// cgroup v1 用接近 int64 上限的值表示"未限制"。
	unlimitedMemoryBytes = uint64(1) << 60
)

// containerUsage 记录上一次采样点，用来计算区间内的 CPU 占用。
type containerUsage struct {
	cgroupRoot string
	// schedulableCPUs 是本进程可调度的逻辑 CPU 数（Linux 上含 cpuset/affinity 限制）。
	schedulableCPUs float64
	cpuLastUsec     uint64
	cpuLastSampled  time.Time
}

func newContainerUsage() *containerUsage {
	// runtime.NumCPU 在 Linux 上于进程启动时按 sched_getaffinity 计数，不受 GOMAXPROCS 影响。
	return &containerUsage{cgroupRoot: defaultCgroupRoot, schedulableCPUs: float64(runtime.NumCPU())}
}

// cpuSaturation 返回相对容器可用 CPU 的使用率（百分比）。
// 可用 CPU 取 cgroup 配额与可调度 CPU 的较小者：配额大于 cpuset 或节点核数时，
// 按配额计算会让容器打满也无法触发保护。
// ok=false 表示当前环境没有可用的 cgroup CPU 数据，调用方应回退到宿主机口径。
func (u *containerUsage) cpuSaturation(now time.Time) (float64, bool) {
	limitCores, ok := u.readCgroupCPUQuotaCores()
	if !ok {
		return 0, false
	}
	if u.schedulableCPUs > 0 {
		limitCores = min(limitCores, u.schedulableCPUs)
	}
	usageUsec, ok := u.readCgroupCPUUsageUsec()
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
	return usedCores / limitCores * 100, true
}

// memoryUsage 返回容器内存工作集相对上限的使用率（百分比）。
// 工作集 = 用量 - 非活跃文件缓存，与 docker stats、kubelet 一致：用量包含可回收的
// 页缓存，写日志或文件后会长期贴近上限，不代表内存压力。
// ok=false 时调用方回退宿主机口径（同样不含缓存）：内存未限制、文件不可读、
// 或 memory.stat 缺少非活跃缓存字段。宁可回退旧口径，也不把含缓存的用量当作压力。
func (u *containerUsage) memoryUsage() (float64, bool) {
	usagePath := filepath.Join(u.cgroupRoot, "memory.current")
	limitPath := filepath.Join(u.cgroupRoot, "memory.max")
	statPath := filepath.Join(u.cgroupRoot, "memory.stat")
	inactiveFileKey := "inactive_file"
	if _, err := os.Stat(usagePath); err != nil {
		v1Dir := filepath.Join(u.cgroupRoot, "memory")
		usagePath = filepath.Join(v1Dir, "memory.usage_in_bytes")
		limitPath = filepath.Join(v1Dir, "memory.limit_in_bytes")
		statPath = filepath.Join(v1Dir, "memory.stat")
		inactiveFileKey = "total_inactive_file"
	}

	// cgroup v2 未限制时 memory.max 为 "max"，解析失败即视为不可用。
	limit, ok := readCgroupUint(limitPath)
	if !ok || limit == 0 || limit >= unlimitedMemoryBytes {
		return 0, false
	}
	usage, ok := readCgroupUint(usagePath)
	if !ok {
		return 0, false
	}
	inactiveFile, ok := readCgroupStatValue(statPath, inactiveFileKey)
	if !ok {
		return 0, false
	}
	// 用量与 memory.stat 不是同一时刻的快照，缓存可能短暂大于用量，按 0 处理防止下溢。
	workingSet := usage - min(inactiveFile, usage)
	return float64(workingSet) / float64(limit) * 100, true
}

// readCgroupCPUQuotaCores 返回 cgroup CPU 配额（核）。ok=false 表示未限制或不可读。
func (u *containerUsage) readCgroupCPUQuotaCores() (float64, bool) {
	if raw, err := os.ReadFile(filepath.Join(u.cgroupRoot, "cpu.max")); err == nil {
		quotaText, periodText, found := strings.Cut(strings.TrimSpace(string(raw)), " ")
		if !found || quotaText == "max" {
			return 0, false
		}
		quota, err := strconv.ParseUint(quotaText, 10, 64)
		if err != nil || quota == 0 {
			return 0, false
		}
		period, err := strconv.ParseUint(strings.TrimSpace(periodText), 10, 64)
		if err != nil || period == 0 {
			return 0, false
		}
		return float64(quota) / float64(period), true
	}

	// cgroup v1 未限制时 cfs_quota_us 为 -1，解析失败即视为不可用。
	v1Dir := filepath.Join(u.cgroupRoot, "cpu")
	quota, ok := readCgroupUint(filepath.Join(v1Dir, "cpu.cfs_quota_us"))
	if !ok || quota == 0 {
		return 0, false
	}
	period, ok := readCgroupUint(filepath.Join(v1Dir, "cpu.cfs_period_us"))
	if !ok || period == 0 {
		return 0, false
	}
	return float64(quota) / float64(period), true
}

func (u *containerUsage) readCgroupCPUUsageUsec() (uint64, bool) {
	statPath := filepath.Join(u.cgroupRoot, "cpu.stat")
	if _, err := os.Stat(statPath); err == nil {
		return readCgroupStatValue(statPath, "usage_usec")
	}
	// cgroup v1 的 cpuacct.usage 单位是纳秒。
	nanos, ok := readCgroupUint(filepath.Join(u.cgroupRoot, "cpuacct", "cpuacct.usage"))
	return nanos / 1000, ok
}

// readCgroupUint 读取只含一个无符号整数的 cgroup 文件。
func readCgroupUint(path string) (uint64, bool) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return 0, false
	}
	value, err := strconv.ParseUint(strings.TrimSpace(string(raw)), 10, 64)
	return value, err == nil
}

// readCgroupStatValue 从 "key value" 逐行格式的 cgroup 统计文件（cpu.stat、memory.stat）中读取一项。
func readCgroupStatValue(path string, key string) (uint64, bool) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return 0, false
	}
	for line := range strings.SplitSeq(string(raw), "\n") {
		name, valueText, found := strings.Cut(line, " ")
		if !found || name != key {
			continue
		}
		value, err := strconv.ParseUint(strings.TrimSpace(valueText), 10, 64)
		return value, err == nil
	}
	return 0, false
}
