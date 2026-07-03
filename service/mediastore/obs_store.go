package mediastore

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// obsConfig 构建 obsStore 所需的最小配置（由 system_setting 映射而来）。
type obsConfig struct {
	Endpoint        string
	Region          string
	Bucket          string
	AccessKeyID     string
	SecretAccessKey string
	NFSRoot         string
	MaxObjectBytes  int64
	// AllowedURLHosts 上游 URL 下载的 host 白名单（防 SSRF）；空表示只做私网拦截。
	AllowedURLHosts []string
}

// obsStore 基于 aws-sdk-go-v2 s3 的 OBS 实现。
type obsStore struct {
	cfg      obsConfig
	client   *s3.Client
	presign  *s3.PresignClient
	download *http.Client
}

func newOBSStore(cfg obsConfig) (*obsStore, error) {
	if cfg.Endpoint == "" || cfg.Bucket == "" {
		return nil, fmt.Errorf("mediastore: endpoint/bucket required")
	}
	if cfg.AccessKeyID == "" || cfg.SecretAccessKey == "" {
		return nil, fmt.Errorf("mediastore: access key/secret required")
	}
	awsCfg := aws.Config{
		Region:      cfg.Region,
		Credentials: credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
	}
	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(cfg.Endpoint)
		o.UsePathStyle = false // OBS 推荐 virtual-hosted-style
	})
	return &obsStore{
		cfg:     cfg,
		client:  client,
		presign: s3.NewPresignClient(client),
		download: &http.Client{
			Timeout: 5 * time.Minute,
			// 重定向也可能指向内网：每一跳都重新做 SSRF 校验（scheme + DNS 解析后过滤私网）。
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				if len(via) >= 10 {
					return fmt.Errorf("mediastore: too many redirects")
				}
				if err := staticURLChecks(req.URL.String(), nil); err != nil {
					return err
				}
				return validateUpstreamURLSSRF(req.URL.String())
			},
		},
	}, nil
}

func (s *obsStore) Persist(ctx context.Context, key string, src PersistSource, meta map[string]string) error {
	contentType := src.ContentType
	if contentType == "" {
		contentType = InferContentType(key)
	}

	var body io.ReadSeeker
	switch {
	case len(src.Data) > 0:
		if s.cfg.MaxObjectBytes > 0 && int64(len(src.Data)) > s.cfg.MaxObjectBytes {
			return ErrObjectTooLarge
		}
		body = bytes.NewReader(src.Data)
	case src.NFSPath != "":
		f, size, err := s.openNFS(src.NFSPath)
		if err != nil {
			return err
		}
		defer f.Close()
		if s.cfg.MaxObjectBytes > 0 && size > s.cfg.MaxObjectBytes {
			return ErrObjectTooLarge
		}
		body = f
	case src.UpstreamURL != "":
		tmp, err := s.downloadToTemp(ctx, src.UpstreamURL)
		if err != nil {
			return err
		}
		defer func() {
			name := tmp.Name()
			tmp.Close()
			_ = os.Remove(name)
		}()
		body = tmp
	default:
		return ErrInvalidSource
	}

	input := &s3.PutObjectInput{
		Bucket:               aws.String(s.cfg.Bucket),
		Key:                  aws.String(key),
		Body:                 body,
		ContentType:          aws.String(contentType),
		ServerSideEncryption: types.ServerSideEncryptionAes256,
	}
	if len(meta) > 0 {
		input.Metadata = meta
	}
	_, err := s.client.PutObject(ctx, input)
	return err
}

// openNFS 校验路径合法后打开，返回文件句柄与大小。
func (s *obsStore) openNFS(nfsPath string) (*os.File, int64, error) {
	clean, err := ValidateNFSPath(s.cfg.NFSRoot, nfsPath)
	if err != nil {
		return nil, 0, err
	}
	fi, err := os.Stat(clean)
	if err != nil {
		return nil, 0, fmt.Errorf("mediastore: stat nfs_path: %w", err)
	}
	if fi.IsDir() {
		return nil, 0, fmt.Errorf("%w: %q is a directory", ErrInvalidSource, nfsPath)
	}
	f, err := os.Open(clean)
	if err != nil {
		return nil, 0, fmt.Errorf("mediastore: open nfs_path: %w", err)
	}
	return f, fi.Size(), nil
}

// downloadToTemp 校验后流式下载上游 URL 到临时文件，强制大小上限。
// 两道 SSRF 校验：staticURLChecks（scheme + 字面私网 IP + 可选白名单，hermetic）
// 与 validateUpstreamURLSSRF（复用项目 fetch 设置，解析 DNS 后过滤私网，堵住域名解析绕过）。
// 重定向每一跳也会走同样两道校验（见 newOBSStore 的 CheckRedirect）。
func (s *obsStore) downloadToTemp(ctx context.Context, rawURL string) (*os.File, error) {
	if err := s.validateUpstreamHost(rawURL); err != nil {
		return nil, err
	}
	if err := validateUpstreamURLSSRF(rawURL); err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, err
	}
	resp, err := s.download.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("mediastore: upstream download status %d", resp.StatusCode)
	}

	tmp, err := os.CreateTemp("", "mediastore-*")
	if err != nil {
		return nil, err
	}
	var reader io.Reader = resp.Body
	if s.cfg.MaxObjectBytes > 0 {
		reader = io.LimitReader(resp.Body, s.cfg.MaxObjectBytes+1)
	}
	n, err := io.Copy(tmp, reader)
	if err != nil {
		tmp.Close()
		_ = os.Remove(tmp.Name())
		return nil, err
	}
	if s.cfg.MaxObjectBytes > 0 && n > s.cfg.MaxObjectBytes {
		tmp.Close()
		_ = os.Remove(tmp.Name())
		return nil, ErrObjectTooLarge
	}
	if _, err := tmp.Seek(0, io.SeekStart); err != nil {
		tmp.Close()
		_ = os.Remove(tmp.Name())
		return nil, err
	}
	return tmp, nil
}

// validateUpstreamHost 防 SSRF（hermetic 部分）：scheme + 字面私网 IP + 可选 host 白名单。
// 注意：仅此一层挡不住「域名解析到内网」，DNS 解析层的过滤在 validateUpstreamURLSSRF。
func (s *obsStore) validateUpstreamHost(rawURL string) error {
	return staticURLChecks(rawURL, s.cfg.AllowedURLHosts)
}

// staticURLChecks 不做网络的静态校验：scheme 限 http/https、字面私网/环回 IP 拒绝、
// 若给了 allowedHosts 则 host 须命中。可用于单测与重定向逐跳校验。
func staticURLChecks(rawURL string, allowedHosts []string) error {
	u, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("%w: bad url", ErrInvalidSource)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("%w: scheme %q", ErrInvalidSource, u.Scheme)
	}
	host := u.Hostname()
	if ip := net.ParseIP(host); ip != nil {
		if ip.IsLoopback() || ip.IsPrivate() || ip.IsUnspecified() || ip.IsLinkLocalUnicast() {
			return fmt.Errorf("%w: private host %q", ErrInvalidSource, host)
		}
	}
	if len(allowedHosts) > 0 {
		ok := false
		for _, h := range allowedHosts {
			if strings.EqualFold(host, h) || strings.HasSuffix(strings.ToLower(host), "."+strings.ToLower(h)) {
				ok = true
				break
			}
		}
		if !ok {
			return fmt.Errorf("%w: host %q not in allowlist", ErrInvalidSource, host)
		}
	}
	return nil
}

// validateUpstreamURLSSRF 复用项目统一的 SSRF 校验（会解析 DNS 后按 IP 过滤私网），
// 堵住「域名解析到内网」这一绕过。默认 fetch 设置即 EnableSSRFProtection=true / 不允许私网。
func validateUpstreamURLSSRF(rawURL string) error {
	fs := system_setting.GetFetchSetting()
	if err := common.ValidateURLWithFetchSetting(rawURL,
		fs.EnableSSRFProtection, fs.AllowPrivateIp, fs.DomainFilterMode, fs.IpFilterMode,
		fs.DomainList, fs.IpList, fs.AllowedPorts, fs.ApplyIPFilterForDomain); err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidSource, err)
	}
	return nil
}

func (s *obsStore) Sign(ctx context.Context, key string, ttl time.Duration, opts ...SignOption) (string, error) {
	var o SignOptions
	for _, fn := range opts {
		fn(&o)
	}
	input := &s3.GetObjectInput{
		Bucket: aws.String(s.cfg.Bucket),
		Key:    aws.String(key),
	}
	if o.DownloadName != "" {
		input.ResponseContentDisposition = aws.String(
			fmt.Sprintf("attachment; filename=%q", o.DownloadName))
	}
	req, err := s.presign.PresignGetObject(ctx, input, s3.WithPresignExpires(ttl))
	if err != nil {
		return "", err
	}
	return req.URL, nil
}

func (s *obsStore) Delete(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.cfg.Bucket),
		Key:    aws.String(key),
	})
	return err
}

func (s *obsStore) DeleteObjects(ctx context.Context, keys []string) error {
	for i := 0; i < len(keys); i += 1000 {
		end := i + 1000
		if end > len(keys) {
			end = len(keys)
		}
		objs := make([]types.ObjectIdentifier, 0, end-i)
		for _, k := range keys[i:end] {
			objs = append(objs, types.ObjectIdentifier{Key: aws.String(k)})
		}
		_, err := s.client.DeleteObjects(ctx, &s3.DeleteObjectsInput{
			Bucket: aws.String(s.cfg.Bucket),
			Delete: &types.Delete{Objects: objs, Quiet: aws.Bool(true)},
		})
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *obsStore) Healthcheck(ctx context.Context) error {
	key := ".newapi-mediastore-healthcheck"
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.cfg.Bucket),
		Key:         aws.String(key),
		Body:        strings.NewReader("ok"),
		ContentType: aws.String("text/plain"),
	})
	if err != nil {
		return fmt.Errorf("mediastore: healthcheck put failed: %w", err)
	}
	if err := s.Delete(ctx, key); err != nil {
		return fmt.Errorf("mediastore: healthcheck delete failed: %w", err)
	}
	return nil
}

func (s *obsStore) StorageInfo(ctx context.Context) (StorageInfo, error) {
	var info StorageInfo
	p := s3.NewListObjectsV2Paginator(s.client, &s3.ListObjectsV2Input{
		Bucket: aws.String(s.cfg.Bucket),
	})
	for p.HasMorePages() {
		page, err := p.NextPage(ctx)
		if err != nil {
			return info, err
		}
		for _, obj := range page.Contents {
			info.TotalObjects++
			if obj.Size != nil {
				info.TotalBytes += *obj.Size
			}
		}
	}
	return info, nil
}
