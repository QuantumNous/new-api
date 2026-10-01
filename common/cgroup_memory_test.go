package common

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReadCgroupMemoryUsagePrefersV2(t *testing.T) {
	files := map[string]string{
		cgroupV2MemoryCurrentPath: "256",
		cgroupV2MemoryMaxPath:     "1024",
		cgroupV1MemoryUsagePath:   "900",
		cgroupV1MemoryLimitPath:   "1000",
	}

	usage, ok := readCgroupMemoryUsage(fakeCgroupReader(files))

	require.True(t, ok)
	assert.InDelta(t, 25.0, usage, 0.0001)
}

func TestReadCgroupMemoryUsageFallsBackToV1(t *testing.T) {
	files := map[string]string{
		cgroupV1MemoryUsagePath: "300",
		cgroupV1MemoryLimitPath: "1200",
	}

	usage, ok := readCgroupMemoryUsage(fakeCgroupReader(files))

	require.True(t, ok)
	assert.InDelta(t, 25.0, usage, 0.0001)
}

func TestReadCgroupMemoryUsageFallsBackWhenLimitIsUnlimited(t *testing.T) {
	files := map[string]string{
		cgroupV2MemoryCurrentPath: "256",
		cgroupV2MemoryMaxPath:     "max",
		cgroupV1MemoryUsagePath:   "512",
		cgroupV1MemoryLimitPath:   "9223372036854771712",
	}

	usage, ok := readCgroupMemoryUsage(fakeCgroupReader(files))

	assert.False(t, ok)
	assert.Zero(t, usage)
}

func TestReadCgroupMemoryUsageRejectsInvalidInput(t *testing.T) {
	files := map[string]string{
		cgroupV2MemoryCurrentPath: "not-a-number",
		cgroupV2MemoryMaxPath:     "1024",
	}

	usage, ok := readCgroupMemoryUsage(fakeCgroupReader(files))

	assert.False(t, ok)
	assert.Zero(t, usage)
}

func TestMemoryUsagePercentClampsUsageToLimit(t *testing.T) {
	usage, ok := memoryUsagePercent(1200, 1000)

	require.True(t, ok)
	assert.Equal(t, 100.0, usage)
}

func fakeCgroupReader(files map[string]string) func(string) ([]byte, error) {
	return func(path string) ([]byte, error) {
		value, ok := files[path]
		if !ok {
			return nil, errors.New("file not found")
		}
		return []byte(value), nil
	}
}
