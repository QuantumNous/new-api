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

// SelectBinaryAsset picks a conservatively classified binary asset and optional
// checksum asset for GOOS/GOARCH. Update paths must use
// SelectReleaseBinaryAsset so the selected asset is also bound to its release
// tag and has a safe basename.
func SelectBinaryAsset(assets []Asset, goos, goarch string) (binary *Asset, checksum *Asset, err error) {
	bestRank := -1
	for i := range assets {
		a := &assets[i]
		lower := strings.ToLower(a.Name)

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
			if strings.Contains(lower, "macos") ||
				strings.Contains(lower, "darwin") ||
				strings.Contains(lower, "windows") ||
				strings.HasSuffix(lower, ".exe") {
				continue
			}
			rank, ok := linuxBinaryAssetRank(lower, goarch)
			if ok && rank > bestRank {
				binary = a
				bestRank = rank
			}
		}
	}

	checksum = selectChecksumAsset(assets, goos)
	if binary == nil {
		return nil, nil, fmt.Errorf("no binary asset found for %s/%s", goos, goarch)
	}
	return binary, checksum, nil
}

// SelectReleaseBinaryAsset selects a binary whose filename exactly matches the
// project's supported release naming scheme for TagName. It rejects ambiguous
// candidates rather than letting release asset order decide which executable is
// installed.
func SelectReleaseBinaryAsset(rel *ReleaseInfo, goos, goarch string) (binary *Asset, checksum *Asset, err error) {
	if rel == nil {
		return nil, nil, fmt.Errorf("release information is required")
	}
	if !isSafeReleaseTag(rel.TagName) {
		return nil, nil, fmt.Errorf("release tag is invalid")
	}
	candidates, err := releaseBinaryAssetNames(rel.TagName, goos, goarch)
	if err != nil {
		return nil, nil, err
	}

	for _, candidate := range candidates {
		for i := range rel.Assets {
			a := &rel.Assets[i]
			if a.Name != candidate {
				continue
			}
			if !isSafeAssetBasename(a.Name) {
				return nil, nil, fmt.Errorf("release binary asset name %q is unsafe", a.Name)
			}
			if binary != nil {
				return nil, nil, fmt.Errorf("multiple binary assets match release %q for %s/%s", rel.TagName, goos, goarch)
			}
			binary = a
		}
		if binary != nil {
			break
		}
	}

	checksum = selectChecksumAsset(rel.Assets, goos)
	if binary == nil {
		return nil, checksum, fmt.Errorf("no binary asset found for %s/%s", goos, goarch)
	}
	return binary, checksum, nil
}

func selectChecksumAsset(assets []Asset, goos string) *Asset {
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
		return platformSum
	}
	return genericSum
}

func linuxBinaryAssetRank(name, goarch string) (int, bool) {
	if goarch == "amd64" {
		if tag, ok := releaseTagAfterPrefix(name, "new-api-"); ok && !isExplicitLinuxArchitectureAsset(tag) {
			return 3, true
		}
	}
	for _, alias := range linuxAliasesForGOARCH(goarch) {
		if _, ok := releaseTagAfterPrefix(name, "new-api-"+alias+"-"); ok {
			return 2, true
		}
		if _, ok := releaseTagAfterPrefix(name, "new-api-linux-"+alias+"-"); ok {
			return 2, true
		}
	}
	return 0, false
}

func isExplicitLinuxArchitectureAsset(value string) bool {
	for _, token := range strings.FieldsFunc(value, func(r rune) bool {
		return r == '-' || r == '.' || r == '_'
	}) {
		if linuxArchitectureToken(token) {
			return true
		}
	}
	return false
}

func linuxArchitectureToken(token string) bool {
	switch token {
	case "386", "i386", "i486", "i586", "i686", "x86", "x64", "amd64", "x86_64",
		"arm", "armv5", "armv6", "armv7", "armhf", "arm64", "aarch64", "arm64v8",
		"loong64", "loongarch64", "mips", "mipsle", "mips64", "mips64le", "ppc64",
		"powerpc64", "ppc64le", "powerpc64le", "riscv64", "s390x":
		return true
	}
	return false
}

func releaseBinaryAssetNames(releaseTag, goos, goarch string) ([]string, error) {
	switch goos {
	case "linux":
		return linuxReleaseBinaryNames(releaseTag, goarch), nil
	case "darwin":
		if goarch != "amd64" {
			return nil, fmt.Errorf("no supported release asset naming for %s/%s", goos, goarch)
		}
		return []string{"new-api-macos-" + releaseTag}, nil
	case "windows":
		if goarch != "amd64" {
			return nil, fmt.Errorf("no supported release asset naming for %s/%s", goos, goarch)
		}
		return []string{"new-api-" + releaseTag + ".exe"}, nil
	default:
		return nil, fmt.Errorf("no supported release asset naming for %s/%s", goos, goarch)
	}
}

func linuxReleaseBinaryNames(releaseTag, goarch string) []string {
	var candidates []string
	if goarch == "amd64" {
		candidates = append(candidates, "new-api-"+releaseTag)
	}
	for _, alias := range linuxAliasesForGOARCH(goarch) {
		candidates = append(candidates,
			"new-api-"+alias+"-"+releaseTag,
			"new-api-linux-"+alias+"-"+releaseTag,
		)
	}
	return candidates
}

func isSafeReleaseTag(tag string) bool {
	if tag == "" || len(tag) > 128 || tag != strings.TrimSpace(tag) {
		return false
	}
	if !isASCIIAlphaNumeric(tag[0]) && tag[0] != '_' {
		return false
	}
	for i := 1; i < len(tag); i++ {
		if !isASCIIAlphaNumeric(tag[i]) && tag[i] != '_' && tag[i] != '.' && tag[i] != '-' {
			return false
		}
	}
	return true
}

func isSafeAssetBasename(name string) bool {
	if name == "" || name != filepath.Base(name) || strings.ContainsAny(name, "/\\\x00\r\n") || name == "." || name == ".." {
		return false
	}
	return !strings.HasPrefix(name, "..") && !strings.HasSuffix(name, "..")
}

func releaseTagAfterPrefix(name, prefix string) (string, bool) {
	if !strings.HasPrefix(name, prefix) {
		return "", false
	}
	tag := strings.TrimPrefix(name, prefix)
	return tag, isSafeReleaseTag(tag)
}

func isASCIIAlphaNumeric(value byte) bool {
	return value >= 'a' && value <= 'z' ||
		value >= 'A' && value <= 'Z' ||
		value >= '0' && value <= '9'
}

func linuxAliasesForGOARCH(goarch string) []string {
	switch goarch {
	case "386":
		return []string{"386", "i386", "i486", "i586", "i686", "x86"}
	case "amd64":
		return []string{"amd64", "x86_64", "x86-64", "x64"}
	case "arm":
		return []string{"arm", "armv5", "armv6", "armv7", "armhf"}
	case "arm64":
		return []string{"arm64", "aarch64", "arm64v8"}
	case "loong64":
		return []string{"loong64", "loongarch64"}
	case "mips":
		return []string{"mips"}
	case "mipsle":
		return []string{"mipsle"}
	case "mips64":
		return []string{"mips64"}
	case "mips64le":
		return []string{"mips64le"}
	case "ppc64":
		return []string{"ppc64", "powerpc64"}
	case "ppc64le":
		return []string{"ppc64le", "powerpc64le"}
	case "riscv64":
		return []string{"riscv64"}
	case "s390x":
		return []string{"s390x"}
	default:
		return []string{goarch}
	}
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
	binAsset, sumAsset, err := SelectReleaseBinaryAsset(rel, goos, goarch)
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
