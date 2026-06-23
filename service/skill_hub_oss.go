package service

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/url"
	"os"
	"path"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/aliyun/aliyun-oss-go-sdk/oss"
)

const SkillHubZipMaxBytes = 50 << 20
const SkillHubIconMaxBytes = 1 << 20

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

type skillHubIconOSSConfig struct {
	skillHubOSSConfig
	PublicBaseURL string
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

func UploadSkillHubIcon(file multipart.File, header *multipart.FileHeader, skillID string) (*SkillHubUploadResult, error) {
	cfg := loadSkillHubIconOSSConfig()
	if err := cfg.validate(); err != nil {
		return nil, err
	}
	if strings.TrimSpace(cfg.PublicBaseURL) == "" {
		return nil, errors.New("skill hub icon public base url is not configured")
	}
	if err := validateSkillHubIconPublicBaseURL(cfg.PublicBaseURL); err != nil {
		return nil, err
	}
	if header == nil {
		return nil, errors.New("upload file is required")
	}
	if header.Size <= 0 {
		return nil, errors.New("upload file is empty")
	}
	if header.Size > SkillHubIconMaxBytes {
		return nil, fmt.Errorf("icon file must be <= %d MB", SkillHubIconMaxBytes>>20)
	}
	contentType, ext, err := detectSkillHubIcon(file)
	if err != nil {
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

	objectKey := cfg.iconObjectKey(skillID, header.Filename, ext)
	hasher := sha256.New()
	reader := io.TeeReader(file, hasher)
	if err := bucket.PutObject(objectKey, reader, oss.ContentType(contentType)); err != nil {
		return nil, err
	}

	checksum := "sha256:" + hex.EncodeToString(hasher.Sum(nil))
	return &SkillHubUploadResult{
		URL:      objectPublicURL(cfg.PublicBaseURL, objectKey),
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

func loadSkillHubIconOSSConfig() skillHubIconOSSConfig {
	base := loadSkillHubOSSConfig()
	cfg := skillHubIconOSSConfig{
		skillHubOSSConfig: skillHubOSSConfig{
			Endpoint:        firstEnv("SKILL_HUB_OSS_ICON_ENDPOINT", base.Endpoint),
			Bucket:          firstEnv("SKILL_HUB_OSS_ICON_BUCKET", base.Bucket),
			AccessKeyID:     firstEnv("SKILL_HUB_OSS_ICON_ACCESS_KEY_ID", base.AccessKeyID),
			AccessKeySecret: firstEnv("SKILL_HUB_OSS_ICON_ACCESS_KEY_SECRET", base.AccessKeySecret),
			Prefix:          firstEnv("SKILL_HUB_OSS_ICON_PREFIX", "skill-hub/icons"),
		},
		PublicBaseURL: strings.TrimRight(strings.TrimSpace(os.Getenv("SKILL_HUB_OSS_ICON_PUBLIC_BASE_URL")), "/"),
	}
	return cfg
}

func firstEnv(key string, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return strings.TrimSpace(fallback)
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

func (c skillHubIconOSSConfig) iconObjectKey(skillID string, filename string, ext string) string {
	prefix := strings.Trim(strings.TrimSpace(c.Prefix), "/")
	if prefix == "" {
		prefix = "skill-hub/icons"
	}
	id := cleanObjectPart(skillID)
	if id == "" {
		id = "draft"
	}
	name := cleanObjectPart(strings.TrimSuffix(path.Base(strings.ReplaceAll(filename, "\\", "/")), path.Ext(filename)))
	if name == "" {
		name = "icon"
	}
	stamp := time.Now().UTC().Format("20060102150405.000000000")
	return path.Join(prefix, id, fmt.Sprintf("%s-%s%s", name, stamp, ext))
}

func objectPublicURL(baseURL string, objectKey string) string {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	parts := strings.Split(strings.TrimLeft(strings.TrimSpace(objectKey), "/"), "/")
	escaped := make([]string, 0, len(parts))
	for _, part := range parts {
		if part == "" {
			continue
		}
		escaped = append(escaped, url.PathEscape(part))
	}
	return baseURL + "/" + strings.Join(escaped, "/")
}

func validateSkillHubIconPublicBaseURL(value string) error {
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil {
		return errors.New("skill hub icon public base url must be an https url")
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" {
		return errors.New("skill hub icon public base url must not include query or fragment")
	}
	return nil
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

func detectSkillHubIcon(file multipart.File) (string, string, error) {
	seeker, ok := file.(io.Seeker)
	if !ok {
		return "", "", errors.New("uploaded file stream is not seekable")
	}
	if _, err := seeker.Seek(0, io.SeekStart); err != nil {
		return "", "", err
	}
	defer seeker.Seek(0, io.SeekStart)

	header := make([]byte, 512)
	n, err := file.Read(header)
	if err != nil && err != io.EOF {
		return "", "", err
	}
	header = header[:n]
	switch {
	case bytes.HasPrefix(header, []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}):
		return "image/png", ".png", nil
	case len(header) >= 3 && header[0] == 0xff && header[1] == 0xd8 && header[2] == 0xff:
		return "image/jpeg", ".jpg", nil
	case len(header) >= 12 && string(header[:4]) == "RIFF" && string(header[8:12]) == "WEBP":
		return "image/webp", ".webp", nil
	default:
		return "", "", errors.New("only png, jpg, jpeg, and webp icons are supported")
	}
}
