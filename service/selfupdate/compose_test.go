package selfupdate

import (
	"crypto/sha256"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCleanContainerComposePath(t *testing.T) {
	for _, tc := range []struct {
		name string
		path string
		want string
		ok   bool
	}{
		{name: "yaml path", path: " /app/docker-compose.yaml ", want: "/app/docker-compose.yaml", ok: true},
		{name: "yml path", path: "/app/compose.yml", want: "/app/compose.yml", ok: true},
		{name: "relative", path: "compose.yaml"},
		{name: "directory", path: "/app"},
		{name: "wrong extension", path: "/app/compose.json"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := cleanContainerComposePath(tc.path)
			if tc.ok {
				require.NoError(t, err)
				assert.Equal(t, tc.want, got)
				return
			}
			require.Error(t, err)
		})
	}
}

func TestResolveComposeService(t *testing.T) {
	labels := map[string]string{composeServiceLabel: "new-api"}
	got, err := resolveComposeService(labels, "new-api")
	require.NoError(t, err)
	assert.Equal(t, "new-api", got)

	got, err = resolveComposeService(nil, "new-api")
	require.NoError(t, err)
	assert.Equal(t, "new-api", got)

	_, err = resolveComposeService(labels, "other")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "does not match")

	_, err = resolveComposeService(nil, "../new-api")
	require.Error(t, err)
}

func TestHasNonEmptyEnv(t *testing.T) {
	assert.False(t, hasNonEmptyEnv(nil, "NEWAPI_DOCKER_IMAGE"))
	assert.False(t, hasNonEmptyEnv([]string{
		"NEWAPI_DOCKER_IMAGE=",
		"NEWAPI_DOCKER_IMAGE= \t ",
		"NEWAPI_DOCKER_IMAGE_EXTRA=local/new-api:v2",
	}, "NEWAPI_DOCKER_IMAGE"))
	assert.True(t, hasNonEmptyEnv([]string{"NEWAPI_DOCKER_IMAGE=local/new-api:v2"}, "NEWAPI_DOCKER_IMAGE"))
}

func TestMapContainerPathToBindSource(t *testing.T) {
	mounts := []containerMount{
		{Type: "bind", Source: "/srv/app", Destination: "/app", RW: true},
		{Type: "bind", Source: "/srv/app/config", Destination: "/app/config", RW: true},
	}
	got, err := mapContainerPathToBindSource("/app/config/docker-compose.yml", mounts)
	require.NoError(t, err)
	assert.Equal(t, "/srv/app/config/docker-compose.yml", got)

	for _, tc := range []struct {
		name  string
		path  string
		mount []containerMount
	}{
		{name: "prefix collision", path: "/app2/docker-compose.yml", mount: mounts},
		{name: "read only bind", path: "/app/docker-compose.yml", mount: []containerMount{{Type: "bind", Source: "/srv/app", Destination: "/app", RW: false}}},
		{name: "more specific read only bind shadows writable parent", path: "/app/config/docker-compose.yml", mount: []containerMount{
			{Type: "bind", Source: "/srv/app", Destination: "/app", RW: true},
			{Type: "bind", Source: "/srv/config", Destination: "/app/config", RW: false},
		}},
		{name: "more specific volume shadows writable parent", path: "/app/config/docker-compose.yml", mount: []containerMount{
			{Type: "bind", Source: "/srv/app", Destination: "/app", RW: true},
			{Type: "volume", Source: "compose-data", Destination: "/app/config", RW: true},
		}},
		{name: "more specific file bind shadows writable parent", path: "/app/config/docker-compose.yml", mount: []containerMount{
			{Type: "bind", Source: "/srv/app", Destination: "/app", RW: true},
			{Type: "bind", Source: "/srv/compose.yaml", Destination: "/app/config/docker-compose.yml", RW: false},
		}},
		{name: "duplicate destination writable and read only", path: "/app/docker-compose.yml", mount: []containerMount{
			{Type: "bind", Source: "/srv/writable", Destination: "/app", RW: true},
			{Type: "bind", Source: "/srv/read-only", Destination: "/app", RW: false},
		}},
		{name: "duplicate destination different writable sources", path: "/app/docker-compose.yml", mount: []containerMount{
			{Type: "bind", Source: "/srv/first", Destination: "/app", RW: true},
			{Type: "bind", Source: "/srv/second", Destination: "/app", RW: true},
		}},
		{name: "named volume", path: "/app/docker-compose.yml", mount: []containerMount{{Type: "volume", Source: "compose-data", Destination: "/app", RW: true}}},
		{name: "relative host source", path: "/app/docker-compose.yml", mount: []containerMount{{Type: "bind", Source: "relative", Destination: "/app", RW: true}}},
		{name: "host root bind", path: "/app/subdir/docker-compose.yml", mount: []containerMount{{Type: "bind", Source: "/", Destination: "/app", RW: true}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := mapContainerPathToBindSource(tc.path, tc.mount)
			require.Error(t, err)
		})
	}
}

func TestIsSafeImageReference(t *testing.T) {
	for _, image := range []string{
		"local/new-api:v2",
		"registry.example.com:5000/team/new-api:v2.0.0-th.1",
		"local/new-api@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
	} {
		t.Run("accept "+image, func(t *testing.T) {
			assert.True(t, isSafeImageReference(image))
		})
	}

	for _, image := range []string{
		"",
		" local/new-api:v2 ",
		"local/New-API:v2",
		"local/new api:v2",
		"local/new-api:v2\nother/image:v1",
		"local/new-api@sha256:short",
		"https://registry.example.com/new-api:v2",
	} {
		t.Run("reject "+strings.ReplaceAll(image, "\n", "-"), func(t *testing.T) {
			assert.False(t, isSafeImageReference(image))
		})
	}
}

func TestRenderComposeImage(t *testing.T) {
	content := []byte("services:\n  new-api:\n    image: old/image:latest\n    environment:\n      - FOO=bar\n")
	out, err := renderComposeImage(content, "new-api", "local/new-api:v2")
	require.NoError(t, err)
	assert.Contains(t, string(out), "image: local/new-api:v2")
	assert.Contains(t, string(out), "FOO=bar")

	for _, tc := range []struct {
		name    string
		content string
	}{
		{name: "multiple documents", content: "services: {}\n---\nservices: {}\n"},
		{name: "duplicate services", content: "services: {}\nservices: {}\n"},
		{name: "duplicate image", content: "services:\n  new-api:\n    image: old\n    image: new\n"},
		{name: "alias image", content: "base: &image old\nservices:\n  new-api:\n    image: *image\n"},
		{name: "anchored image", content: "services:\n  new-api:\n    image: &image old\n"},
		{name: "interpolated image", content: "services:\n  new-api:\n    image: ${NEWAPI_IMAGE}\n"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := renderComposeImage([]byte(tc.content), "new-api", "local/new-api:v2")
			require.Error(t, err)
		})
	}
}

func TestApplyComposeImageRestoreAndFinalize(t *testing.T) {
	dir := t.TempDir()
	filePath := filepath.Join(dir, "compose.yaml")
	original := []byte("services:\n  new-api:\n    image: old/image:latest\n")
	require.NoError(t, os.WriteFile(filePath, original, 0o640))
	originalInfo, err := os.Stat(filePath)
	require.NoError(t, err)
	originalPerm := originalInfo.Mode().Perm()
	hash := sha256.Sum256(original)

	backup, err := applyComposeImage(filePath, "new-api", "local/new-api:v2", hash)
	require.NoError(t, err)
	require.NotNil(t, backup)
	assert.FileExists(t, backup.backupPath)
	changed, err := os.ReadFile(filePath)
	require.NoError(t, err)
	assert.Contains(t, string(changed), "local/new-api:v2")
	info, err := os.Stat(filePath)
	require.NoError(t, err)
	assert.Equal(t, originalPerm, info.Mode().Perm())

	require.NoError(t, backup.Restore())
	restored, err := os.ReadFile(filePath)
	require.NoError(t, err)
	assert.Equal(t, original, restored)
	assert.NoFileExists(t, backup.backupPath)

	backup, err = applyComposeImage(filePath, "new-api", "local/new-api:v3", hash)
	require.NoError(t, err)
	require.NoError(t, backup.Finalize())
	assert.NoFileExists(t, backup.backupPath)
}

func TestApplyComposeImageRejectsChangedFileAndSymlink(t *testing.T) {
	dir := t.TempDir()
	filePath := filepath.Join(dir, "compose.yaml")
	original := []byte("services:\n  new-api:\n    image: old/image:latest\n")
	require.NoError(t, os.WriteFile(filePath, original, 0o600))
	hash := sha256.Sum256([]byte("other content"))

	_, err := applyComposeImage(filePath, "new-api", "local/new-api:v2", hash)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "changed after update preparation")

	linkPath := filepath.Join(dir, "compose-link.yaml")
	if err := os.Symlink(filePath, linkPath); err != nil {
		t.Skipf("symlinks unavailable: %v", err)
	}
	_, _, err = readRegularComposeFile(linkPath)
	require.Error(t, err)
	assert.True(t, strings.Contains(err.Error(), "symbolic links"))

	linkedDir := filepath.Join(dir, "linked-dir")
	if err := os.Symlink(dir, linkedDir); err != nil {
		t.Skipf("directory symlinks unavailable: %v", err)
	}
	_, _, err = readRegularComposeFile(filepath.Join(linkedDir, "compose.yaml"))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "symbolic links")
}

func TestComposePreparedFromSpec(t *testing.T) {
	hash := sha256.Sum256([]byte("compose"))
	prepared, err := composePreparedFromSpec(composeSyncSpec{
		ComposeFile:    "compose.yaml",
		ComposeService: "new-api",
		ExpectedSHA256: stringHash(hash),
	})
	require.NoError(t, err)
	assert.Equal(t, hash, prepared.originalHash)

	_, err = composePreparedFromSpec(composeSyncSpec{
		ComposeFile:    "../compose.yaml",
		ComposeService: "new-api",
		ExpectedSHA256: stringHash(hash),
	})
	require.Error(t, err)
}

func stringHash(hash [sha256.Size]byte) string {
	const hex = "0123456789abcdef"
	out := make([]byte, len(hash)*2)
	for i, b := range hash {
		out[i*2] = hex[b>>4]
		out[i*2+1] = hex[b&0x0f]
	}
	return string(out)
}
