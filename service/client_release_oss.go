package service

import (
	"crypto/sha256"
	"crypto/sha512"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/aliyun/aliyun-oss-go-sdk/oss"
)

const defaultClientReleaseMaxBytes int64 = 500 << 20

type ClientReleaseUploadInput struct {
	Version  string
	Platform string
	Arch     string
	Channel  string
}

type ClientReleaseUploadResult struct {
	FileName string `json:"fileName"`
	Object   string `json:"object"`
	Size     int64  `json:"size"`
	SHA256   string `json:"sha256"`
	SHA512   string `json:"sha512"`
}

type clientReleaseOSSConfig struct {
	Endpoint        string
	Bucket          string
	AccessKeyID     string
	AccessKeySecret string
	Prefix          string
}

var clientReleaseContentTypes = map[string]string{
	".exe":      "application/vnd.microsoft.portable-executable",
	".msi":      "application/x-msi",
	".dmg":      "application/x-apple-diskimage",
	".pkg":      "application/octet-stream",
	".zip":      "application/zip",
	".appimage": "application/octet-stream",
	".deb":      "application/vnd.debian.binary-package",
	".rpm":      "application/x-rpm",
	".yml":      "text/yaml; charset=utf-8",
	".yaml":     "text/yaml; charset=utf-8",
}

func UploadClientReleaseInstaller(file multipart.File, header *multipart.FileHeader, input ClientReleaseUploadInput) (*ClientReleaseUploadResult, error) {
	cfg := loadClientReleaseOSSConfig()
	if err := cfg.validate(); err != nil {
		return nil, err
	}
	if header == nil {
		return nil, errors.New("upload file is required")
	}
	if header.Size <= 0 {
		return nil, errors.New("upload file is empty")
	}
	maxBytes := ClientReleaseMaxBytes()
	if header.Size > maxBytes {
		return nil, fmt.Errorf("client release package must be <= %d MB", maxBytes>>20)
	}
	contentType, err := clientReleaseContentType(header.Filename)
	if err != nil {
		return nil, err
	}
	if err := normalizeClientReleaseUploadInput(&input); err != nil {
		return nil, err
	}
	filename := clientReleaseGeneratedFileName(input, header.Filename)

	client, err := oss.New(cfg.Endpoint, cfg.AccessKeyID, cfg.AccessKeySecret)
	if err != nil {
		return nil, err
	}
	bucket, err := client.Bucket(cfg.Bucket)
	if err != nil {
		return nil, err
	}

	objectKey := cfg.objectKey(input, filename)
	sha256Hasher := sha256.New()
	sha512Hasher := sha512.New()
	reader := io.TeeReader(file, io.MultiWriter(sha256Hasher, sha512Hasher))
	if err := bucket.PutObject(objectKey, reader, oss.ContentType(contentType)); err != nil {
		return nil, err
	}

	return &ClientReleaseUploadResult{
		FileName: filename,
		Object:   objectKey,
		Size:     header.Size,
		SHA256:   "sha256:" + hex.EncodeToString(sha256Hasher.Sum(nil)),
		SHA512:   base64.StdEncoding.EncodeToString(sha512Hasher.Sum(nil)),
	}, nil
}

func SignClientReleaseURL(objectKey string, filename string) (string, error) {
	cfg := loadClientReleaseOSSConfig()
	if err := cfg.validate(); err != nil {
		return "", err
	}
	objectKey = strings.TrimLeft(strings.TrimSpace(objectKey), "/")
	if objectKey == "" {
		return "", errors.New("client release oss object is required")
	}
	client, err := oss.New(cfg.Endpoint, cfg.AccessKeyID, cfg.AccessKeySecret)
	if err != nil {
		return "", err
	}
	bucket, err := client.Bucket(cfg.Bucket)
	if err != nil {
		return "", err
	}
	expires := clientReleaseSignedURLExpires()
	options := []oss.Option{}
	if cleanName := cleanClientReleaseDownloadName(filename); cleanName != "" {
		options = append(options, oss.ResponseContentDisposition(
			fmt.Sprintf("attachment; filename=%q", cleanName),
		))
	}
	return bucket.SignURL(objectKey, oss.HTTPGet, expires, options...)
}

func normalizeClientReleaseUploadInput(input *ClientReleaseUploadInput) error {
	input.Version = model.NormalizeClientReleaseVersion(input.Version)
	if err := model.ValidateClientReleaseVersion(input.Version); err != nil {
		return err
	}
	input.Platform = model.NormalizeClientReleasePlatform(input.Platform)
	input.Arch = model.NormalizeClientReleaseArch(input.Arch)
	input.Channel = model.NormalizeClientReleaseChannel(input.Channel)
	if !model.IsAllowedClientReleasePlatform(input.Platform) {
		return errors.New("client release platform must be windows, darwin, or linux")
	}
	if !model.IsAllowedClientReleaseArch(input.Arch) {
		return errors.New("client release arch must be x64, arm64, ia32, or universal")
	}
	if !model.IsAllowedClientReleaseChannel(input.Channel) {
		return errors.New("client release channel must be stable or beta")
	}
	return nil
}

func ClientReleaseMaxBytes() int64 {
	value := strings.TrimSpace(os.Getenv("CLIENT_RELEASE_OSS_MAX_BYTES"))
	if value == "" {
		return defaultClientReleaseMaxBytes
	}
	bytes, err := strconv.ParseInt(value, 10, 64)
	if err != nil || bytes <= 0 {
		return defaultClientReleaseMaxBytes
	}
	return bytes
}

func loadClientReleaseOSSConfig() clientReleaseOSSConfig {
	return clientReleaseOSSConfig{
		Endpoint:        strings.TrimSpace(os.Getenv("CLIENT_RELEASE_OSS_ENDPOINT")),
		Bucket:          strings.TrimSpace(os.Getenv("CLIENT_RELEASE_OSS_BUCKET")),
		AccessKeyID:     strings.TrimSpace(os.Getenv("CLIENT_RELEASE_OSS_ACCESS_KEY_ID")),
		AccessKeySecret: strings.TrimSpace(os.Getenv("CLIENT_RELEASE_OSS_ACCESS_KEY_SECRET")),
		Prefix:          strings.TrimSpace(os.Getenv("CLIENT_RELEASE_OSS_PREFIX")),
	}
}

func (c clientReleaseOSSConfig) validate() error {
	if c.Endpoint == "" || c.Bucket == "" || c.AccessKeyID == "" || c.AccessKeySecret == "" {
		return errors.New("client release oss is not configured")
	}
	return nil
}

func (c clientReleaseOSSConfig) objectKey(input ClientReleaseUploadInput, filename string) string {
	prefix := strings.Trim(strings.TrimSpace(c.Prefix), "/")
	if prefix == "" {
		prefix = "client-releases"
	}
	channel := cleanObjectPart(input.Channel)
	if channel == "" {
		channel = "stable"
	}
	platform := cleanObjectPart(input.Platform)
	if platform == "" {
		platform = "unknown-platform"
	}
	arch := cleanObjectPart(input.Arch)
	if arch == "" {
		arch = "unknown-arch"
	}
	version := cleanObjectPart(input.Version)
	if version == "" {
		version = time.Now().UTC().Format("20060102150405")
	}
	name := cleanClientReleaseDownloadName(filename)
	if name == "" {
		name = "client-release"
	}
	stamp := time.Now().UTC().Format("20060102150405.000000000")
	return path.Join(prefix, channel, platform, arch, version, fmt.Sprintf("%s-%s", stamp, name))
}

func clientReleaseSignedURLExpires() int64 {
	value := strings.TrimSpace(os.Getenv("CLIENT_RELEASE_OSS_SIGNED_URL_EXPIRES_SECONDS"))
	if value == "" {
		return 600
	}
	seconds, err := strconv.ParseInt(value, 10, 64)
	if err != nil || seconds <= 0 {
		return 600
	}
	if seconds > 86400 {
		return 86400
	}
	return seconds
}

func clientReleaseContentType(filename string) (string, error) {
	ext := clientReleaseFileExt(filename)
	contentType, ok := clientReleaseContentTypes[ext]
	if !ok {
		return "", errors.New("only exe, msi, dmg, pkg, zip, AppImage, deb, rpm, and yml files are supported")
	}
	return contentType, nil
}

func clientReleaseGeneratedFileName(input ClientReleaseUploadInput, filename string) string {
	ext := clientReleaseFileExt(filename)
	if ext == ".appimage" {
		ext = ".AppImage"
	}
	return fmt.Sprintf(
		"Z-UP-Setup-%s-%s-%s-%s%s",
		input.Version,
		input.Platform,
		input.Arch,
		input.Channel,
		ext,
	)
}

func clientReleaseFileExt(filename string) string {
	return strings.ToLower(path.Ext(strings.ReplaceAll(filename, "\\", "/")))
}

func cleanClientReleaseDownloadName(value string) string {
	value = strings.TrimSpace(value)
	value = strings.ReplaceAll(value, "\\", "/")
	value = path.Base(value)
	value = strings.Trim(value, ". ")
	if value == "." || value == "/" {
		return ""
	}
	if len(value) > 255 {
		return value[len(value)-255:]
	}
	return value
}
