//go:build !windows

package controller

import (
	"os"

	"github.com/QuantumNous/new-api/common"
	"golang.org/x/sys/unix"
)

// getDiskSpaceInfo 获取缓存目录所在磁盘的空间信息 (Unix/Linux/macOS)
func getDiskSpaceInfo() DiskSpaceInfo {
	cachePath := common.GetDiskCachePath()
	if cachePath == "" {
		cachePath = os.TempDir()
	}

	info := DiskSpaceInfo{}

	var stat unix.Statfs_t
	err := unix.Statfs(cachePath, &stat)
	if err != nil {
		return info
	}

	// 计算磁盘空间
	info.Total = stat.Blocks * uint64(stat.Bsize)
	info.Free = stat.Bavail * uint64(stat.Bsize)
	info.Used = info.Total - stat.Bfree*uint64(stat.Bsize)

	if info.Total > 0 {
		info.UsedPercent = float64(info.Used) / float64(info.Total) * 100
	}

	return info
}
