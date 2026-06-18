package service

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/aliyun/aliyun-oss-go-sdk/oss"
)

const SkillHubZipMaxBytes = 50 << 20

var skillHubObjectSafePattern = regexp.MustCompile(`[^A-Za-z0-9._-]+`)

type SkillHubUploadResult struct {
	URL      string `json:"url"`
	Object   string `json:"object"`
	Size     int64  `json:"size"`
	Checksum string `json:"checksum"`
}

type skillHubOSSConfig struct {
	Endpoint        string
	Bucket          string
	AccessKeyID     string
	AccessKeySecret string
	Prefix          string
}

func UploadSkillHubZip(file multipart.File, header *multipart.FileHeader, skillID string, version string) (*SkillHubUploadResult, error) {
	cfg := loadSkillHubOSSConfig()
	if err := cfg.validate(); err != nil {
		return nil, err
	}
	if header == nil {
		return nil, errors.New("upload file is required")
	}
	if header.Size <= 0 {
		return nil, errors.New("upload file is empty")
	}
	if header.Size > SkillHubZipMaxBytes {
		return nil, fmt.Errorf("zip file must be <= %d MB", SkillHubZipMaxBytes>>20)
	}
	if !strings.HasSuffix(strings.ToLower(header.Filename), ".zip") {
		return nil, errors.New("only .zip files are supported")
	}
	if err := validateZipMagic(file); err != nil {
		return nil, err
	}

	client, err := oss.New(cfg.Endpoint, cfg.AccessKeyID, cfg.AccessKeySecret)
	if err != nil {
		return nil, err
	}
	bucket, err := client.Bucket(cfg.Bucket)
	if err != nil {
		return nil, err
	}

	objectKey := cfg.objectKey(skillID, version, header.Filename)
	hasher := sha256.New()
	reader := io.TeeReader(file, hasher)
	if err := bucket.PutObject(objectKey, reader, oss.ContentType("application/zip")); err != nil {
		return nil, err
	}

	checksum := "sha256:" + hex.EncodeToString(hasher.Sum(nil))
	return &SkillHubUploadResult{
		URL:      "",
		Object:   objectKey,
		Size:     header.Size,
		Checksum: checksum,
	}, nil
}

func loadSkillHubOSSConfig() skillHubOSSConfig {
	return skillHubOSSConfig{
		Endpoint:        strings.TrimSpace(os.Getenv("SKILL_HUB_OSS_ENDPOINT")),
		Bucket:          strings.TrimSpace(os.Getenv("SKILL_HUB_OSS_BUCKET")),
		AccessKeyID:     strings.TrimSpace(os.Getenv("SKILL_HUB_OSS_ACCESS_KEY_ID")),
		AccessKeySecret: strings.TrimSpace(os.Getenv("SKILL_HUB_OSS_ACCESS_KEY_SECRET")),
		Prefix:          strings.TrimSpace(os.Getenv("SKILL_HUB_OSS_PREFIX")),
	}
}

func (c skillHubOSSConfig) validate() error {
	if c.Endpoint == "" || c.Bucket == "" || c.AccessKeyID == "" || c.AccessKeySecret == "" {
		return errors.New("skill hub oss is not configured")
	}
	return nil
}

func (c skillHubOSSConfig) objectKey(skillID string, version string, filename string) string {
	prefix := strings.Trim(strings.TrimSpace(c.Prefix), "/")
	if prefix == "" {
		prefix = "skill-hub/skills"
	}
	id := cleanObjectPart(skillID)
	if id == "" {
		id = "draft"
	}
	ver := cleanObjectPart(version)
	if ver == "" {
		ver = time.Now().UTC().Format("20060102150405")
	}
	name := cleanObjectPart(strings.TrimSuffix(path.Base(strings.ReplaceAll(filename, "\\", "/")), ".zip"))
	if name == "" {
		name = id
	}
	return path.Join(prefix, id, fmt.Sprintf("%s-%s.zip", name, ver))
}

func SignSkillHubZipURL(objectKey string, filename string) (string, error) {
	cfg := loadSkillHubOSSConfig()
	if err := cfg.validate(); err != nil {
		return "", err
	}
	objectKey = strings.TrimLeft(strings.TrimSpace(objectKey), "/")
	if objectKey == "" {
		return "", errors.New("skill hub oss object is required")
	}
	client, err := oss.New(cfg.Endpoint, cfg.AccessKeyID, cfg.AccessKeySecret)
	if err != nil {
		return "", err
	}
	bucket, err := client.Bucket(cfg.Bucket)
	if err != nil {
		return "", err
	}
	expires := skillHubSignedURLExpires()
	options := []oss.Option{}
	if strings.TrimSpace(filename) != "" {
		options = append(options, oss.ResponseContentDisposition(
			fmt.Sprintf("attachment; filename=%q", cleanObjectPart(filename)+".zip"),
		))
	}
	return bucket.SignURL(objectKey, oss.HTTPGet, expires, options...)
}

func skillHubSignedURLExpires() int64 {
	value := strings.TrimSpace(os.Getenv("SKILL_HUB_OSS_SIGNED_URL_EXPIRES_SECONDS"))
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

func cleanObjectPart(value string) string {
	value = strings.TrimSpace(value)
	value = skillHubObjectSafePattern.ReplaceAllString(value, "-")
	value = strings.Trim(value, ".-_")
	if len(value) > 80 {
		value = value[:80]
	}
	return value
}

func validateZipMagic(file multipart.File) error {
	seeker, ok := file.(io.Seeker)
	if !ok {
		return errors.New("uploaded file stream is not seekable")
	}
	if _, err := seeker.Seek(0, io.SeekStart); err != nil {
		return err
	}
	defer seeker.Seek(0, io.SeekStart)
	header := make([]byte, 4)
	n, err := io.ReadFull(file, header)
	if err != nil && err != io.ErrUnexpectedEOF {
		return err
	}
	if n < 4 || string(header[:2]) != "PK" {
		return errors.New("uploaded file is not a zip archive")
	}
	_, err = seeker.Seek(0, io.SeekStart)
	return err
}
