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

	// 计算磁盘空间 (显式转换以兼容 FreeBSD，其字段类型为 int64)
	bsize := uint64(stat.Bsize)
	info.Total = uint64(stat.Blocks) * bsize
	info.Free = uint64(stat.Bavail) * bsize
	info.Used = info.Total - uint64(stat.Bfree)*bsize

	if info.Total > 0 {
		info.UsedPercent = float64(info.Used) / float64(info.Total) * 100
	}

	return info
}
