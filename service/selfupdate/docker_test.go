package selfupdate

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ----------------------------------------------------------------------------
// Pure helper tests
// ----------------------------------------------------------------------------

func TestParseDockerHost(t *testing.T) {
	cases := []struct {
		input   string
		wantNet string
		wantAddr string
	}{
		{"unix:///var/run/docker.sock", "unix", "/var/run/docker.sock"},
		{"unix:///run/docker.sock", "unix", "/run/docker.sock"},
		{"npipe:////./pipe/docker_engine", "npipe", "//./pipe/docker_engine"},
		{"tcp://127.0.0.1:2375", "tcp", "127.0.0.1:2375"},
		{"", "unix", "/var/run/docker.sock"},
		{"garbage", "unix", "/var/run/docker.sock"},
	}
	for _, tc := range cases {
		tc := tc
		t.Run(tc.input, func(t *testing.T) {
			net, addr := parseDockerHost(tc.input)
			assert.Equal(t, tc.wantNet, net)
			assert.Equal(t, tc.wantAddr, addr)
		})
	}
}

func TestSplitImageTag(t *testing.T) {
	cases := []struct {
		input    string
		wantName string
		wantTag  string
	}{
		{"calciumion/new-api:latest", "calciumion/new-api", "latest"},
		{"alpine", "alpine", "latest"},
		{"alpine:3.18", "alpine", "3.18"},
		{"registry.example.com/img:v2", "registry.example.com/img", "v2"},
		{"registry.example.com:5000/img:v2", "registry.example.com:5000/img", "v2"},
		{"registry.example.com:5000/img", "registry.example.com:5000/img", "latest"},
		{"sha256img@sha256:abc123", "sha256img", ""},
	}
	for _, tc := range cases {
		tc := tc
		t.Run(tc.input, func(t *testing.T) {
			name, tag := splitImageTag(tc.input)
			assert.Equal(t, tc.wantName, name)
			assert.Equal(t, tc.wantTag, tag)
		})
	}
}

// ----------------------------------------------------------------------------
// httptest-based engineClient tests via injectable do()
// ----------------------------------------------------------------------------

// fakeServer returns an engineClient whose do() function routes to an
// httptest.Server. All requests arrive at the handler as-is.
func fakeEngineClient(handler http.Handler) *engineClient {
	srv := httptest.NewServer(handler)
	// The base URL uses the test server address, with no path prefix.
	// We override base to point directly at the test server root so that
	// path-routing in the handler works without /v1.41 prefix complications.
	client := &http.Client{}
	return &engineClient{
		do:   client.Do,
		base: srv.URL,
	}
}

// fakeMux is a simple URL-path mux for tests.
type fakeMux struct {
	routes map[string]http.HandlerFunc
}

func newFakeMux() *fakeMux { return &fakeMux{routes: make(map[string]http.HandlerFunc)} }

func (m *fakeMux) handle(method, path string, h http.HandlerFunc) {
	m.routes[method+" "+path] = h
}

func (m *fakeMux) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	key := r.Method + " " + r.URL.Path
	if h, ok := m.routes[key]; ok {
		h(w, r)
		return
	}
	http.Error(w, "not found: "+key, http.StatusNotFound)
}

// jsonResponse writes JSON to w with the given status code.
func jsonResponse(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// ----------------------------------------------------------------------------
// Ping
// ----------------------------------------------------------------------------

func TestEngineClient_Ping_OK(t *testing.T) {
	mux := newFakeMux()
	mux.handle(http.MethodGet, "/_ping", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, "OK")
	})
	ec := fakeEngineClient(mux)
	d := &dockerEngineImpl{client: ec}
	require.NoError(t, d.Ping(context.Background()))
}

func TestEngineClient_Ping_Error(t *testing.T) {
	mux := newFakeMux()
	mux.handle(http.MethodGet, "/_ping", func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "daemon not running", http.StatusInternalServerError)
	})
	ec := fakeEngineClient(mux)
	d := &dockerEngineImpl{client: ec}
	err := d.Ping(context.Background())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "500")
}

// ----------------------------------------------------------------------------
// InspectContainer (via inspectContainer helper)
// ----------------------------------------------------------------------------

func TestEngineClient_InspectContainer_OK(t *testing.T) {
	mux := newFakeMux()
	mux.handle(http.MethodGet, "/containers/abc123/json", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusOK, map[string]any{
			"Id":   "abc123full",
			"Name": "/mycontainer",
			"Config": map[string]any{
				"Image": "calciumion/new-api:latest",
				"Env":   []string{"FOO=bar"},
			},
		})
	})
	ec := fakeEngineClient(mux)
	d := &dockerEngineImpl{client: ec}
	ci, err := d.inspectContainer(context.Background(), "abc123")
	require.NoError(t, err)
	assert.Equal(t, "abc123full", ci.ID)
	assert.Equal(t, "/mycontainer", ci.Name)
	assert.Equal(t, "calciumion/new-api:latest", ci.Config.Image)
}

func TestEngineClient_InspectContainer_NotFound(t *testing.T) {
	mux := newFakeMux()
	mux.handle(http.MethodGet, "/containers/unknown/json", func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "No such container", http.StatusNotFound)
	})
	ec := fakeEngineClient(mux)
	d := &dockerEngineImpl{client: ec}
	_, err := d.inspectContainer(context.Background(), "unknown")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "404")
}

// ----------------------------------------------------------------------------
// PullImage
// ----------------------------------------------------------------------------

func TestEngineClient_PullImage_OK(t *testing.T) {
	mux := newFakeMux()
	mux.handle(http.MethodPost, "/images/create", func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "calciumion/new-api", r.URL.Query().Get("fromImage"))
		assert.Equal(t, "latest", r.URL.Query().Get("tag"))
		w.WriteHeader(http.StatusOK)
		// Simulate streaming JSON progress lines.
		_, _ = io.WriteString(w, `{"status":"Pulling from calciumion/new-api"}`+"\n")
		_, _ = io.WriteString(w, `{"status":"Pull complete"}`+"\n")
	})
	ec := fakeEngineClient(mux)
	d := &dockerEngineImpl{client: ec}
	require.NoError(t, d.PullImage(context.Background(), "calciumion/new-api:latest"))
}

func TestEngineClient_PullImage_HTTPError(t *testing.T) {
	mux := newFakeMux()
	mux.handle(http.MethodPost, "/images/create", func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "image not found", http.StatusNotFound)
	})
	ec := fakeEngineClient(mux)
	d := &dockerEngineImpl{client: ec}
	err := d.PullImage(context.Background(), "bad/image:tag")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "404")
}

// ----------------------------------------------------------------------------
// inspectImage
// ----------------------------------------------------------------------------

func TestEngineClient_InspectImage_OK(t *testing.T) {
	mux := newFakeMux()
	mux.handle(http.MethodGet, "/images/calciumion/new-api:latest/json", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusOK, map[string]any{"Id": "sha256:deadbeef"})
	})
	ec := fakeEngineClient(mux)
	d := &dockerEngineImpl{client: ec}
	id, err := d.inspectImage(context.Background(), "calciumion/new-api:latest")
	require.NoError(t, err)
	assert.Equal(t, "sha256:deadbeef", id)
}

// ----------------------------------------------------------------------------
// RecreateSelf – happy path (new image available)
// ----------------------------------------------------------------------------

func TestEngineClient_RecreateSelf_OK(t *testing.T) {
	const (
		oldContainerID = "oldcontainer123"
		newContainerID = "newcontainer456"
		containerName  = "myapp"
		imageName      = "calciumion/new-api"
		imageRef       = imageName + ":latest"
	)

	calls := map[string]int{}

	mux := newFakeMux()

	// InspectSelf → inspectContainer (via HOSTNAME env, but we call it directly in this test)
	// We drive RecreateSelf via the exported method, which calls InspectSelf
	// using selfContainerID(). Since we're not in a container, we instead
	// call the private recreate logic by constructing the engine manually and
	// testing via an exported adapter. Instead, we test via fake containerID
	// by setting HOSTNAME env.
	t.Setenv("HOSTNAME", oldContainerID)

	mux.handle(http.MethodGet, "/containers/"+oldContainerID+"/json", func(w http.ResponseWriter, r *http.Request) {
		calls["inspect"]++
		jsonResponse(w, http.StatusOK, map[string]any{
			"Id":   oldContainerID,
			"Name": "/" + containerName,
			"Config": map[string]any{
				"Image": imageRef,
				"Env":   []string{"FOO=bar"},
			},
			"HostConfig": map[string]any{"NetworkMode": "bridge"},
		})
	})

	// inspectImage before pull → old digest
	mux.handle(http.MethodGet, "/images/"+imageName+":latest/json", func(w http.ResponseWriter, r *http.Request) {
		calls["inspectImage"]++
		if calls["inspectImage"] == 1 {
			jsonResponse(w, http.StatusOK, map[string]any{"Id": "sha256:old"})
		} else {
			jsonResponse(w, http.StatusOK, map[string]any{"Id": "sha256:new"})
		}
	})

	// PullImage
	mux.handle(http.MethodPost, "/images/create", func(w http.ResponseWriter, r *http.Request) {
		calls["pull"]++
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"status":"Pull complete"}`+"\n")
	})

	// Stop
	mux.handle(http.MethodPost, "/containers/"+oldContainerID+"/stop", func(w http.ResponseWriter, r *http.Request) {
		calls["stop"]++
		w.WriteHeader(http.StatusNoContent)
	})

	// Rename old
	mux.handle(http.MethodPost, "/containers/"+oldContainerID+"/rename", func(w http.ResponseWriter, r *http.Request) {
		calls["rename"]++
		assert.Equal(t, containerName+"-updating-old", r.URL.Query().Get("name"))
		w.WriteHeader(http.StatusNoContent)
	})

	// Create new container
	mux.handle(http.MethodPost, "/containers/create", func(w http.ResponseWriter, r *http.Request) {
		calls["create"]++
		assert.Equal(t, containerName, r.URL.Query().Get("name"))
		jsonResponse(w, http.StatusCreated, map[string]any{"Id": newContainerID})
	})

	// Start new container
	mux.handle(http.MethodPost, "/containers/"+newContainerID+"/start", func(w http.ResponseWriter, r *http.Request) {
		calls["startNew"]++
		w.WriteHeader(http.StatusNoContent)
	})

	// Delete old container
	mux.handle(http.MethodDelete, "/containers/"+oldContainerID, func(w http.ResponseWriter, r *http.Request) {
		calls["delete"]++
		w.WriteHeader(http.StatusNoContent)
	})

	ec := fakeEngineClient(mux)
	d := &dockerEngineImpl{client: ec}
	err := d.RecreateSelf(context.Background(), "")
	require.NoError(t, err)

	assert.Equal(t, 1, calls["inspect"], "inspect")
	assert.Equal(t, 2, calls["inspectImage"], "inspectImage")
	assert.Equal(t, 1, calls["pull"], "pull")
	assert.Equal(t, 1, calls["stop"], "stop")
	assert.Equal(t, 1, calls["rename"], "rename")
	assert.Equal(t, 1, calls["create"], "create")
	assert.Equal(t, 1, calls["startNew"], "startNew")
	assert.Equal(t, 1, calls["delete"], "delete")
}

// ----------------------------------------------------------------------------
// RecreateSelf – already up to date
// ----------------------------------------------------------------------------

func TestEngineClient_RecreateSelf_AlreadyUpToDate(t *testing.T) {
	const (
		oldContainerID = "container999"
		containerName  = "myapp"
		imageRef       = "calciumion/new-api:latest"
		imageName      = "calciumion/new-api"
	)
	t.Setenv("HOSTNAME", oldContainerID)

	mux := newFakeMux()

	mux.handle(http.MethodGet, "/containers/"+oldContainerID+"/json", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusOK, map[string]any{
			"Id":   oldContainerID,
			"Name": "/" + containerName,
			"Config": map[string]any{
				"Image": imageRef,
			},
		})
	})

	// Both inspectImage calls return the same digest → already up to date.
	mux.handle(http.MethodGet, "/images/"+imageName+":latest/json", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusOK, map[string]any{"Id": "sha256:same"})
	})

	mux.handle(http.MethodPost, "/images/create", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"status":"Pull complete"}`+"\n")
	})

	ec := fakeEngineClient(mux)
	d := &dockerEngineImpl{client: ec}
	err := d.RecreateSelf(context.Background(), "")
	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrAlreadyUpToDate))
}

// ----------------------------------------------------------------------------
// RecreateSelf – rollback when start fails
// ----------------------------------------------------------------------------

func TestEngineClient_RecreateSelf_RollbackOnStartFail(t *testing.T) {
	const (
		oldContainerID = "rollbackold"
		newContainerID = "rollbacknew"
		containerName  = "myapp"
		imageRef       = "alpine:latest"
		imageName      = "alpine"
	)
	t.Setenv("HOSTNAME", oldContainerID)

	rollbackRename := false
	rollbackStart := false

	mux := newFakeMux()

	mux.handle(http.MethodGet, "/containers/"+oldContainerID+"/json", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusOK, map[string]any{
			"Id":   oldContainerID,
			"Name": "/" + containerName,
			"Config": map[string]any{"Image": imageRef},
		})
	})

	inspectCount := 0
	mux.handle(http.MethodGet, "/images/"+imageName+":latest/json", func(w http.ResponseWriter, r *http.Request) {
		inspectCount++
		digest := "sha256:old"
		if inspectCount > 1 {
			digest = "sha256:new"
		}
		jsonResponse(w, http.StatusOK, map[string]any{"Id": digest})
	})

	mux.handle(http.MethodPost, "/images/create", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	mux.handle(http.MethodPost, "/containers/"+oldContainerID+"/stop", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	renameCount := 0
	mux.handle(http.MethodPost, "/containers/"+oldContainerID+"/rename", func(w http.ResponseWriter, r *http.Request) {
		renameCount++
		newName := r.URL.Query().Get("name")
		if newName == containerName {
			rollbackRename = true
		}
		w.WriteHeader(http.StatusNoContent)
	})

	mux.handle(http.MethodPost, "/containers/create", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusCreated, map[string]any{"Id": newContainerID})
	})

	// Start new container → fail.
	mux.handle(http.MethodPost, "/containers/"+newContainerID+"/start", func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "start failed", http.StatusInternalServerError)
	})

	// Delete new container (called before rollback).
	mux.handle(http.MethodDelete, "/containers/"+newContainerID, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	// Rollback: start old container.
	mux.handle(http.MethodPost, "/containers/"+oldContainerID+"/start", func(w http.ResponseWriter, r *http.Request) {
		rollbackStart = true
		w.WriteHeader(http.StatusNoContent)
	})

	ec := fakeEngineClient(mux)
	d := &dockerEngineImpl{client: ec}
	err := d.RecreateSelf(context.Background(), "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "start new container")
	assert.True(t, rollbackRename, "old container should be renamed back")
	assert.True(t, rollbackStart, "old container should be restarted")
}

// ----------------------------------------------------------------------------
// ErrAlreadyUpToDate sentinel
// ----------------------------------------------------------------------------

func TestErrAlreadyUpToDate_IsSentinel(t *testing.T) {
	err := fmt.Errorf("wrapped: %w", ErrAlreadyUpToDate)
	assert.True(t, errors.Is(err, ErrAlreadyUpToDate))
	assert.Equal(t, "already up to date", ErrAlreadyUpToDate.Error())
}

// ----------------------------------------------------------------------------
// postEmpty / renameContainer / deleteContainer via httptest
// ----------------------------------------------------------------------------

func TestEngineClient_PostEmpty_OK(t *testing.T) {
	mux := newFakeMux()
	mux.handle(http.MethodPost, "/containers/abc/stop", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	ec := fakeEngineClient(mux)
	d := &dockerEngineImpl{client: ec}
	require.NoError(t, d.postEmpty(context.Background(), "/containers/abc/stop"))
}

func TestEngineClient_PostEmpty_Error(t *testing.T) {
	mux := newFakeMux()
	mux.handle(http.MethodPost, "/containers/abc/stop", func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "conflict", http.StatusConflict)
	})
	ec := fakeEngineClient(mux)
	d := &dockerEngineImpl{client: ec}
	err := d.postEmpty(context.Background(), "/containers/abc/stop")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "409")
}

func TestEngineClient_DeleteContainer_OK(t *testing.T) {
	mux := newFakeMux()
	mux.handle(http.MethodDelete, "/containers/abc", func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "true", r.URL.Query().Get("force"))
		w.WriteHeader(http.StatusNoContent)
	})
	ec := fakeEngineClient(mux)
	d := &dockerEngineImpl{client: ec}
	require.NoError(t, d.deleteContainer(context.Background(), "abc"))
}

// ----------------------------------------------------------------------------
// Compile-time interface check
// ----------------------------------------------------------------------------

func TestDockerEngine_InterfaceCompliance(t *testing.T) {
	// Just ensure *dockerEngineImpl satisfies DockerEngine at compile time.
	var _ DockerEngine = (*dockerEngineImpl)(nil)
}

// Verify ErrAlreadyUpToDate string representation.
func TestErrAlreadyUpToDate_String(t *testing.T) {
	assert.Equal(t, "already up to date", ErrAlreadyUpToDate.Error())
}

// Verify splitImageTag handles registry:port correctly (colon after last slash wins).
func TestSplitImageTag_RegistryWithPort(t *testing.T) {
	name, tag := splitImageTag("localhost:5000/myimage")
	assert.Equal(t, "localhost:5000/myimage", name, "colon before last slash should not be tag separator")
	assert.Equal(t, "latest", tag)
}

// Verify splitImageTag with explicit tag on registry:port image.
func TestSplitImageTag_RegistryWithPortAndTag(t *testing.T) {
	name, tag := splitImageTag("localhost:5000/myimage:v1")
	assert.Equal(t, "localhost:5000/myimage", name)
	assert.Equal(t, "v1", tag)
}

// Verify drain does not panic on nil response or nil body.
func TestDrain_NilSafe(t *testing.T) {
	drain(nil)
	drain(&http.Response{Body: nil})
	drain(&http.Response{Body: io.NopCloser(strings.NewReader("data"))})
}
