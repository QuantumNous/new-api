package selfupdate

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

const (
	composeServiceLabel = "com.docker.compose.service"
	composeHelperDir    = "/new-api-compose"
	maxComposeFileSize  = 8 << 20
)

// ComposeSyncOptions describes an explicitly enabled Compose image declaration
// update. ComposeFile is a path inside the running container and must be backed
// by one of the container's existing writable bind mounts.
type ComposeSyncOptions struct {
	ComposeFile          string
	ComposeService       string
	RejectDockerImageEnv bool
}

// composeSyncSpec is passed to the isolated Docker update helper. All paths in
// this structure are relative to composeHelperDir, never arbitrary host paths.
type composeSyncSpec struct {
	ComposeFile    string `json:"compose_file"`
	ComposeService string `json:"compose_service"`
	ExpectedSHA256 string `json:"expected_sha256"`
}

// composePreparedUpdate holds validated Compose metadata. It is prepared while
// the current container is still running, then revalidated in the helper before
// it writes the mounted host file.
type composePreparedUpdate struct {
	hostDir      string
	spec         composeSyncSpec
	originalHash [sha256.Size]byte

	// mountedDir is normally empty, which resolves to composeHelperDir. Keeping
	// it separate from hostDir ensures the helper never receives a host path.
	mountedDir string
}

// composeBackup represents a successfully swapped Compose file. The backup is
// retained until the replacement container transition has completed.
type composeBackup struct {
	path       string
	backupPath string
}

func prepareComposeSync(ci *ContainerInspect, options *ComposeSyncOptions, targetImage string) (*composePreparedUpdate, error) {
	if options == nil {
		return nil, nil
	}
	if ci == nil {
		return nil, errors.New("compose sync: container inspect is required")
	}
	if !isSafeImageReference(targetImage) {
		return nil, errors.New("compose sync: target image is invalid")
	}
	if options.RejectDockerImageEnv && hasNonEmptyEnv(ci.Config.Env, "NEWAPI_DOCKER_IMAGE") {
		return nil, errors.New("compose sync: NEWAPI_DOCKER_IMAGE must be removed before synchronizing a release image")
	}

	containerPath, err := cleanContainerComposePath(options.ComposeFile)
	if err != nil {
		return nil, err
	}
	if err := rejectSymlinkPathComponents(containerPath); err != nil {
		return nil, err
	}
	serviceName, err := resolveComposeService(ci.Config.Labels, options.ComposeService)
	if err != nil {
		return nil, err
	}
	hostPath, err := mapContainerPathToBindSource(containerPath, ci.Mounts)
	if err != nil {
		return nil, err
	}

	_, content, err := readRegularComposeFile(containerPath)
	if err != nil {
		return nil, err
	}
	if _, err := renderComposeImage(content, serviceName, targetImage); err != nil {
		return nil, fmt.Errorf("compose sync: validate compose file: %w", err)
	}

	hash := sha256.Sum256(content)
	return &composePreparedUpdate{
		hostDir: path.Dir(hostPath),
		spec: composeSyncSpec{
			ComposeFile:    path.Base(hostPath),
			ComposeService: serviceName,
			ExpectedSHA256: hex.EncodeToString(hash[:]),
		},
		originalHash: hash,
	}, nil
}

func cleanContainerComposePath(raw string) (string, error) {
	containerPath := path.Clean(strings.TrimSpace(raw))
	if !path.IsAbs(containerPath) || containerPath == "/" || !isComposeFile(containerPath) {
		return "", errors.New("compose sync: NEWAPI_COMPOSE_FILE must be an absolute .yml or .yaml path inside the container")
	}
	return containerPath, nil
}

func resolveComposeService(labels map[string]string, configured string) (string, error) {
	labelService := strings.TrimSpace(labels[composeServiceLabel])
	configured = strings.TrimSpace(configured)
	if labelService != "" && configured != "" && labelService != configured {
		return "", errors.New("compose sync: NEWAPI_COMPOSE_SERVICE does not match the Docker Compose service label")
	}
	serviceName := labelService
	if serviceName == "" {
		serviceName = configured
	}
	if !isSafeComposeService(serviceName) {
		return "", errors.New("compose sync: Docker Compose service label or NEWAPI_COMPOSE_SERVICE is required")
	}
	return serviceName, nil
}

func mapContainerPathToBindSource(containerPath string, mounts []containerMount) (string, error) {
	var selected *containerMount
	for i := range mounts {
		mount := &mounts[i]
		destination := path.Clean(strings.TrimSpace(mount.Destination))
		if !path.IsAbs(destination) || !containerPathIsWithin(containerPath, destination) {
			continue
		}
		if selected != nil && destination == path.Clean(selected.Destination) {
			return "", errors.New("compose sync: multiple mounts have the same destination")
		}
		if selected == nil || len(destination) > len(path.Clean(selected.Destination)) {
			selected = mount
		}
	}
	if selected == nil {
		return "", errors.New("compose sync: NEWAPI_COMPOSE_FILE must be inside an existing writable bind mount")
	}
	if selected.Type != "bind" || !selected.RW || strings.TrimSpace(selected.Source) == "" {
		return "", errors.New("compose sync: the most specific mount containing NEWAPI_COMPOSE_FILE must be a writable bind mount")
	}

	destination := path.Clean(selected.Destination)
	rel := strings.TrimPrefix(containerPath, destination)
	rel = strings.TrimPrefix(rel, "/")
	if rel == "" || rel == "." || strings.HasPrefix(rel, "../") || path.IsAbs(rel) {
		return "", errors.New("compose sync: compose file escapes its bind mount")
	}

	hostSource := path.Clean(selected.Source)
	if !path.IsAbs(hostSource) {
		return "", errors.New("compose sync: bind source must be an absolute host path")
	}
	if hostSource == "/" {
		return "", errors.New("compose sync: refusing to synchronize through a host root bind mount")
	}
	hostPath := hostSource
	if rel != "." {
		hostPath = path.Join(hostSource, rel)
	}
	if path.Dir(hostPath) == "/" {
		return "", errors.New("compose sync: refusing to synchronize a compose file in the host root directory")
	}
	return hostPath, nil
}

func containerPathIsWithin(containerPath, destination string) bool {
	if destination == "/" {
		return path.IsAbs(containerPath)
	}
	return containerPath == destination || strings.HasPrefix(containerPath, destination+"/")
}

func isComposeFile(filePath string) bool {
	ext := strings.ToLower(path.Ext(filePath))
	return ext == ".yml" || ext == ".yaml"
}

func isSafeComposeService(service string) bool {
	service = strings.TrimSpace(service)
	return service != "" && !strings.ContainsAny(service, "/\\\x00") && service != "." && service != ".."
}

var dockerImageReferencePattern = regexp.MustCompile(`^[a-z0-9]+(?:[._-][a-z0-9]+)*(?::[0-9]+)?(?:/[a-z0-9]+(?:[._-][a-z0-9]+)*)*(?::[A-Za-z0-9_][A-Za-z0-9_.-]{0,127})?(?:@sha256:[a-f0-9]{64})?$`)

func isSafeImageReference(image string) bool {
	return image == strings.TrimSpace(image) && dockerImageReferencePattern.MatchString(image)
}

func hasNonEmptyEnv(env []string, key string) bool {
	prefix := key + "="
	for _, value := range env {
		if strings.HasPrefix(value, prefix) && strings.TrimSpace(strings.TrimPrefix(value, prefix)) != "" {
			return true
		}
	}
	return false
}

func composePreparedFromSpec(spec composeSyncSpec) (*composePreparedUpdate, error) {
	if path.Base(spec.ComposeFile) != spec.ComposeFile || !isComposeFile(spec.ComposeFile) || !isSafeComposeService(spec.ComposeService) {
		return nil, errors.New("compose sync: invalid helper specification")
	}
	hash, err := hex.DecodeString(spec.ExpectedSHA256)
	if err != nil || len(hash) != sha256.Size {
		return nil, errors.New("compose sync: invalid helper checksum")
	}
	var originalHash [sha256.Size]byte
	copy(originalHash[:], hash)
	return &composePreparedUpdate{spec: spec, originalHash: originalHash}, nil
}

func (prepared *composePreparedUpdate) mountedComposePath() string {
	if prepared == nil {
		return ""
	}
	mountedDir := prepared.mountedDir
	if mountedDir == "" {
		mountedDir = composeHelperDir
	}
	return path.Join(mountedDir, prepared.spec.ComposeFile)
}

func (prepared *composePreparedUpdate) validateMounted(targetImage string) error {
	if prepared == nil {
		return nil
	}
	if !isSafeImageReference(targetImage) {
		return errors.New("compose sync: target image is invalid")
	}
	mountedPath := prepared.mountedComposePath()
	_, original, err := readRegularComposeFile(mountedPath)
	if err != nil {
		return err
	}
	if sha256.Sum256(original) != prepared.originalHash {
		return errors.New("compose sync: compose file changed after update preparation")
	}
	if _, err := renderComposeImage(original, prepared.spec.ComposeService, targetImage); err != nil {
		return err
	}
	return nil
}

func (prepared *composePreparedUpdate) applyMounted(targetImage string) (*composeBackup, error) {
	if prepared == nil {
		return nil, nil
	}
	if err := prepared.validateMounted(targetImage); err != nil {
		return nil, err
	}
	mountedPath := prepared.mountedComposePath()
	return applyComposeImage(mountedPath, prepared.spec.ComposeService, targetImage, prepared.originalHash)
}

func rejectSymlinkPathComponents(filePath string) error {
	cleaned := filepath.Clean(filePath)
	volume := filepath.VolumeName(cleaned)
	current := volume + string(filepath.Separator)
	if volume == "" && !filepath.IsAbs(cleaned) {
		current = ""
	}
	remaining := strings.TrimPrefix(cleaned, volume)
	remaining = strings.TrimLeft(remaining, `/\\`)
	for _, component := range strings.FieldsFunc(remaining, func(r rune) bool {
		return r == '/' || r == '\\'
	}) {
		current = filepath.Join(current, component)
		info, err := os.Lstat(current)
		if err != nil {
			return fmt.Errorf("compose sync: inspect compose path component: %w", err)
		}
		if info.Mode()&os.ModeSymlink != 0 {
			return errors.New("compose sync: compose file path must not contain symbolic links")
		}
	}
	return nil
}

func renderComposeImage(content []byte, serviceName, targetImage string) ([]byte, error) {
	decoder := yaml.NewDecoder(bytes.NewReader(content))
	var document yaml.Node
	if err := decoder.Decode(&document); err != nil {
		return nil, fmt.Errorf("parse YAML: %w", err)
	}
	var extra yaml.Node
	if err := decoder.Decode(&extra); err != io.EOF {
		if err == nil {
			return nil, errors.New("multiple YAML documents are not supported")
		}
		return nil, fmt.Errorf("parse YAML: %w", err)
	}
	if document.Kind != yaml.DocumentNode || len(document.Content) != 1 || document.Content[0].Kind != yaml.MappingNode {
		return nil, errors.New("compose root must be a mapping")
	}

	root := document.Content[0]
	services, err := uniqueMappingValue(root, "services")
	if err != nil {
		return nil, err
	}
	if services == nil || services.Kind != yaml.MappingNode {
		return nil, errors.New("services must be a mapping")
	}
	service, err := uniqueMappingValue(services, serviceName)
	if err != nil {
		return nil, err
	}
	if service == nil || service.Kind != yaml.MappingNode {
		return nil, fmt.Errorf("service %q not found", serviceName)
	}
	image, err := uniqueMappingValue(service, "image")
	if err != nil {
		return nil, err
	}
	if image == nil {
		return nil, fmt.Errorf("service %q has no image declaration", serviceName)
	}
	if image.Kind != yaml.ScalarNode || image.Alias != nil || image.Anchor != "" || strings.Contains(image.Value, "${") {
		return nil, fmt.Errorf("service %q image must be a literal scalar", serviceName)
	}
	if image.Value == targetImage {
		return append([]byte(nil), content...), nil
	}
	image.Value = targetImage

	var out bytes.Buffer
	encoder := yaml.NewEncoder(&out)
	encoder.SetIndent(2)
	if err := encoder.Encode(&document); err != nil {
		return nil, fmt.Errorf("encode YAML: %w", err)
	}
	if err := encoder.Close(); err != nil {
		return nil, fmt.Errorf("finalize YAML: %w", err)
	}
	return out.Bytes(), nil
}

func uniqueMappingValue(mapping *yaml.Node, key string) (*yaml.Node, error) {
	if mapping == nil || mapping.Kind != yaml.MappingNode {
		return nil, errors.New("expected YAML mapping")
	}
	var value *yaml.Node
	for i := 0; i+1 < len(mapping.Content); i += 2 {
		if mapping.Content[i].Value != key {
			continue
		}
		if value != nil {
			return nil, fmt.Errorf("duplicate key %q", key)
		}
		value = mapping.Content[i+1]
	}
	return value, nil
}

func applyComposeImage(filePath, serviceName, targetImage string, expectedHash [sha256.Size]byte) (*composeBackup, error) {
	info, original, err := readRegularComposeFile(filePath)
	if err != nil {
		return nil, err
	}
	if sha256.Sum256(original) != expectedHash {
		return nil, errors.New("compose sync: compose file changed after update preparation")
	}
	replacement, err := renderComposeImage(original, serviceName, targetImage)
	if err != nil {
		return nil, err
	}
	if bytes.Equal(original, replacement) {
		return &composeBackup{path: filePath}, nil
	}

	dir := filepath.Dir(filePath)
	temp, err := os.CreateTemp(dir, ".new-api-compose-*")
	if err != nil {
		return nil, fmt.Errorf("compose sync: create compose temp file: %w", err)
	}
	tempPath := temp.Name()
	cleanTemp := true
	defer func() {
		if cleanTemp {
			_ = os.Remove(tempPath)
		}
	}()
	if err := temp.Chmod(info.Mode().Perm()); err != nil {
		_ = temp.Close()
		return nil, fmt.Errorf("compose sync: set compose temp mode: %w", err)
	}
	if _, err := temp.Write(replacement); err != nil {
		_ = temp.Close()
		return nil, fmt.Errorf("compose sync: write compose temp file: %w", err)
	}
	if err := temp.Sync(); err != nil {
		_ = temp.Close()
		return nil, fmt.Errorf("compose sync: sync compose temp file: %w", err)
	}
	if err := temp.Close(); err != nil {
		return nil, fmt.Errorf("compose sync: close compose temp file: %w", err)
	}

	backupPath := filepath.Join(dir, fmt.Sprintf(".%s.new-api-update-%d.backup", filepath.Base(filePath), time.Now().UnixNano()))
	if err := os.Rename(filePath, backupPath); err != nil {
		return nil, fmt.Errorf("compose sync: backup compose file: %w", err)
	}
	if err := os.Rename(tempPath, filePath); err != nil {
		restoreErr := os.Rename(backupPath, filePath)
		if restoreErr != nil {
			return nil, fmt.Errorf("compose sync: replace compose file: %v; restore backup: %w", err, restoreErr)
		}
		return nil, fmt.Errorf("compose sync: replace compose file: %w", err)
	}
	cleanTemp = false
	backup := &composeBackup{path: filePath, backupPath: backupPath}
	if err := syncDirectory(dir); err != nil {
		if restoreErr := backup.Restore(); restoreErr != nil {
			return nil, fmt.Errorf("compose sync: sync compose directory: %v; restore backup: %w", err, restoreErr)
		}
		return nil, fmt.Errorf("compose sync: sync compose directory: %w", err)
	}
	return backup, nil
}

func (backup *composeBackup) Restore() error {
	if backup == nil || backup.backupPath == "" {
		return nil
	}
	if err := os.Remove(backup.path); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("compose sync: remove replacement compose file: %w", err)
	}
	if err := os.Rename(backup.backupPath, backup.path); err != nil {
		return fmt.Errorf("compose sync: restore compose backup: %w", err)
	}
	return syncDirectory(filepath.Dir(backup.path))
}

func (backup *composeBackup) Finalize() error {
	if backup == nil || backup.backupPath == "" {
		return nil
	}
	if err := os.Remove(backup.backupPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("compose sync: remove compose backup: %w", err)
	}
	return syncDirectory(filepath.Dir(backup.path))
}

func syncDirectory(dir string) error {
	if runtime.GOOS == "windows" {
		return nil
	}
	f, err := os.Open(dir)
	if err != nil {
		return err
	}
	defer f.Close()
	return f.Sync()
}
