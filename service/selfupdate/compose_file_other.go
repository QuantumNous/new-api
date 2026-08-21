//go:build !unix

package selfupdate

import "os"

func openComposeFileNoFollow(filePath string) (*os.File, error) {
	return os.Open(filePath)
}
