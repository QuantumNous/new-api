package selfupdate

import (
	"bufio"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// lookupExecutable is os.Executable; overridable in tests.
var lookupExecutable = os.Executable

// SelectBinaryAsset picks the binary asset and optional checksum asset for the
// given GOOS/GOARCH from a release asset list.
//
// Asset naming rules (QuantumNous/new-api releases):
//   - windows/amd64: name ends with ".exe" or contains "windows"
//   - darwin/*:      contains "macos" or "darwin"
//   - linux/arm64:   contains "arm64"
//   - linux/amd64:   matches "new-api-v*" without arm64/macos/windows/.exe,
//     OR contains "linux" and not arm64
//
// Checksum file: prefer "checksums-{goos}.txt"; also accept "checksums.txt".
// If a checksum asset exists for this platform, it is required; if none at all
// exists, checksum is nil.  Callers that receive a nil checksum asset should
// note that verification is skipped; ApplyBinaryUpdate treats it as an error.
func SelectBinaryAsset(assets []Asset, goos, goarch string) (binary *Asset, checksum *Asset, err error) {
	for i := range assets {
		a := &assets[i]
		name := a.Name
		lower := strings.ToLower(name)

		// Skip non-binary assets (checksum files, text files, etc.).
		if strings.HasSuffix(lower, ".txt") || strings.HasSuffix(lower, ".md") {
			continue
		}

		switch goos {
		case "windows":
			if strings.HasSuffix(lower, ".exe") || strings.Contains(lower, "windows") {
				binary = a
			}
		case "darwin":
			if strings.Contains(lower, "macos") || strings.Contains(lower, "darwin") {
				binary = a
			}
		case "linux":
			if goarch == "arm64" {
				if strings.Contains(lower, "arm64") {
					binary = a
				}
			} else {
				// amd64: must not contain arm64/macos/darwin/windows/.exe
				if strings.Contains(lower, "arm64") ||
					strings.Contains(lower, "macos") ||
					strings.Contains(lower, "darwin") ||
					strings.Contains(lower, "windows") ||
					strings.HasSuffix(lower, ".exe") {
					continue
				}
				// Match "new-api-v*" pattern or name containing "linux"
				if strings.HasPrefix(lower, "new-api-v") || strings.Contains(lower, "linux") {
					binary = a
				}
			}
		}
	}

	// Collect checksum candidates.
	platformKey := map[string]string{
		"linux":   "checksums-linux.txt",
		"darwin":  "checksums-macos.txt",
		"windows": "checksums-windows.txt",
	}
	preferredName := platformKey[goos]
	var platformSum, genericSum *Asset
	for i := range assets {
		a := &assets[i]
		lower := strings.ToLower(a.Name)
		if preferredName != "" && lower == preferredName {
			platformSum = a
		} else if lower == "checksums.txt" {
			genericSum = a
		}
	}
	if platformSum != nil {
		checksum = platformSum
	} else if genericSum != nil {
		checksum = genericSum
	}

	if binary == nil {
		return nil, nil, fmt.Errorf("no binary asset found for %s/%s", goos, goarch)
	}
	return binary, checksum, nil
}

// ParseChecksumFile scans a sha256sum-style checksum file for fileName and
// returns the expected hex digest.  Format: "hex  filename\n".
func ParseChecksumFile(data []byte, fileName string) (wantHex string, err error) {
	scanner := bufio.NewScanner(bytes.NewReader(data))
	for scanner.Scan() {
		line := scanner.Text()
		// Allow one or two spaces between hash and name.
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		hash := fields[0]
		name := fields[len(fields)-1]
		if name == fileName {
			return hash, nil
		}
	}
	if err := scanner.Err(); err != nil {
		return "", err
	}
	return "", fmt.Errorf("checksum not found for %q in checksum file", fileName)
}

// ApplyBinaryUpdate downloads, verifies, and atomically replaces the running
// binary with the new release binary.
//
// Steps:
//  1. Resolve the running executable path (via lookupExecutable + EvalSymlinks)
//  2. Create a temp dir under the exe's directory
//  3. Download binary + checksum assets into temp dir
//  4. Verify SHA-256 hash
//  5. chmod 0755 (Unix)
//  6. Backup current exe → <exe>.backup; rename new → exe; restore on failure
func ApplyBinaryUpdate(ctx context.Context, client GitHubClient, rel *ReleaseInfo, goos, goarch string) error {
	binAsset, sumAsset, err := SelectBinaryAsset(rel.Assets, goos, goarch)
	if err != nil {
		return fmt.Errorf("asset selection: %w", err)
	}
	if sumAsset == nil {
		return fmt.Errorf("no checksum asset found for %s/%s; update rejected", goos, goarch)
	}

	// Resolve running executable.
	exePath, err := lookupExecutable()
	if err != nil {
		return fmt.Errorf("resolve executable: %w", err)
	}
	exePath, err = filepath.EvalSymlinks(exePath)
	if err != nil {
		return fmt.Errorf("eval symlinks: %w", err)
	}
	exeDir := filepath.Dir(exePath)

	// Temp working directory beside the executable.
	tmpDir, err := os.MkdirTemp(exeDir, ".new-api-update-*")
	if err != nil {
		return fmt.Errorf("create temp dir: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	// Download binary.
	newBinPath := filepath.Join(tmpDir, binAsset.Name)
	if err := client.Download(ctx, binAsset.DownloadURL, newBinPath, binAsset.Size+1); err != nil {
		return fmt.Errorf("download binary: %w", err)
	}

	// Fetch checksum file and parse expected hash.
	const maxChecksumSize = 1 << 20 // 1 MiB
	sumData, err := client.FetchBytes(ctx, sumAsset.DownloadURL, maxChecksumSize)
	if err != nil {
		return fmt.Errorf("fetch checksum: %w", err)
	}
	wantHex, err := ParseChecksumFile(sumData, binAsset.Name)
	if err != nil {
		return fmt.Errorf("parse checksum: %w", err)
	}

	// Verify SHA-256.
	f, err := os.Open(newBinPath)
	if err != nil {
		return fmt.Errorf("open downloaded binary: %w", err)
	}
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		f.Close()
		return fmt.Errorf("hash binary: %w", err)
	}
	f.Close()
	gotHex := hex.EncodeToString(h.Sum(nil))
	if !strings.EqualFold(gotHex, wantHex) {
		return fmt.Errorf("checksum mismatch: want %s got %s", wantHex, gotHex)
	}

	// chmod 0755 on Unix.
	if runtime.GOOS != "windows" {
		if err := os.Chmod(newBinPath, 0o755); err != nil {
			return fmt.Errorf("chmod new binary: %w", err)
		}
	}

	// Atomic replace: backup current, move new into place.
	backupPath := exePath + ".backup"
	if err := os.Rename(exePath, backupPath); err != nil {
		return fmt.Errorf("backup current binary: %w", err)
	}
	if err := os.Rename(newBinPath, exePath); err != nil {
		// Restore backup.
		_ = os.Rename(backupPath, exePath)
		return fmt.Errorf("install new binary: %w", err)
	}
	// Remove backup on success (best-effort).
	_ = os.Remove(backupPath)
	return nil
}
