// Package nfsinput 是 gpustackplus 渠道两条链路(图片同步 relay、视频异步 task)
// 共享的 NFS 输入物化工具。见:
//   - gpustack 仓 docs/lightx2v-nfs-input-design.md(§3 路径约定 / §4 门面契约 / §5 new-api 物化)
//   - new-api 仓 docs/gpustackplus-sync-image-backpressure.md
//
// 三种到达形态统一收敛成"写字节到 NFS + 生成相对 input_ref":
//   - base64 / data-uri(JSON)      → 解码 → 写盘
//   - multipart 上传文件(form-data) → 读字节 → 写盘
//   - URL(http/https,JSON)         → new-api 下载(带 SSRF 校验)→ 写盘;下不到 → 400 skip-retry
//
// 两个 adaptor(不同 package,同名 gpustackplus)都 import 本包,唯一物化点,不重复实现。
//
// 路径约定(必须与门面 routes/videos.py 校验完全一致):
//
//	inputs/<task_type>-<sanitizedModel>/YYYY/MM/DD/<user_id>/<gid>-<field>[-<i>].<ext>
//
// 其中 <root> = MediaStorageSettings.NFSRoot()(默认 /nfs-output),
// **必须等于** gpustack lightx2v_output_root(同一块 SFS、同一绝对挂载路径)——硬不变量,
// 见 ProbeNFSInputs 启动探测。new-api 先把全部输入字节写到 <root>/<相对ref>,再 POST 提交。
package nfsinput

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

// Field 输入字段名(与门面 _INPUT_FIELDS 键对齐)。
type Field string

const (
	FieldImage     Field = "image"      // 条件图 / 底图(i2i 支持多图,≤MaxImageRefs)
	FieldLastFrame Field = "last_frame" // 尾帧(flf2v),单值
	FieldImageMask Field = "image_mask" // 蒙版(带 mask 的 edit),单值
	FieldAudio     Field = "audio"      // 音频(s2v),单值
)

const (
	// MaxImageRefs image 维度最多张数(与门面 _MAX_INPUT_IMAGES 对齐)。
	MaxImageRefs = 5
	// downloadTimeout URL 下载超时(new-api 侧,独立于 relay 长超时)。
	downloadTimeout = 30 * time.Second
)

// sanitizeModelRe 除 [A-Za-z0-9._-] 外的字符替换为 '_'(与门面 sanitize 规则一致)。
var sanitizeModelRe = regexp.MustCompile(`[^A-Za-z0-9._-]`)

// SanitizeModel 把上游模型名里非 [A-Za-z0-9._-] 的字符替换为 '_'。
func SanitizeModel(model string) string {
	s := sanitizeModelRe.ReplaceAllString(model, "_")
	if s == "" {
		return "_"
	}
	return s
}

// Materializer 一次请求内的物化上下文;所有输入落到同一 <task_type>/日期/<user_id>/<gid> 前缀下。
type Materializer struct {
	root      string // NFSRoot(去尾斜杠)
	taskType  string // t2i|i2i|t2v|i2v|flf2v|s2v
	model     string // sanitized model
	userID    string // new-api 终端用户 id(= 提交体 user_id;门面校验 parent_dir_name == user_id)
	gid       string // 唯一 input-group id(PublicTaskID 或新 uuid)
	dateParts string // YYYY/MM/DD(UTC)

	refs    map[Field][]string // 已生成的相对 ref,按 field 归组
	written []string           // 已写盘的绝对路径,供失败时回滚(§N2 复审)
}

// NewMaterializer 构造物化上下文。userID / gid 不得为空;gid 传 info.PublicTaskID,空则由调用方传新 uuid。
// taskType 也过一次 sanitize:它可能来自 metadata,含 '/'、'..' 时会让写盘路径逃出
// <root>/inputs(门面校验在 new-api 写盘之后,救不了写盘侧),故与 model 同规则收敛。
func NewMaterializer(taskType, model, userID, gid string) *Materializer {
	now := time.Now().UTC()
	return &Materializer{
		root:      system_setting.GetMediaStorageSettings().NFSRoot(),
		taskType:  SanitizeModel(taskType),
		model:     SanitizeModel(model),
		userID:    userID,
		gid:       gid,
		dateParts: fmt.Sprintf("%04d/%02d/%02d", now.Year(), int(now.Month()), now.Day()),
		refs:      make(map[Field][]string),
	}
}

// relRef 按 §3 约定拼相对路径;多值 image 带 -<i> 后缀,单值字段无后缀。
func (m *Materializer) relRef(field Field, index int, multi bool, ext string) string {
	name := fmt.Sprintf("%s-%s", m.gid, field)
	if multi {
		name = fmt.Sprintf("%s-%s-%d", m.gid, field, index)
	}
	dir := fmt.Sprintf("inputs/%s-%s/%s/%s", m.taskType, m.model, m.dateParts, m.userID)
	return dir + "/" + name + ext
}

// writeBytes 把字节写到 <root>/<ref>,自建父目录;记录已写盘绝对路径供回滚。
func (m *Materializer) writeBytes(ref string, data []byte) error {
	abs := filepath.Join(m.root, filepath.FromSlash(ref))
	if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
		return fmt.Errorf("创建 NFS 输入目录失败: %w", err)
	}
	if err := os.WriteFile(abs, data, 0o644); err != nil {
		return fmt.Errorf("写 NFS 输入文件失败: %w", err)
	}
	m.written = append(m.written, abs)
	return nil
}

// Cleanup best-effort 删除本次已写盘的输入文件(§N2 复审):多输入请求中某一路
// 物化失败时,调用方在返回 400 前调用它,避免把已写的前几张留成孤儿(janitor 的
// TTL 仍是最终兜底,这里只是即时回滚,更干净)。
func (m *Materializer) Cleanup() {
	for _, p := range m.written {
		_ = os.Remove(p)
	}
	m.written = nil
}

// extForField 默认扩展名:image 类 .png,audio .wav。
func extForField(field Field) string {
	if field == FieldAudio {
		return ".wav"
	}
	return ".png"
}

// AddBytes 直接写一段字节(multipart 上传文件字节走这里)。
func (m *Materializer) AddBytes(field Field, index int, multi bool, data []byte) error {
	if len(data) == 0 {
		return fmt.Errorf("输入 %s 字节为空", field)
	}
	ref := m.relRef(field, index, multi, extForField(field))
	if err := m.writeBytes(ref, data); err != nil {
		return err
	}
	m.refs[field] = append(m.refs[field], ref)
	return nil
}

// AddString 处理一个字符串输入:data-uri / 裸 base64 → 解码写;http(s) URL → 下载写。
func (m *Materializer) AddString(ctx context.Context, field Field, index int, multi bool, raw string) error {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return fmt.Errorf("输入 %s 为空字符串", field)
	}
	if strings.HasPrefix(raw, "http://") || strings.HasPrefix(raw, "https://") {
		data, err := downloadURL(ctx, raw)
		if err != nil {
			return err
		}
		return m.AddBytes(field, index, multi, data)
	}
	// data-uri 或裸 base64。
	b64 := raw
	if strings.HasPrefix(raw, "data:") {
		if i := strings.Index(raw, ","); i >= 0 {
			b64 = raw[i+1:]
		}
	}
	data, err := base64.StdEncoding.DecodeString(strings.TrimSpace(b64))
	if err != nil {
		return fmt.Errorf("输入 %s 既非 http(s) URL 也非合法 base64/data-uri: %w", field, err)
	}
	return m.AddBytes(field, index, multi, data)
}

// AddMultipartFile 读 multipart 上传文件字节并写盘。
func (m *Materializer) AddMultipartFile(field Field, index int, multi bool, fh *multipart.FileHeader) error {
	f, err := fh.Open()
	if err != nil {
		return fmt.Errorf("打开上传文件失败: %w", err)
	}
	defer f.Close()
	data, err := io.ReadAll(f)
	if err != nil {
		return fmt.Errorf("读取上传文件失败: %w", err)
	}
	return m.AddBytes(field, index, multi, data)
}

// Refs 返回 input_refs(field → 相对路径数组)。用于放进提交体的 "input_refs" 字段。
// 空则返回 nil(t2i/t2v 无输入,整机制不触发)。
func (m *Materializer) Refs() map[string][]string {
	if len(m.refs) == 0 {
		return nil
	}
	out := make(map[string][]string, len(m.refs))
	for k, v := range m.refs {
		out[string(k)] = v
	}
	return out
}

// downloadURL 带 SSRF 校验地下载一个远程 URL 到字节(复用项目统一 fetch 设置 + OBS host 白名单)。
// new-api 够不到(SSRF 拒绝 / 网络失败 / 非 2xx)→ 返回错误,调用方转 400 skip-retry,不提交任务。
func downloadURL(ctx context.Context, rawURL string) ([]byte, error) {
	s := system_setting.GetMediaStorageSettings()
	fs := system_setting.GetFetchSetting()
	if err := common.ValidateURLWithFetchSetting(rawURL,
		fs.EnableSSRFProtection, fs.AllowPrivateIp, fs.DomainFilterMode, fs.IpFilterMode,
		fs.DomainList, fs.IpList, fs.AllowedPorts, fs.ApplyIPFilterForDomain); err != nil {
		return nil, fmt.Errorf("输入 URL 被安全策略拒绝: %w", err)
	}
	// 可选 host 白名单(与 OBS 上游下载共用配置);留空即不额外限制。
	if hosts := s.AllowedUpstreamHosts(); len(hosts) > 0 {
		if err := hostAllowed(rawURL, hosts); err != nil {
			return nil, err
		}
	}

	// 禁止自动跟随重定向:SSRF/白名单只校验了原始 URL,若跟随 3xx 跳到内网地址
	// (如 169.254.169.254 云元数据)就绕过了校验。返回 ErrUseLastResponse 让 client
	// 不跟随,3xx 会被下面的状态码检查当作下载失败 → 400 skip-retry。
	client := &http.Client{
		Timeout: downloadTimeout,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, fmt.Errorf("构造下载请求失败: %w", err)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("下载输入 URL 失败(new-api 够不到): %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("下载输入 URL 失败: 上游返回 %d", resp.StatusCode)
	}
	maxBytes := int64(s.MaxObjectSizeMB) * 1024 * 1024
	var reader io.Reader = resp.Body
	if maxBytes > 0 {
		reader = io.LimitReader(resp.Body, maxBytes+1)
	}
	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("读取下载内容失败: %w", err)
	}
	if maxBytes > 0 && int64(len(data)) > maxBytes {
		return nil, fmt.Errorf("输入 URL 内容超过单文件上限 %d MB", s.MaxObjectSizeMB)
	}
	if len(data) == 0 {
		return nil, fmt.Errorf("下载输入 URL 得到空内容")
	}
	return data, nil
}

// hostAllowed 简单 host 白名单(精确或 .suffix 子域匹配)。
func hostAllowed(rawURL string, hosts []string) error {
	i := strings.Index(rawURL, "://")
	rest := rawURL
	if i >= 0 {
		rest = rawURL[i+3:]
	}
	if j := strings.IndexAny(rest, "/?#"); j >= 0 {
		rest = rest[:j]
	}
	host := rest
	if at := strings.LastIndex(host, "@"); at >= 0 {
		host = host[at+1:]
	}
	if c := strings.LastIndex(host, ":"); c >= 0 {
		host = host[:c]
	}
	host = strings.ToLower(strings.TrimSpace(host))
	for _, h := range hosts {
		h = strings.ToLower(strings.TrimSpace(h))
		if h == "" {
			continue
		}
		if host == h || strings.HasSuffix(host, "."+h) {
			return nil
		}
	}
	return fmt.Errorf("输入 URL host %q 不在允许列表内", host)
}

// ProbeNFSInputs 启动探测:<root>/inputs/ 可创建 + 可写 + 可读(写临时探针 → 读回 → 删)。
// 失败返回错误,调用方应 fatal + 打清日志:NFS 未挂载 / 不可写 / root 与 gpustack output_root 不一致。
// 成功时把解析出的 root 打进日志,便于人工核对两侧一致(硬不变量:new-api NFSRoot == gpustack lightx2v_output_root)。
func ProbeNFSInputs() error {
	root := system_setting.GetMediaStorageSettings().NFSRoot()
	inputsDir := filepath.Join(root, "inputs")
	if err := os.MkdirAll(inputsDir, 0o755); err != nil {
		return fmt.Errorf("NFS 输入目录不可创建(NFS 未挂载/不可写?root=%s): %w", root, err)
	}
	probe := filepath.Join(inputsDir, fmt.Sprintf(".nfs_probe_%d_%s", time.Now().UnixNano(), common.GetUUID()))
	want := []byte("nfs-probe")
	if err := os.WriteFile(probe, want, 0o644); err != nil {
		return fmt.Errorf("NFS 输入目录不可写(root=%s): %w", root, err)
	}
	defer os.Remove(probe)
	got, err := os.ReadFile(probe)
	if err != nil {
		return fmt.Errorf("NFS 输入探针不可读(root=%s): %w", root, err)
	}
	if string(got) != string(want) {
		return fmt.Errorf("NFS 输入探针读回内容不一致(root=%s):可能挂载异常", root)
	}
	return nil
}
