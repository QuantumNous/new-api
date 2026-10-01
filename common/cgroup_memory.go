package common

import (
	"os"
	"strconv"
	"strings"
)

const (
	cgroupV2MemoryCurrentPath = "/sys/fs/cgroup/memory.current"
	cgroupV2MemoryMaxPath     = "/sys/fs/cgroup/memory.max"
	cgroupV1MemoryUsagePath   = "/sys/fs/cgroup/memory/memory.usage_in_bytes"
	cgroupV1MemoryLimitPath   = "/sys/fs/cgroup/memory/memory.limit_in_bytes"
)

// readContainerMemoryUsage returns the memory usage relative to the container
// limit. The second return value is false when no finite cgroup limit can be
// read, so callers can fall back to a host-level metric.
func readContainerMemoryUsage() (float64, bool) {
	return readCgroupMemoryUsage(os.ReadFile)
}

func readCgroupMemoryUsage(readFile func(string) ([]byte, error)) (float64, bool) {
	if usage, limit, ok := readCgroupMemoryFiles(
		readFile,
		cgroupV2MemoryCurrentPath,
		cgroupV2MemoryMaxPath,
	); ok {
		return memoryUsagePercent(usage, limit)
	}

	if usage, limit, ok := readCgroupMemoryFiles(
		readFile,
		cgroupV1MemoryUsagePath,
		cgroupV1MemoryLimitPath,
	); ok {
		return memoryUsagePercent(usage, limit)
	}

	return 0, false
}

func readCgroupMemoryFiles(
	readFile func(string) ([]byte, error),
	usagePath string,
	limitPath string,
) (uint64, uint64, bool) {
	usageData, err := readFile(usagePath)
	if err != nil {
		return 0, 0, false
	}
	limitData, err := readFile(limitPath)
	if err != nil {
		return 0, 0, false
	}

	usage, ok := parseCgroupUint(usageData)
	if !ok {
		return 0, 0, false
	}
	limitText := strings.TrimSpace(string(limitData))
	if isUnlimitedCgroupLimit(limitText) {
		return 0, 0, false
	}
	limit, ok := parseCgroupUint([]byte(limitText))
	if !ok || limit == 0 {
		return 0, 0, false
	}

	return usage, limit, true
}

func parseCgroupUint(data []byte) (uint64, bool) {
	value, err := strconv.ParseUint(strings.TrimSpace(string(data)), 10, 64)
	return value, err == nil
}

func isUnlimitedCgroupLimit(value string) bool {
	if value == "max" {
		return true
	}

	// cgroup v1 uses a very large value as its unlimited sentinel. Treat the
	// upper range as unlimited instead of allowing a meaningless tiny percent.
	limit, err := strconv.ParseUint(value, 10, 64)
	return err == nil && limit >= 1<<60
}

func memoryUsagePercent(usage, limit uint64) (float64, bool) {
	if limit == 0 {
		return 0, false
	}
	if usage > limit {
		usage = limit
	}
	return float64(usage) / float64(limit) * 100, true
}
