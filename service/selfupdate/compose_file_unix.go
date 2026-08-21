//go:build unix

package selfupdate

import (
	"os"

	"golang.org/x/sys/unix"
)

func openComposeFileNoFollow(filePath string) (*os.File, error) {
	fd, err := unix.Open(filePath, unix.O_RDONLY|unix.O_CLOEXEC|unix.O_NOFOLLOW, 0)
	if err != nil {
		return nil, err
	}
	return os.NewFile(uintptr(fd), filePath), nil
}
