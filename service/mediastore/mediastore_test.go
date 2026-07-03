package mediastore

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/setting/system_setting"
)

func TestKeyFromNFSPath(t *testing.T) {
	cases := []struct {
		root, nfs, want string
	}{
		{"/nfs-output", "/nfs-output/t2i-z_image/2026/07/03/10086/img_abc.png", "t2i-z_image/2026/07/03/10086/img_abc.png"},
		{"/nfs-output/", "/nfs-output/t2v-wan/2026/07/03/0/vid.mp4", "t2v-wan/2026/07/03/0/vid.mp4"},
		{"/nfs-output", "/nfs-output//double//slash.png", "double/slash.png"},
	}
	for _, c := range cases {
		if got := KeyFromNFSPath(c.root, c.nfs); got != c.want {
			t.Errorf("KeyFromNFSPath(%q,%q)=%q want %q", c.root, c.nfs, got, c.want)
		}
	}
}

func TestBuildKey(t *testing.T) {
	at := time.Date(2026, 7, 3, 12, 0, 0, 0, time.UTC)
	got := BuildKey("i2i", "kling", 10086, "task_k001", "png", at)
	want := "i2i-kling/2026/07/03/10086/task_k001.png"
	if got != want {
		t.Errorf("BuildKey=%q want %q", got, want)
	}
	// 无模型段
	got = BuildKey("t2v", "", 0, "vid1", ".mp4", at)
	want = "t2v/2026/07/03/0/vid1.mp4"
	if got != want {
		t.Errorf("BuildKey no-model=%q want %q", got, want)
	}
	// 段内斜杠必须被清理，防止层级注入
	got = BuildKey("t2i", "a/b", 1, "c/d", "png", at)
	want = "t2i-a_b/2026/07/03/1/c_d.png"
	if got != want {
		t.Errorf("BuildKey sanitize=%q want %q", got, want)
	}
}

func TestValidateNFSPath(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "t2i"), 0o755); err != nil {
		t.Fatal(err)
	}
	okFile := filepath.Join(root, "t2i", "a.png")
	if err := os.WriteFile(okFile, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}

	// 合法：返回解析后的真实路径
	got, err := ValidateNFSPath(root, okFile)
	if err != nil {
		t.Errorf("expected valid, got %v", err)
	}
	wantResolved, _ := filepath.EvalSymlinks(okFile)
	if got != wantResolved {
		t.Errorf("resolved path got %q want %q", got, wantResolved)
	}

	// .. 折叠后仍在 root 之下
	if _, err := ValidateNFSPath(root, filepath.Join(root, "t2i", "..", "t2i", "a.png")); err != nil {
		t.Errorf("clean path err %v", err)
	}

	// 字符串层逃逸
	bad := []string{
		filepath.Join(root, "..", "etc", "passwd"),
		"/etc/passwd",
		root + "-evil/x.png",
		"",
	}
	for _, p := range bad {
		if _, err := ValidateNFSPath(root, p); err == nil {
			t.Errorf("expected error for %q", p)
		}
	}

	// 不存在的文件（上传场景文件必须已存在）
	if _, err := ValidateNFSPath(root, filepath.Join(root, "nope.png")); err == nil {
		t.Errorf("expected error for nonexistent file")
	}

	// symlink 逃逸：root 下的链接指向根外文件，须被拒绝
	outside := t.TempDir()
	secret := filepath.Join(outside, "secret.txt")
	if err := os.WriteFile(secret, []byte("s"), 0o644); err != nil {
		t.Fatal(err)
	}
	link := filepath.Join(root, "leak.png")
	if err := os.Symlink(secret, link); err != nil {
		t.Skipf("symlink not supported: %v", err)
	}
	if _, err := ValidateNFSPath(root, link); err == nil {
		t.Errorf("expected error for symlink escaping root")
	}
}

func TestInferContentType(t *testing.T) {
	cases := map[string]string{
		"a/b/c.png": "image/png",
		"x.JPG":     "image/jpeg",
		"v.mp4":     "video/mp4",
		"v.webm":    "video/webm",
		"noext":     "application/octet-stream",
		"x.unknown": "application/octet-stream",
		"clip.MOV":  "video/quicktime",
	}
	for in, want := range cases {
		if got := InferContentType(in); got != want {
			t.Errorf("InferContentType(%q)=%q want %q", in, got, want)
		}
	}
}

func TestOBSRefHelpers(t *testing.T) {
	key := "t2i-z_image/2026/07/03/1/a.png"
	ref := WrapKey(key)
	if ref != "obs://"+key {
		t.Fatalf("WrapKey=%q", ref)
	}
	if !IsOBSRef(ref) {
		t.Error("IsOBSRef false")
	}
	if IsOBSRef("https://x/y.png") {
		t.Error("IsOBSRef true for http url")
	}
	if KeyFromRef(ref) != key {
		t.Errorf("KeyFromRef=%q", KeyFromRef(ref))
	}
	if KeyFromRef("https://x") != "" {
		t.Error("KeyFromRef non-empty for non-obs")
	}
}

func TestValidateUpstreamHost(t *testing.T) {
	s := &obsStore{cfg: obsConfig{AllowedURLHosts: []string{"replicate.delivery"}}}
	ok := []string{
		"https://replicate.delivery/x/y.mp4",
		"https://cdn.replicate.delivery/a.png",
	}
	for _, u := range ok {
		if err := s.validateUpstreamHost(u); err != nil {
			t.Errorf("expected ok for %q, got %v", u, err)
		}
	}
	bad := []string{
		"http://127.0.0.1/x",
		"https://10.0.0.5/x",
		"http://169.254.169.254/latest/meta-data",
		"ftp://replicate.delivery/x",
		"https://evil.com/x", // 不在白名单
	}
	for _, u := range bad {
		if err := s.validateUpstreamHost(u); err == nil {
			t.Errorf("expected error for %q", u)
		}
	}

	// 无白名单时只拦私网，公网放行
	s2 := &obsStore{cfg: obsConfig{}}
	if err := s2.validateUpstreamHost("https://anything.example.com/x"); err != nil {
		t.Errorf("no-allowlist public host should pass: %v", err)
	}
	if err := s2.validateUpstreamHost("http://192.168.1.1/x"); err == nil {
		t.Error("private host must be blocked even without allowlist")
	}
}

func TestNormalizeHost(t *testing.T) {
	cases := map[string]string{
		"https://obs.cn-central-221.ovaijisuan.com": "obs.cn-central-221.ovaijisuan.com",
		"https://maas.obs.example.com/key?a=b":      "maas.obs.example.com",
		"obs.internal:9000":                         "obs.internal",
		"obs.example.com/":                          "obs.example.com",
		"obs.example.com":                           "obs.example.com",
		"":                                          "",
	}
	for in, want := range cases {
		if got := normalizeHost(in); got != want {
			t.Errorf("normalizeHost(%q)=%q want %q", in, got, want)
		}
	}
}

func TestOwnOBSHostAndIsOwnOBSURL(t *testing.T) {
	s := system_setting.GetMediaStorageSettings()
	origEnabled, origEndpoint, origBucket := s.Enabled, s.Endpoint, s.Bucket
	defer func() { s.Enabled, s.Endpoint, s.Bucket = origEnabled, origEndpoint, origBucket }()

	s.Endpoint = "https://obs.cn-central-221.ovaijisuan.com"
	s.Bucket = "maas-obs-output"

	// 未启用 → 授信 host 为空（关掉媒体存储即撤销豁免）
	s.Enabled = false
	if h := OwnOBSHost(); h != "" {
		t.Errorf("OwnOBSHost disabled = %q, want empty", h)
	}

	// 启用 → 精确的 <bucket>.<endpointHost>
	s.Enabled = true
	want := "maas-obs-output.obs.cn-central-221.ovaijisuan.com"
	if h := OwnOBSHost(); h != want {
		t.Errorf("OwnOBSHost = %q, want %q", h, want)
	}

	// virtual-hosted 我方对象 URL 命中
	if !IsOwnOBSURL("https://maas-obs-output.obs.cn-central-221.ovaijisuan.com/t2i/x.png?sig=1") {
		t.Error("virtual-hosted own OBS url should match")
	}
	// 第三方 host 不命中
	if IsOwnOBSURL("https://oaidalleapiprodscus.blob.core.windows.net/x") {
		t.Error("third-party host must not match")
	}
	// 追加后缀的仿冒 host 不命中（精确匹配，非子串）
	if IsOwnOBSURL("https://maas-obs-output.obs.cn-central-221.ovaijisuan.com.evil.com/x") {
		t.Error("suffix-appended host must not match")
	}
}
