package common

import (
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

// Container's own resource sampling.
//
// The historical implementation directly reads the host's caliber (/proc/stat and /proc/meminfo), and puts other files on the same node
// The occupation of the workload can also be considered as cost process overload, causing normal relay traffic to be cut off by 503. here
// Instead, read the cgroup quota and usage of the current container first, and only use it when the cgroup data cannot be obtained.
// The caller falls back to the host caliber.

const (
	defaultCgroupRoot = "/sys/fs/cgroup"
	// cgroup v1 represents "unlimited" with a value close to the int64 upper limit.
	unlimitedMemoryBytes = uint64(1) << 60
)

// containerUsage records the last sampling point and is used to calculate the CPU usage within the interval.
type containerUsage struct {
	cgroupRoot string
	// schedulableCPUs is the number of logical CPUs that can be scheduled by this process (including cpuset/affinity restrictions on Linux).
	schedulableCPUs float64
	cpuLastUsec     uint64
	cpuLastSampled  time.Time
}

func newContainerUsage() *containerUsage {
	// runtime.NumCPU is counted by sched_getaffinity on process startup on Linux and is not affected by GOMAXPROCS.
	return &containerUsage{cgroupRoot: defaultCgroupRoot, schedulableCPUs: float64(runtime.NumCPU())}
}

// cpuSaturation Returns the usage (percentage) relative to the container's available CPU.
// The available CPU is the smaller of the cgroup quota and the schedulable CPU: when the quota is greater than the cpuset or the number of node cores,
// Calculation based on quota will make the container full and protection will not be triggered.
// ok=false means that there is no cgroup CPU data available in the current environment, and the caller should fall back to the host caliber.
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

// memoryUsage returns the usage (percentage) of the container's memory working set relative to the upper limit.
// Working set = usage - inactive file cache, consistent with docker stats, kubelet: usage includes recyclable
// The page cache will be close to the upper limit for a long time after writing logs or files, which does not represent memory pressure.
// When ok=false, the caller falls back to the host caliber (also without cache): memory is not limited, the file is unreadable,
// Or memory.stat is missing an inactive cache field. It is better to fall back to the old caliber than to put the cache usage as a pressure.
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

	// When cgroup v2 is not limited, memory.max is "max", and failure to resolve is considered unavailable.
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
	// The usage and memory.stat are not snapshots at the same time. The cache may be temporarily larger than the usage, so treat it as 0 to prevent underflow.
	workingSet := usage - min(inactiveFile, usage)
	return float64(workingSet) / float64(limit) * 100, true
}

// readCgroupCPUQuotaCores returns cgroup CPU quotas (cores). ok=false means unrestricted or unreadable.
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

	// When cgroup v1 is not restricted, cfs_quota_us is -1, and failure to resolve is considered unavailable.
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
	// The unit of cpuacct.usage for cgroup v1 is nanoseconds.
	nanos, ok := readCgroupUint(filepath.Join(u.cgroupRoot, "cpuacct", "cpuacct.usage"))
	return nanos / 1000, ok
}

// readCgroupUint reads a cgroup file containing only an unsigned integer.
func readCgroupUint(path string) (uint64, bool) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return 0, false
	}
	value, err := strconv.ParseUint(strings.TrimSpace(string(raw)), 10, 64)
	return value, err == nil
}

// readCgroupStatValue reads an entry from the cgroup statistics files (cpu.stat, memory.stat) in "key value" line-by-line format.
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
