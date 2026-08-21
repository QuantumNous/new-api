package selfupdate

import (
	"errors"
	"fmt"
	"io"
	"os"
)

func readRegularComposeFile(filePath string) (os.FileInfo, []byte, error) {
	if err := rejectSymlinkPathComponents(filePath); err != nil {
		return nil, nil, err
	}

	file, err := openComposeFileNoFollow(filePath)
	if err != nil {
		return nil, nil, fmt.Errorf("compose sync: open compose file: %w", err)
	}
	defer func() {
		if file != nil {
			_ = file.Close()
		}
	}()

	info, err := file.Stat()
	if err != nil {
		return nil, nil, fmt.Errorf("compose sync: inspect compose file: %w", err)
	}
	if !info.Mode().IsRegular() {
		return nil, nil, errors.New("compose sync: compose file must be a regular non-symlink file")
	}
	if info.Size() < 0 || info.Size() > maxComposeFileSize {
		return nil, nil, fmt.Errorf("compose sync: compose file exceeds %d byte limit", maxComposeFileSize)
	}

	content, err := io.ReadAll(io.LimitReader(file, maxComposeFileSize+1))
	if err != nil {
		return nil, nil, fmt.Errorf("compose sync: read compose file: %w", err)
	}
	if len(content) > maxComposeFileSize {
		return nil, nil, fmt.Errorf("compose sync: compose file exceeds %d byte limit", maxComposeFileSize)
	}
	return info, content, nil
}
