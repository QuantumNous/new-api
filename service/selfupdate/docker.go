package selfupdate

import (
	"archive/tar"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// ErrAlreadyUpToDate is returned by RecreateSelf when the pulled image digest
// matches the currently running image. Task 5 may also reuse this sentinel.
var ErrAlreadyUpToDate = errors.New("already up to date")

// dockerAPIVersion is the Docker Engine API version prefix used on all paths.
const dockerAPIVersion = "/v1.41"

// ----------------------------------------------------------------------------
// Low-level transport helpers
// ----------------------------------------------------------------------------

// parseDockerHost splits a Docker host URI into (network, address).
//
//	"unix:///var/run/docker.sock"        → ("unix", "/var/run/docker.sock")
//	"npipe:////./pipe/docker_engine"     → ("npipe", "//./pipe/docker_engine")
//	"tcp://127.0.0.1:2375"              → ("tcp", "127.0.0.1:2375")
//
// An empty or unrecognised string defaults to the Linux unix socket.
func parseDockerHost(hostStr string) (network, address string) {
	switch {
	case strings.HasPrefix(hostStr, "unix://"):
		return "unix", strings.TrimPrefix(hostStr, "unix://")
	case strings.HasPrefix(hostStr, "npipe://"):
		// npipe:////./pipe/… → //./pipe/…
		return "npipe", strings.TrimPrefix(hostStr, "npipe://")
	case strings.HasPrefix(hostStr, "tcp://"):
		return "tcp", strings.TrimPrefix(hostStr, "tcp://")
	default:
		return "unix", "/var/run/docker.sock"
	}
}

// splitImageTag splits an image reference into (name, tag).
//
//	"calciumion/new-api:latest"       → ("calciumion/new-api", "latest")
//	"alpine"                          → ("alpine", "latest")
//	"registry.example.com/img:v2"     → ("registry.example.com/img", "v2")
func splitImageTag(image string) (name, tag string) {
	// Handle digest references (sha256:…) – no separate tag.
	if idx := strings.LastIndex(image, "@"); idx != -1 {
		return image[:idx], ""
	}
	// The tag separator is the last colon that appears after any slash.
	lastSlash := strings.LastIndex(image, "/")
	lastColon := strings.LastIndex(image, ":")
	if lastColon > lastSlash {
		return image[:lastColon], image[lastColon+1:]
	}
	return image, "latest"
}

// newUnixHTTPClient builds an *http.Client that dials the given unix socket.
func newUnixHTTPClient(socketPath string) *http.Client {
	tr := &http.Transport{
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			return (&net.Dialer{}).DialContext(ctx, "unix", socketPath)
		},
	}
	return &http.Client{Transport: tr, Timeout: 0} // streaming: no global timeout
}

// ----------------------------------------------------------------------------
// Data types for Docker API responses
// ----------------------------------------------------------------------------

// ContainerInspect holds the subset of fields from GET /containers/{id}/json
// that are needed for self-inspect and recreate.
type ContainerInspect struct {
	ID    string `json:"Id"`
	Image string `json:"Image"` // image ID (sha256:…)
	Name  string `json:"Name"`  // "/name"
	Config struct {
		Image      string            `json:"Image"` // human reference (repo:tag)
		Env        []string          `json:"Env"`
		Cmd        []string          `json:"Cmd"`
		Entrypoint []string          `json:"Entrypoint"`
		Labels     map[string]string `json:"Labels"`
		WorkingDir string            `json:"WorkingDir"`
	} `json:"Config"`
	HostConfig json.RawMessage `json:"HostConfig"` // forwarded as-is to create
}

// containerCreateBody is used for POST /containers/create.
type containerCreateBody struct {
	Image      string            `json:"Image"`
	Env        []string          `json:"Env,omitempty"`
	Cmd        []string          `json:"Cmd,omitempty"`
	Entrypoint []string          `json:"Entrypoint,omitempty"`
	Labels     map[string]string `json:"Labels,omitempty"`
	WorkingDir string            `json:"WorkingDir,omitempty"`
	HostConfig json.RawMessage   `json:"HostConfig,omitempty"`
}

// imageInspect holds the Id field from GET /images/{name}/json.
type imageInspect struct {
	ID string `json:"Id"`
}

// createResponse holds the Id field from POST /containers/create response.
type createResponse struct {
	ID string `json:"Id"`
}

// ----------------------------------------------------------------------------
// engineClient – injectable do() for testability
// ----------------------------------------------------------------------------

// engineClient is the low-level Docker API client.
// The do field is injectable so tests can supply an httptest-backed function.
type engineClient struct {
	do   func(*http.Request) (*http.Response, error)
	base string // e.g. "http://docker/v1.41"
}

func (e *engineClient) request(ctx context.Context, method, path string, body io.Reader) (*http.Request, error) {
	return http.NewRequestWithContext(ctx, method, e.base+path, body)
}

func (e *engineClient) call(req *http.Request) (*http.Response, error) {
	return e.do(req)
}

// drain reads and discards the response body, then closes it.
func drain(resp *http.Response) {
	if resp != nil && resp.Body != nil {
		_, _ = io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
	}
}

// httpError reads up to 512 bytes from resp.Body and returns a formatted error.
// It also closes resp.Body.
func httpError(action string, resp *http.Response) error {
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
	resp.Body.Close()
	return fmt.Errorf("docker %s: HTTP %d: %s", action, resp.StatusCode, strings.TrimSpace(string(body)))
}

// ----------------------------------------------------------------------------
// DockerEngine interface
// ----------------------------------------------------------------------------

// DockerEngine is the interface for Docker Engine operations used by self-update.
type DockerEngine interface {
	// Ping checks that the Docker socket is reachable (GET /_ping).
	Ping(ctx context.Context) error

	// InspectSelf returns container metadata for the running container.
	InspectSelf(ctx context.Context) (*ContainerInspect, error)

	// PullImage pulls the given image reference, streaming progress until done.
	PullImage(ctx context.Context, image string) error

	// RecreateSelf stops the current container, creates a new one from image,
	// starts it, and removes the old container.
	// Returns ErrAlreadyUpToDate when the pulled image digest matches the
	// currently running image.
	RecreateSelf(ctx context.Context, image string) error

	// BuildImageWithBinary creates targetImage by copying binaryPath to /new-api
	// inside a temporary container based on baseImage, then committing it.
	// Used when updating from a GitHub Release binary while running in Docker.
	BuildImageWithBinary(ctx context.Context, baseImage, binaryPath, targetImage string) error

	// RecreateSelfLocal recreates the current container onto an already-local
	// image reference without pulling from a registry.
	RecreateSelfLocal(ctx context.Context, image string) error
}

// NewDockerEngine creates a production DockerEngine that communicates over the
// given dockerHost URI (e.g. "unix:///var/run/docker.sock").
func NewDockerEngine(dockerHost string) (DockerEngine, error) {
	network, addr := parseDockerHost(dockerHost)
	var httpClient *http.Client
	switch network {
	case "unix":
		httpClient = newUnixHTTPClient(addr)
	default:
		// tcp / npipe: plain http client; caller ensures addr is accessible.
		httpClient = &http.Client{Timeout: 0}
	}
	base := "http://docker" + dockerAPIVersion
	return &dockerEngineImpl{
		client: &engineClient{
			do:   httpClient.Do,
			base: base,
		},
	}, nil
}

// ----------------------------------------------------------------------------
// dockerEngineImpl – production implementation
// ----------------------------------------------------------------------------

type dockerEngineImpl struct {
	client *engineClient
}

// Ping issues GET /_ping.
func (d *dockerEngineImpl) Ping(ctx context.Context) error {
	req, err := d.client.request(ctx, http.MethodGet, "/_ping", nil)
	if err != nil {
		return err
	}
	resp, err := d.client.call(req)
	if err != nil {
		return err
	}
	defer drain(resp)
	if resp.StatusCode != http.StatusOK {
		return httpError("ping", resp)
	}
	return nil
}

// selfContainerID resolves the running container's short ID.
//
// Strategy:
//  1. HOSTNAME env var (Docker sets this to the short container ID).
//  2. /proc/1/cpuset last path segment (Linux cgroups).
func selfContainerID() (string, error) {
	if h := os.Getenv("HOSTNAME"); h != "" {
		return h, nil
	}
	data, err := os.ReadFile("/proc/1/cpuset")
	if err != nil {
		return "", fmt.Errorf("cannot determine container ID: %w", err)
	}
	line := strings.TrimSpace(string(data))
	parts := strings.Split(line, "/")
	last := parts[len(parts)-1]
	if len(last) < 12 {
		return "", fmt.Errorf("cannot parse container ID from cpuset %q", line)
	}
	return last[:12], nil
}

// InspectSelf resolves the running container ID then calls inspectContainer.
func (d *dockerEngineImpl) InspectSelf(ctx context.Context) (*ContainerInspect, error) {
	id, err := selfContainerID()
	if err != nil {
		return nil, err
	}
	return d.inspectContainer(ctx, id)
}

// inspectContainer calls GET /containers/{id}/json.
func (d *dockerEngineImpl) inspectContainer(ctx context.Context, id string) (*ContainerInspect, error) {
	req, err := d.client.request(ctx, http.MethodGet, "/containers/"+id+"/json", nil)
	if err != nil {
		return nil, err
	}
	resp, err := d.client.call(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, httpError("inspect container "+id, resp)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var ci ContainerInspect
	if err := common.Unmarshal(body, &ci); err != nil {
		return nil, err
	}
	return &ci, nil
}

// inspectImage calls GET /images/{name}/json and returns the image ID.
func (d *dockerEngineImpl) inspectImage(ctx context.Context, name string) (string, error) {
	req, err := d.client.request(ctx, http.MethodGet, "/images/"+name+"/json", nil)
	if err != nil {
		return "", err
	}
	resp, err := d.client.call(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", httpError("inspect image "+name, resp)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	var ii imageInspect
	if err := common.Unmarshal(body, &ii); err != nil {
		return "", err
	}
	return ii.ID, nil
}

// PullImage calls POST /images/create?fromImage=<name>&tag=<tag> and drains
// the streaming progress response until EOF.
func (d *dockerEngineImpl) PullImage(ctx context.Context, image string) error {
	name, tag := splitImageTag(image)
	path := fmt.Sprintf("/images/create?fromImage=%s&tag=%s", name, tag)
	req, err := d.client.request(ctx, http.MethodPost, path, nil)
	if err != nil {
		return err
	}
	resp, err := d.client.call(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return httpError("pull image "+image, resp)
	}
	// Drain streaming JSON progress until EOF.
	_, err = io.Copy(io.Discard, resp.Body)
	return err
}

// RecreateSelf implements the full recreate algorithm described in the brief.
func (d *dockerEngineImpl) RecreateSelf(ctx context.Context, image string) error {
	// 1. Inspect current container.
	ci, err := d.InspectSelf(ctx)
	if err != nil {
		return fmt.Errorf("inspect self: %w", err)
	}
	oldID := ci.ID
	name := strings.TrimPrefix(ci.Name, "/")
	targetImage := image
	if targetImage == "" {
		targetImage = ci.Config.Image
	}

	// 2. Record image digest before pull.
	idBefore, _ := d.inspectImage(ctx, targetImage)

	// 3. Pull new image.
	if err := d.PullImage(ctx, targetImage); err != nil {
		return fmt.Errorf("pull image: %w", err)
	}

	// 4. Compare image digest after pull.
	idAfter, err := d.inspectImage(ctx, targetImage)
	if err != nil {
		return fmt.Errorf("inspect image after pull: %w", err)
	}
	if idBefore != "" && idBefore == idAfter {
		return ErrAlreadyUpToDate
	}

	// 5. Stop old container (best-effort; ignore already-stopped errors).
	_ = d.postEmpty(ctx, "/containers/"+oldID+"/stop?t=10")

	// 6. Rename old container.
	oldName := name + "-updating-old"
	if err := d.renameContainer(ctx, oldID, oldName); err != nil {
		return fmt.Errorf("rename old container: %w", err)
	}

	// rollback: try rename old back + restart it.
	rollback := func() {
		_ = d.renameContainer(ctx, oldID, name)
		_ = d.postEmpty(ctx, "/containers/"+oldID+"/start")
	}

	// 7. Create new container with reconstructed body.
	body := containerCreateBody{
		Image:      targetImage,
		Env:        ci.Config.Env,
		Cmd:        ci.Config.Cmd,
		Entrypoint: ci.Config.Entrypoint,
		Labels:     ci.Config.Labels,
		WorkingDir: ci.Config.WorkingDir,
		HostConfig: ci.HostConfig,
	}
	bodyBytes, err := common.Marshal(body)
	if err != nil {
		rollback()
		return fmt.Errorf("marshal create body: %w", err)
	}
	newContainerID, err := d.createContainer(ctx, name, bodyBytes)
	if err != nil {
		rollback()
		return fmt.Errorf("create container: %w", err)
	}

	// 8. Start new container.
	if err := d.postEmpty(ctx, "/containers/"+newContainerID+"/start"); err != nil {
		_ = d.deleteContainer(ctx, newContainerID)
		rollback()
		return fmt.Errorf("start new container: %w", err)
	}

	// 9. Remove old container (best-effort).
	_ = d.deleteContainer(ctx, oldID)
	return nil
}

// postEmpty issues a POST with no request body and expects a 2xx response.
func (d *dockerEngineImpl) postEmpty(ctx context.Context, path string) error {
	req, err := d.client.request(ctx, http.MethodPost, path, nil)
	if err != nil {
		return err
	}
	resp, err := d.client.call(req)
	if err != nil {
		return err
	}
	defer drain(resp)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("POST %s: HTTP %d", path, resp.StatusCode)
	}
	return nil
}

// renameContainer issues POST /containers/{id}/rename?name={newName}.
func (d *dockerEngineImpl) renameContainer(ctx context.Context, id, newName string) error {
	return d.postEmpty(ctx, fmt.Sprintf("/containers/%s/rename?name=%s", id, newName))
}

// createContainer issues POST /containers/create?name={name} with JSON body
// and returns the new container ID.
func (d *dockerEngineImpl) createContainer(ctx context.Context, name string, bodyBytes []byte) (string, error) {
	req, err := d.client.request(ctx, http.MethodPost,
		fmt.Sprintf("/containers/create?name=%s", name),
		bytes.NewReader(bodyBytes),
	)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := d.client.call(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", httpError("create container", resp)
	}
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	var cr createResponse
	if err := common.Unmarshal(b, &cr); err != nil {
		return "", err
	}
	return cr.ID, nil
}

// deleteContainer issues DELETE /containers/{id}?force=true.
func (d *dockerEngineImpl) deleteContainer(ctx context.Context, id string) error {
	req, err := d.client.request(ctx, http.MethodDelete,
		fmt.Sprintf("/containers/%s?force=true", id), nil)
	if err != nil {
		return err
	}
	resp, err := d.client.call(req)
	if err != nil {
		return err
	}
	defer drain(resp)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("DELETE /containers/%s: HTTP %d", id, resp.StatusCode)
	}
	return nil
}

// BuildImageWithBinary creates targetImage from baseImage by replacing /new-api.
func (d *dockerEngineImpl) BuildImageWithBinary(ctx context.Context, baseImage, binaryPath, targetImage string) error {
	if baseImage == "" {
		return fmt.Errorf("base image is required")
	}
	if targetImage == "" {
		return fmt.Errorf("target image is required")
	}
	binData, err := os.ReadFile(binaryPath)
	if err != nil {
		return fmt.Errorf("read binary: %w", err)
	}
	if len(binData) == 0 {
		return fmt.Errorf("binary file is empty")
	}

	tmpName := fmt.Sprintf("new-api-update-tmp-%d", time.Now().UnixNano())
	createBody := containerCreateBody{
		Image: baseImage,
		Cmd:   []string{"sleep", "3600"},
	}
	bodyBytes, err := common.Marshal(createBody)
	if err != nil {
		return err
	}
	tmpID, err := d.createContainer(ctx, tmpName, bodyBytes)
	if err != nil {
		return fmt.Errorf("create temp container: %w", err)
	}
	defer func() { _ = d.deleteContainer(ctx, tmpID) }()

	tarBytes, err := tarOneFile("new-api", binData, 0o755)
	if err != nil {
		return err
	}
	if err := d.putContainerArchive(ctx, tmpID, "/", tarBytes); err != nil {
		return fmt.Errorf("copy binary into temp container: %w", err)
	}

	repo, tag := splitImageTag(targetImage)
	if err := d.commitContainer(ctx, tmpID, repo, tag); err != nil {
		return fmt.Errorf("commit image %s: %w", targetImage, err)
	}
	return nil
}

// RecreateSelfLocal recreates onto a local image without pulling.
func (d *dockerEngineImpl) RecreateSelfLocal(ctx context.Context, image string) error {
	ci, err := d.InspectSelf(ctx)
	if err != nil {
		return fmt.Errorf("inspect self: %w", err)
	}
	oldID := ci.ID
	name := strings.TrimPrefix(ci.Name, "/")
	targetImage := image
	if targetImage == "" {
		targetImage = ci.Config.Image
	}

	if _, err := d.inspectImage(ctx, targetImage); err != nil {
		return fmt.Errorf("local image %s not found: %w", targetImage, err)
	}

	_ = d.postEmpty(ctx, "/containers/"+oldID+"/stop?t=10")

	oldName := name + "-updating-old"
	if err := d.renameContainer(ctx, oldID, oldName); err != nil {
		return fmt.Errorf("rename old container: %w", err)
	}

	rollback := func() {
		_ = d.renameContainer(ctx, oldID, name)
		_ = d.postEmpty(ctx, "/containers/"+oldID+"/start")
	}

	// Preserve env but drop any stale NEWAPI_DOCKER_IMAGE so the next update
	// keeps using GitHub→local image flow instead of a pinned registry ref.
	env := filterEnv(ci.Config.Env, "NEWAPI_DOCKER_IMAGE")

	body := containerCreateBody{
		Image:      targetImage,
		Env:        env,
		Cmd:        ci.Config.Cmd,
		Entrypoint: ci.Config.Entrypoint,
		Labels:     ci.Config.Labels,
		WorkingDir: ci.Config.WorkingDir,
		HostConfig: ci.HostConfig,
	}
	bodyBytes, err := common.Marshal(body)
	if err != nil {
		rollback()
		return fmt.Errorf("marshal create body: %w", err)
	}
	newContainerID, err := d.createContainer(ctx, name, bodyBytes)
	if err != nil {
		rollback()
		return fmt.Errorf("create container: %w", err)
	}
	if err := d.postEmpty(ctx, "/containers/"+newContainerID+"/start"); err != nil {
		_ = d.deleteContainer(ctx, newContainerID)
		rollback()
		return fmt.Errorf("start new container: %w", err)
	}
	_ = d.deleteContainer(ctx, oldID)
	return nil
}

func filterEnv(env []string, dropKey string) []string {
	if len(env) == 0 {
		return env
	}
	prefix := dropKey + "="
	out := make([]string, 0, len(env))
	for _, e := range env {
		if strings.HasPrefix(e, prefix) {
			continue
		}
		out = append(out, e)
	}
	return out
}

func tarOneFile(name string, data []byte, mode int64) ([]byte, error) {
	var buf bytes.Buffer
	tw := tar.NewWriter(&buf)
	hdr := &tar.Header{
		Name: name,
		Mode: mode,
		Size: int64(len(data)),
	}
	if err := tw.WriteHeader(hdr); err != nil {
		return nil, err
	}
	if _, err := tw.Write(data); err != nil {
		return nil, err
	}
	if err := tw.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func (d *dockerEngineImpl) putContainerArchive(ctx context.Context, id, path string, tarBytes []byte) error {
	req, err := d.client.request(ctx, http.MethodPut,
		fmt.Sprintf("/containers/%s/archive?path=%s", id, path),
		bytes.NewReader(tarBytes),
	)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-tar")
	resp, err := d.client.call(req)
	if err != nil {
		return err
	}
	defer drain(resp)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return httpError("put archive", resp)
	}
	return nil
}

func (d *dockerEngineImpl) commitContainer(ctx context.Context, id, repo, tag string) error {
	path := fmt.Sprintf("/commit?container=%s&repo=%s&tag=%s", id, repo, tag)
	req, err := d.client.request(ctx, http.MethodPost, path, nil)
	if err != nil {
		return err
	}
	resp, err := d.client.call(req)
	if err != nil {
		return err
	}
	defer drain(resp)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return httpError("commit", resp)
	}
	return nil
}

// ----------------------------------------------------------------------------
// ProbeDocker – capability probe
// ----------------------------------------------------------------------------

// ProbeDocker checks whether Docker is available and populates DockerCapability.
// imageOverride replaces the image name from inspect when non-empty.
func ProbeDocker(ctx context.Context, host, imageOverride string) DockerCapability {
	eng, err := NewDockerEngine(host)
	if err != nil {
		return DockerCapability{Reason: "cannot create engine: " + err.Error()}
	}

	pingCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	if err := eng.Ping(pingCtx); err != nil {
		return DockerCapability{Reason: "socket unavailable: " + err.Error()}
	}

	cap := DockerCapability{SocketAvailable: true}

	inspectCtx, cancel2 := context.WithTimeout(ctx, 5*time.Second)
	defer cancel2()
	ci, err := eng.InspectSelf(inspectCtx)
	if err != nil {
		cap.Reason = "socket available but cannot inspect self: " + err.Error()
		return cap
	}
	cap.ContainerID = ci.ID
	if imageOverride != "" {
		cap.Image = imageOverride
	} else {
		cap.Image = ci.Config.Image
	}
	return cap
}
