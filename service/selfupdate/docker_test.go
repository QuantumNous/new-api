package selfupdate

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
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
		input    string
		wantNet  string
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

func TestEngineClient_InspectSelf_FallsBackToCustomHostname(t *testing.T) {
	const customHostname = "new-api-custom-host"
	t.Setenv("HOSTNAME", customHostname)

	mux := newFakeMux()
	mux.handle(http.MethodGet, "/containers/"+customHostname+"/json", func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "No such container", http.StatusNotFound)
	})
	mux.handle(http.MethodGet, "/containers/json", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusOK, []map[string]any{
			{"Id": "other-container"},
			{"Id": "matching-container"},
		})
	})
	mux.handle(http.MethodGet, "/containers/other-container/json", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusOK, map[string]any{
			"Id": "other-container",
			"Config": map[string]any{
				"Hostname": "another-host",
			},
		})
	})
	mux.handle(http.MethodGet, "/containers/matching-container/json", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusOK, map[string]any{
			"Id":   "matching-container",
			"Name": "/newapi-new-api",
			"Config": map[string]any{
				"Hostname": customHostname,
			},
		})
	})

	d := &dockerEngineImpl{client: fakeEngineClient(mux)}
	ci, err := d.InspectSelf(context.Background())
	require.NoError(t, err)
	assert.Equal(t, "matching-container", ci.ID)
	assert.Equal(t, "/newapi-new-api", ci.Name)
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
		helperID       = "updatehelper456"
		containerName  = "myapp"
		imageName      = "calciumion/new-api"
		imageRef       = imageName + ":latest"
	)

	calls := map[string]int{}
	mux := newFakeMux()
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
			"Mounts": []map[string]any{{
				"Type":        "bind",
				"Source":      "/host/run/docker.sock",
				"Destination": "/var/run/docker.sock",
			}},
		})
	})

	mux.handle(http.MethodGet, "/images/"+imageName+":latest/json", func(w http.ResponseWriter, r *http.Request) {
		calls["inspectImage"]++
		if calls["inspectImage"] == 1 {
			jsonResponse(w, http.StatusOK, map[string]any{"Id": "sha256:old"})
		} else {
			jsonResponse(w, http.StatusOK, map[string]any{"Id": "sha256:new"})
		}
	})

	mux.handle(http.MethodPost, "/images/create", func(w http.ResponseWriter, r *http.Request) {
		calls["pull"]++
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"status":"Pull complete"}`+"\n")
	})

	mux.handle(http.MethodPost, "/containers/"+oldContainerID+"/stop", func(w http.ResponseWriter, r *http.Request) {
		calls["stop"]++
		w.WriteHeader(http.StatusNoContent)
	})
	mux.handle(http.MethodPost, "/containers/create", func(w http.ResponseWriter, r *http.Request) {
		calls["create"]++
		assert.True(t, strings.HasPrefix(r.URL.Query().Get("name"), "new-api-update-helper-"))
		var body containerCreateBody
		require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
		assert.Equal(t, imageRef, body.Image)
		assert.Equal(t, []string{"/new-api"}, body.Entrypoint)
		assert.Equal(t, []string{
			dockerUpdateHelperCommand,
			oldContainerID,
			imageRef,
			"unix:///var/run/docker.sock",
			"false",
			"",
		}, body.Cmd)
		var hostConfig helperHostConfig
		require.NoError(t, json.Unmarshal(body.HostConfig, &hostConfig))
		assert.Equal(t, []string{"/host/run/docker.sock:/var/run/docker.sock:rw"}, hostConfig.Binds)
		assert.True(t, hostConfig.AutoRemove)
		jsonResponse(w, http.StatusCreated, map[string]any{"Id": helperID})
	})
	mux.handle(http.MethodPost, "/containers/"+helperID+"/start", func(w http.ResponseWriter, r *http.Request) {
		calls["startHelper"]++
		w.WriteHeader(http.StatusNoContent)
	})

	ec := fakeEngineClient(mux)
	d := &dockerEngineImpl{
		client:     ec,
		dockerHost: "unix:///var/run/docker.sock",
		network:    "unix",
		address:    "/var/run/docker.sock",
	}
	err := d.RecreateSelf(context.Background(), "")
	require.NoError(t, err)

	assert.Equal(t, 1, calls["inspect"], "inspect")
	assert.Equal(t, 2, calls["inspectImage"], "inspectImage")
	assert.Equal(t, 1, calls["pull"], "pull")
	assert.Zero(t, calls["stop"], "the request process must not stop its own container")
	assert.Equal(t, 1, calls["create"], "create")
	assert.Equal(t, 1, calls["startHelper"], "startHelper")
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

func TestEngineClient_RecreateSelfLocal_SchedulesHelperWithoutStoppingSelf(t *testing.T) {
	const (
		oldContainerID = "localold123"
		helperID       = "localhelper456"
		currentImageID = "sha256:current"
		targetImage    = "local/new-api:v2"
	)
	t.Setenv("HOSTNAME", oldContainerID)

	stopCalled := false
	mux := newFakeMux()
	mux.handle(http.MethodGet, "/containers/"+oldContainerID+"/json", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusOK, map[string]any{
			"Id":    oldContainerID,
			"Image": currentImageID,
			"Name":  "/myapp",
			"Config": map[string]any{
				"Image": "local/new-api:v1",
			},
		})
	})
	mux.handle(http.MethodGet, "/images/"+targetImage+"/json", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusOK, map[string]any{"Id": "sha256:target"})
	})
	mux.handle(http.MethodPost, "/containers/"+oldContainerID+"/stop", func(w http.ResponseWriter, r *http.Request) {
		stopCalled = true
		w.WriteHeader(http.StatusNoContent)
	})
	mux.handle(http.MethodPost, "/containers/create", func(w http.ResponseWriter, r *http.Request) {
		var body containerCreateBody
		require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
		assert.Equal(t, currentImageID, body.Image, "the known-good current image must run the helper")
		assert.Equal(t, targetImage, body.Cmd[2])
		assert.Equal(t, "true", body.Cmd[4])
		jsonResponse(w, http.StatusCreated, map[string]any{"Id": helperID})
	})
	mux.handle(http.MethodPost, "/containers/"+helperID+"/start", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	d := &dockerEngineImpl{
		client:     fakeEngineClient(mux),
		dockerHost: "unix:///var/run/docker.sock",
		network:    "unix",
		address:    "/var/run/docker.sock",
	}
	require.NoError(t, d.RecreateSelfLocal(context.Background(), targetImage))
	assert.False(t, stopCalled, "the update request must return before the helper stops the current container")
}

// ----------------------------------------------------------------------------
// Helper replacement and rollback
// ----------------------------------------------------------------------------

func TestEngineClient_ReplaceContainer_RollbackWhenUnhealthy(t *testing.T) {
	const (
		oldContainerID = "rollbackold"
		newContainerID = "rollbacknew"
		containerName  = "myapp"
		targetImage    = "local/new-api:v2"
	)

	rollbackRename := false
	rollbackStart := false
	deletedNew := false
	deletedOld := false

	mux := newFakeMux()
	mux.handle(http.MethodGet, "/containers/"+oldContainerID+"/json", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusOK, map[string]any{
			"Id":   oldContainerID,
			"Name": "/" + containerName,
			"Config": map[string]any{
				"Image":        "local/new-api:v1",
				"Env":          []string{"DB_URL=sqlite", "NEWAPI_DOCKER_IMAGE=stale"},
				"ExposedPorts": map[string]any{"3000/tcp": map[string]any{}},
				"Healthcheck": map[string]any{
					"Test":     []string{"CMD", "wget", "--spider", "http://127.0.0.1:3000/api/status"},
					"Interval": 1000000000,
				},
			},
			"HostConfig": map[string]any{
				"NetworkMode": "newapi-net",
				"PortBindings": map[string]any{
					"3000/tcp": []map[string]string{{"HostIp": "0.0.0.0", "HostPort": "3000"}},
				},
			},
			"NetworkSettings": map[string]any{
				"Networks": map[string]any{
					"newapi-net": map[string]any{"Aliases": []string{"new-api", containerName}},
				},
			},
		})
	})
	mux.handle(http.MethodGet, "/containers/"+newContainerID+"/json", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusOK, map[string]any{
			"Id": newContainerID,
			"State": map[string]any{
				"Status":  "running",
				"Running": true,
				"Health":  map[string]any{"Status": "unhealthy"},
			},
		})
	})
	mux.handle(http.MethodPost, "/containers/"+oldContainerID+"/stop", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	mux.handle(http.MethodPost, "/containers/"+oldContainerID+"/rename", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("name") == containerName {
			rollbackRename = true
		}
		w.WriteHeader(http.StatusNoContent)
	})
	mux.handle(http.MethodPost, "/containers/create", func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, containerName, r.URL.Query().Get("name"))
		var body containerCreateBody
		require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
		assert.Equal(t, targetImage, body.Image)
		assert.Equal(t, []string{"DB_URL=sqlite"}, body.Env)
		assert.Contains(t, body.ExposedPorts, "3000/tcp")
		require.NotNil(t, body.Healthcheck)
		assert.Equal(t, "CMD", body.Healthcheck.Test[0])
		require.NotNil(t, body.NetworkingConfig)
		assert.Equal(t, []string{"new-api", containerName}, body.NetworkingConfig.EndpointsConfig["newapi-net"].Aliases)
		assert.JSONEq(t, `{"NetworkMode":"newapi-net","PortBindings":{"3000/tcp":[{"HostIp":"0.0.0.0","HostPort":"3000"}]}}`, string(body.HostConfig))
		jsonResponse(w, http.StatusCreated, map[string]any{"Id": newContainerID})
	})
	mux.handle(http.MethodPost, "/containers/"+newContainerID+"/start", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	mux.handle(http.MethodDelete, "/containers/"+newContainerID, func(w http.ResponseWriter, r *http.Request) {
		deletedNew = true
		w.WriteHeader(http.StatusNoContent)
	})
	mux.handle(http.MethodDelete, "/containers/"+oldContainerID, func(w http.ResponseWriter, r *http.Request) {
		deletedOld = true
		w.WriteHeader(http.StatusNoContent)
	})
	mux.handle(http.MethodPost, "/containers/"+oldContainerID+"/start", func(w http.ResponseWriter, r *http.Request) {
		rollbackStart = true
		w.WriteHeader(http.StatusNoContent)
	})

	ec := fakeEngineClient(mux)
	d := &dockerEngineImpl{client: ec}
	err := d.replaceContainer(context.Background(), oldContainerID, targetImage, DockerRecreateOptions{DropDockerImageEnv: true})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unhealthy")
	assert.True(t, deletedNew, "unhealthy replacement should be removed")
	assert.False(t, deletedOld, "old container must remain available for rollback")
	assert.True(t, rollbackRename, "old container should be renamed back")
	assert.True(t, rollbackStart, "old container should be restarted")
}

func TestEngineClient_ReplaceContainer_ReportsRollbackFailures(t *testing.T) {
	const (
		oldContainerID = "rollback-errors-old"
		newContainerID = "rollback-errors-new"
	)

	mux := newFakeMux()
	mux.handle(http.MethodGet, "/containers/"+oldContainerID+"/json", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusOK, map[string]any{
			"Id":     oldContainerID,
			"Name":   "/myapp",
			"Config": map[string]any{"Image": "local/new-api:v1"},
		})
	})
	mux.handle(http.MethodPost, "/containers/"+oldContainerID+"/stop", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	mux.handle(http.MethodPost, "/containers/"+oldContainerID+"/rename", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("name") == "myapp" {
			http.Error(w, "rename rollback failed", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
	mux.handle(http.MethodPost, "/containers/create", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusCreated, map[string]any{"Id": newContainerID})
	})
	mux.handle(http.MethodPost, "/containers/"+newContainerID+"/start", func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "replacement start failed", http.StatusInternalServerError)
	})
	mux.handle(http.MethodDelete, "/containers/"+newContainerID, func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "delete rollback failed", http.StatusInternalServerError)
	})
	mux.handle(http.MethodPost, "/containers/"+oldContainerID+"/start", func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "restart rollback failed", http.StatusInternalServerError)
	})

	d := &dockerEngineImpl{client: fakeEngineClient(mux)}
	err := d.replaceContainer(context.Background(), oldContainerID, "local/new-api:v2", DockerRecreateOptions{})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "start replacement container")
	assert.Contains(t, err.Error(), "rollback failed")
	assert.Contains(t, err.Error(), "remove replacement container")
	assert.Contains(t, err.Error(), "restore old container name")
	assert.Contains(t, err.Error(), "restart old container")
}

func TestEngineClient_ScheduleRecreateHelper_RejectsNonUnixTransport(t *testing.T) {
	ci := &ContainerInspect{ID: "old-container", Image: "local/new-api:v1"}
	ci.Config.Image = "local/new-api:v1"

	for _, network := range []string{"npipe", "tcp"} {
		t.Run(network, func(t *testing.T) {
			d := &dockerEngineImpl{network: network, address: "ignored"}
			err := d.scheduleRecreateHelper(context.Background(), ci, "local/new-api:v2", DockerRecreateOptions{
				ComposeSync: &ComposeSyncOptions{ComposeFile: "/does/not/matter/compose.yaml"},
			})
			require.Error(t, err)
			assert.Contains(t, err.Error(), "requires a unix socket")
			assert.NotContains(t, err.Error(), "compose sync")
		})
	}
}

func TestEngineClient_ScheduleRecreateHelper_RestrictsHelperHostConfig(t *testing.T) {
	ci := &ContainerInspect{
		ID:    "old-container",
		Image: "local/new-api:v1",
		Mounts: []containerMount{{
			Type:        "bind",
			Source:      "/host/run/docker.sock",
			Destination: "/var/run/docker.sock",
			RW:          true,
		}},
	}
	ci.Config.Image = "local/new-api:v1"

	mux := newFakeMux()
	mux.handle(http.MethodPost, "/containers/create", func(w http.ResponseWriter, r *http.Request) {
		var body containerCreateBody
		require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
		var hostConfig helperHostConfig
		require.NoError(t, json.Unmarshal(body.HostConfig, &hostConfig))
		assert.Equal(t, []string{"/host/run/docker.sock:/var/run/docker.sock:rw"}, hostConfig.Binds)
		assert.True(t, hostConfig.AutoRemove)
		assert.Equal(t, "none", hostConfig.NetworkMode)
		assert.Len(t, body.Cmd, 6)
		assert.Empty(t, body.Cmd[5])
		jsonResponse(w, http.StatusCreated, map[string]any{"Id": "helper"})
	})
	mux.handle(http.MethodPost, "/containers/helper/start", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	d := &dockerEngineImpl{
		client:     fakeEngineClient(mux),
		dockerHost: "unix:///var/run/docker.sock",
		network:    "unix",
		address:    "/var/run/docker.sock",
	}
	require.NoError(t, d.scheduleRecreateHelper(context.Background(), ci, "local/new-api:v2", DockerRecreateOptions{}))
}

func TestEngineClient_ScheduleRecreateHelper_RejectsDockerImageEnvironmentBeforeHelperCreation(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("container-side POSIX path mapping requires a Linux filesystem")
	}
	composeDir := t.TempDir()
	composePath := filepath.Join(composeDir, "compose.yaml")
	require.NoError(t, os.WriteFile(composePath, []byte("services:\n  new-api:\n    image: local/new-api:v1\n"), 0o600))

	ci := &ContainerInspect{
		ID:    "old-container",
		Image: "local/new-api:v1",
		Mounts: []containerMount{
			{Type: "bind", Source: "/host/run/docker.sock", Destination: "/var/run/docker.sock", RW: true},
			{Type: "bind", Source: composeDir, Destination: composeDir, RW: true},
		},
	}
	ci.Config.Image = "local/new-api:v1"
	ci.Config.Env = []string{"NEWAPI_DOCKER_IMAGE=old/image:tag"}
	ci.Config.Labels = map[string]string{composeServiceLabel: "new-api"}

	createCalled := false
	mux := newFakeMux()
	mux.handle(http.MethodPost, "/containers/create", func(w http.ResponseWriter, r *http.Request) {
		createCalled = true
		w.WriteHeader(http.StatusInternalServerError)
	})
	d := &dockerEngineImpl{
		client:     fakeEngineClient(mux),
		dockerHost: "unix:///var/run/docker.sock",
		network:    "unix",
		address:    "/var/run/docker.sock",
	}

	err := d.scheduleRecreateHelper(context.Background(), ci, "local/new-api:v2", DockerRecreateOptions{
		ComposeSync: &ComposeSyncOptions{
			ComposeFile:          composePath,
			RejectDockerImageEnv: true,
		},
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "NEWAPI_DOCKER_IMAGE")
	assert.False(t, createCalled, "Compose preflight must fail before helper creation")
}

func TestEngineClient_ScheduleRecreateHelper_DeletesHelperWhenStartFails(t *testing.T) {
	const helperID = "helper-start-failure"
	ci := &ContainerInspect{ID: "old-container", Image: "local/new-api:v1"}
	ci.Config.Image = "local/new-api:v1"

	deleted := false
	mux := newFakeMux()
	mux.handle(http.MethodPost, "/containers/create", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusCreated, map[string]any{"Id": helperID})
	})
	mux.handle(http.MethodPost, "/containers/"+helperID+"/start", func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "start failed", http.StatusInternalServerError)
	})
	mux.handle(http.MethodDelete, "/containers/"+helperID, func(w http.ResponseWriter, r *http.Request) {
		deleted = true
		w.WriteHeader(http.StatusNoContent)
	})
	d := &dockerEngineImpl{
		client:     fakeEngineClient(mux),
		dockerHost: "unix:///var/run/docker.sock",
		network:    "unix",
		address:    "/var/run/docker.sock",
	}

	err := d.scheduleRecreateHelper(context.Background(), ci, "local/new-api:v2", DockerRecreateOptions{})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "start update helper")
	assert.True(t, deleted)
}
func TestEngineClient_ScheduleRecreateHelper_ComposeSpecIsBoundToValidatedDirectory(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("container-side POSIX path mapping requires a Linux filesystem")
	}
	composeDir := t.TempDir()
	composePath := filepath.Join(composeDir, "compose.yaml")
	composeContent := []byte("services:\n  new-api:\n    image: local/new-api:v1\n")
	require.NoError(t, os.WriteFile(composePath, composeContent, 0o600))

	ci := &ContainerInspect{
		ID:    "old-container",
		Image: "local/new-api:v1",
		Mounts: []containerMount{
			{Type: "bind", Source: "/host/run/docker.sock", Destination: "/var/run/docker.sock", RW: true},
			{Type: "bind", Source: composeDir, Destination: composeDir, RW: true},
		},
	}
	ci.Config.Image = "local/new-api:v1"
	ci.Config.Labels = map[string]string{composeServiceLabel: "new-api"}

	mux := newFakeMux()
	mux.handle(http.MethodPost, "/containers/create", func(w http.ResponseWriter, r *http.Request) {
		var body containerCreateBody
		require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
		var hostConfig helperHostConfig
		require.NoError(t, json.Unmarshal(body.HostConfig, &hostConfig))
		assert.Equal(t, []string{
			"/host/run/docker.sock:/var/run/docker.sock:rw",
			composeDir + ":" + composeHelperDir + ":rw",
		}, hostConfig.Binds)
		assert.True(t, hostConfig.AutoRemove)
		assert.Equal(t, "none", hostConfig.NetworkMode)
		require.Len(t, body.Cmd, 6)

		specBytes, err := base64.RawURLEncoding.DecodeString(body.Cmd[5])
		require.NoError(t, err)
		var spec composeSyncSpec
		require.NoError(t, json.Unmarshal(specBytes, &spec))
		assert.Equal(t, "compose.yaml", spec.ComposeFile)
		assert.Equal(t, "new-api", spec.ComposeService)
		assert.Equal(t, fmt.Sprintf("%x", sha256.Sum256(composeContent)), spec.ExpectedSHA256)
		assert.NotContains(t, body.Cmd[5], composeDir)
		jsonResponse(w, http.StatusCreated, map[string]any{"Id": "helper"})
	})
	mux.handle(http.MethodPost, "/containers/helper/start", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	d := &dockerEngineImpl{
		client:     fakeEngineClient(mux),
		dockerHost: "unix:///var/run/docker.sock",
		network:    "unix",
		address:    "/var/run/docker.sock",
	}
	require.NoError(t, d.scheduleRecreateHelper(context.Background(), ci, "local/new-api:v2", DockerRecreateOptions{
		ComposeSync: &ComposeSyncOptions{ComposeFile: composePath},
	}))
}

func TestEngineClient_ReplaceContainer_AppliesComposeAfterReadiness(t *testing.T) {
	composeDir := t.TempDir()
	composePath := filepath.Join(composeDir, "compose.yaml")
	original := []byte("services:\n  new-api:\n    image: local/new-api:v1\n")
	require.NoError(t, os.WriteFile(composePath, original, 0o600))
	hash := sha256.Sum256(original)

	const (
		oldContainerID = "compose-old"
		newContainerID = "compose-new"
		targetImage    = "local/new-api:v2"
	)
	var events []string
	mux := newFakeMux()
	mux.handle(http.MethodGet, "/containers/"+oldContainerID+"/json", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusOK, map[string]any{
			"Id": oldContainerID, "Name": "/myapp",
			"Config": map[string]any{"Healthcheck": map[string]any{"Test": []string{"CMD", "true"}}},
		})
	})
	mux.handle(http.MethodGet, "/containers/"+newContainerID+"/json", func(w http.ResponseWriter, r *http.Request) {
		events = append(events, "ready")
		jsonResponse(w, http.StatusOK, map[string]any{
			"Id":    newContainerID,
			"State": map[string]any{"Status": "running", "Running": true, "Health": map[string]any{"Status": "healthy"}},
		})
	})
	mux.handle(http.MethodPost, "/containers/"+oldContainerID+"/stop", func(w http.ResponseWriter, r *http.Request) {
		events = append(events, "stop")
		w.WriteHeader(http.StatusNoContent)
	})
	mux.handle(http.MethodPost, "/containers/"+oldContainerID+"/rename", func(w http.ResponseWriter, r *http.Request) {
		events = append(events, "rename")
		w.WriteHeader(http.StatusNoContent)
	})
	mux.handle(http.MethodPost, "/containers/create", func(w http.ResponseWriter, r *http.Request) {
		events = append(events, "create")
		jsonResponse(w, http.StatusCreated, map[string]any{"Id": newContainerID})
	})
	mux.handle(http.MethodPost, "/containers/"+newContainerID+"/start", func(w http.ResponseWriter, r *http.Request) {
		events = append(events, "start")
		w.WriteHeader(http.StatusNoContent)
	})
	mux.handle(http.MethodDelete, "/containers/"+oldContainerID, func(w http.ResponseWriter, r *http.Request) {
		events = append(events, "delete-old")
		updated, err := os.ReadFile(composePath)
		require.NoError(t, err)
		assert.Contains(t, string(updated), targetImage)
		w.WriteHeader(http.StatusNoContent)
	})

	d := &dockerEngineImpl{client: fakeEngineClient(mux)}
	err := d.replaceContainer(context.Background(), oldContainerID, targetImage, DockerRecreateOptions{
		composePrepared: &composePreparedUpdate{
			spec:         composeSyncSpec{ComposeFile: "compose.yaml", ComposeService: "new-api"},
			originalHash: hash,
			mountedDir:   composeDir,
		},
	})
	require.NoError(t, err)
	assert.Equal(t, []string{"stop", "rename", "create", "start", "ready", "delete-old"}, events)
	updated, err := os.ReadFile(composePath)
	require.NoError(t, err)
	assert.Contains(t, string(updated), targetImage)
	backups, err := filepath.Glob(filepath.Join(composeDir, ".compose.yaml.new-api-update-*.backup"))
	require.NoError(t, err)
	assert.Empty(t, backups)
}

func TestEngineClient_ReplaceContainer_RollsBackWhenComposeChangesAfterPreparation(t *testing.T) {
	composeDir := t.TempDir()
	composePath := filepath.Join(composeDir, "compose.yaml")
	original := []byte("services:\n  new-api:\n    image: local/new-api:v1\n")
	manuallyChanged := []byte("services:\n  new-api:\n    image: manually/changed:latest\n")
	require.NoError(t, os.WriteFile(composePath, original, 0o600))
	hash := sha256.Sum256(original)

	const oldContainerID, newContainerID = "sync-failure-old", "sync-failure-new"
	newDeleted, oldRenamedBack, oldRestarted := false, false, false
	mux := newFakeMux()
	mux.handle(http.MethodGet, "/containers/"+oldContainerID+"/json", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusOK, map[string]any{"Id": oldContainerID, "Name": "/myapp", "Config": map[string]any{"Healthcheck": map[string]any{"Test": []string{"CMD", "true"}}}})
		require.NoError(t, os.WriteFile(composePath, manuallyChanged, 0o600))
	})
	mux.handle(http.MethodGet, "/containers/"+newContainerID+"/json", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusOK, map[string]any{"Id": newContainerID, "State": map[string]any{"Status": "running", "Running": true, "Health": map[string]any{"Status": "healthy"}}})
	})
	mux.handle(http.MethodPost, "/containers/"+oldContainerID+"/stop", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) })
	mux.handle(http.MethodPost, "/containers/"+oldContainerID+"/rename", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("name") == "myapp" {
			oldRenamedBack = true
		}
		w.WriteHeader(http.StatusNoContent)
	})
	mux.handle(http.MethodPost, "/containers/create", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusCreated, map[string]any{"Id": newContainerID})
	})
	mux.handle(http.MethodPost, "/containers/"+newContainerID+"/start", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) })
	mux.handle(http.MethodDelete, "/containers/"+newContainerID, func(w http.ResponseWriter, r *http.Request) { newDeleted = true; w.WriteHeader(http.StatusNoContent) })
	mux.handle(http.MethodPost, "/containers/"+oldContainerID+"/start", func(w http.ResponseWriter, r *http.Request) { oldRestarted = true; w.WriteHeader(http.StatusNoContent) })

	d := &dockerEngineImpl{client: fakeEngineClient(mux)}
	err := d.replaceContainer(context.Background(), oldContainerID, "local/new-api:v2", DockerRecreateOptions{
		composePrepared: &composePreparedUpdate{
			spec:         composeSyncSpec{ComposeFile: "compose.yaml", ComposeService: "new-api"},
			originalHash: hash,
			mountedDir:   composeDir,
		},
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "synchronize compose declaration")
	assert.True(t, newDeleted)
	assert.True(t, oldRenamedBack)
	assert.True(t, oldRestarted)
	remaining, readErr := os.ReadFile(composePath)
	require.NoError(t, readErr)
	assert.Equal(t, manuallyChanged, remaining)
}

func TestEngineClient_ReplaceContainer_RetainsComposeBackupWhenOldRemovalFails(t *testing.T) {
	composeDir := t.TempDir()
	composePath := filepath.Join(composeDir, "compose.yaml")
	original := []byte("services:\n  new-api:\n    image: local/new-api:v1\n")
	require.NoError(t, os.WriteFile(composePath, original, 0o600))
	hash := sha256.Sum256(original)

	const oldContainerID, newContainerID = "partial-old", "partial-new"
	mux := newFakeMux()
	mux.handle(http.MethodGet, "/containers/"+oldContainerID+"/json", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusOK, map[string]any{"Id": oldContainerID, "Name": "/myapp", "Config": map[string]any{"Healthcheck": map[string]any{"Test": []string{"CMD", "true"}}}})
	})
	mux.handle(http.MethodGet, "/containers/"+newContainerID+"/json", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusOK, map[string]any{"Id": newContainerID, "State": map[string]any{"Status": "running", "Running": true, "Health": map[string]any{"Status": "healthy"}}})
	})
	mux.handle(http.MethodPost, "/containers/"+oldContainerID+"/stop", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) })
	mux.handle(http.MethodPost, "/containers/"+oldContainerID+"/rename", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) })
	mux.handle(http.MethodPost, "/containers/create", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusCreated, map[string]any{"Id": newContainerID})
	})
	mux.handle(http.MethodPost, "/containers/"+newContainerID+"/start", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) })
	mux.handle(http.MethodDelete, "/containers/"+oldContainerID, func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "old removal failed", http.StatusInternalServerError)
	})

	d := &dockerEngineImpl{client: fakeEngineClient(mux)}
	err := d.replaceContainer(context.Background(), oldContainerID, "local/new-api:v2", DockerRecreateOptions{
		composePrepared: &composePreparedUpdate{
			spec:         composeSyncSpec{ComposeFile: "compose.yaml", ComposeService: "new-api"},
			originalHash: hash,
			mountedDir:   composeDir,
		},
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "replacement container is healthy and compose declaration is synchronized")
	assert.Contains(t, err.Error(), "remove old container")
	updated, readErr := os.ReadFile(composePath)
	require.NoError(t, readErr)
	assert.Contains(t, string(updated), "local/new-api:v2")
	backups, globErr := filepath.Glob(filepath.Join(composeDir, ".compose.yaml.new-api-update-*.backup"))
	require.NoError(t, globErr)
	assert.Len(t, backups, 1, "backup must remain for manual recovery")
}
func TestEngineClient_ReplaceContainer_RemovesOldAfterHealthy(t *testing.T) {
	const (
		oldContainerID = "healthyold"
		newContainerID = "healthynew"
	)
	deletedOld := false
	mux := newFakeMux()
	mux.handle(http.MethodGet, "/containers/"+oldContainerID+"/json", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusOK, map[string]any{
			"Id":   oldContainerID,
			"Name": "/myapp",
			"Config": map[string]any{
				"Healthcheck": map[string]any{"Test": []string{"CMD", "true"}},
			},
		})
	})
	mux.handle(http.MethodGet, "/containers/"+newContainerID+"/json", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusOK, map[string]any{
			"Id": newContainerID,
			"State": map[string]any{
				"Status":  "running",
				"Running": true,
				"Health":  map[string]any{"Status": "healthy"},
			},
		})
	})
	mux.handle(http.MethodPost, "/containers/"+oldContainerID+"/stop", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	mux.handle(http.MethodPost, "/containers/"+oldContainerID+"/rename", func(w http.ResponseWriter, r *http.Request) {
		assert.True(t, strings.HasPrefix(r.URL.Query().Get("name"), "myapp-updating-old-"))
		w.WriteHeader(http.StatusNoContent)
	})
	mux.handle(http.MethodPost, "/containers/create", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusCreated, map[string]any{"Id": newContainerID})
	})
	mux.handle(http.MethodPost, "/containers/"+newContainerID+"/start", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	mux.handle(http.MethodDelete, "/containers/"+oldContainerID, func(w http.ResponseWriter, r *http.Request) {
		deletedOld = true
		w.WriteHeader(http.StatusNoContent)
	})

	d := &dockerEngineImpl{client: fakeEngineClient(mux)}
	require.NoError(t, d.replaceContainer(context.Background(), oldContainerID, "local/new-api:v2", DockerRecreateOptions{DropDockerImageEnv: true}))
	assert.True(t, deletedOld)
}

func TestReplacementContainerBody_NormalizesDockerGeneratedHostname(t *testing.T) {
	ci := &ContainerInspect{ID: "0123456789abcdef"}
	ci.Config.Hostname = "0123456789ab"
	ci.HostConfig = json.RawMessage(`{"NetworkMode":"host"}`)
	ci.NetworkSettings.Networks = map[string]*containerEndpointSettings{
		"host": {Aliases: []string{"old-alias"}},
	}

	body := replacementContainerBody(ci, "local/new-api:v2", false)
	assert.Empty(t, body.Hostname, "Docker must generate a hostname for the new container ID")
	assert.Nil(t, body.NetworkingConfig, "host networking cannot accept endpoint attachments")

	ci.Config.Hostname = "custom-hostname"
	body = replacementContainerBody(ci, "local/new-api:v2", false)
	assert.Equal(t, "custom-hostname", body.Hostname)
}

func TestFilterEnv_RemovesOnlyExactEnvironmentKey(t *testing.T) {
	env := []string{
		"KEEP=one",
		"NEWAPI_DOCKER_IMAGE=first",
		"NEWAPI_DOCKER_IMAGE_EXTRA=retain",
		"NEWAPI_DOCKER_IMAGE=",
		"KEEP=two",
		"NEWAPI_DOCKER_IMAGE=second",
	}

	assert.Equal(t, []string{
		"KEEP=one",
		"NEWAPI_DOCKER_IMAGE_EXTRA=retain",
		"KEEP=two",
	}, filterEnv(env, "NEWAPI_DOCKER_IMAGE"))
	assert.Nil(t, filterEnv(nil, "NEWAPI_DOCKER_IMAGE"))
	assert.Empty(t, filterEnv([]string{}, "NEWAPI_DOCKER_IMAGE"))
}

func TestReplacementContainerBody_DropsAllDockerImageEnvironmentValues(t *testing.T) {
	ci := &ContainerInspect{}
	ci.Config.Env = []string{
		"NEWAPI_DOCKER_IMAGE=first",
		"KEEP=one",
		"NEWAPI_DOCKER_IMAGE_EXTRA=retain",
		"NEWAPI_DOCKER_IMAGE=second",
	}

	body := replacementContainerBody(ci, "local/new-api:v2", true)
	assert.Equal(t, []string{"KEEP=one", "NEWAPI_DOCKER_IMAGE_EXTRA=retain"}, body.Env)
}

func TestEngineClient_BuildImageWithBinary_PreservesImageDefaultCommand(t *testing.T) {
	const tempContainerID = "build-temp-container"
	mux := newFakeMux()
	mux.handle(http.MethodPost, "/containers/create", func(w http.ResponseWriter, r *http.Request) {
		var body containerCreateBody
		require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
		assert.Equal(t, "local/new-api:v1", body.Image)
		assert.Empty(t, body.Cmd, "the committed image must retain its base default command")
		jsonResponse(w, http.StatusCreated, map[string]any{"Id": tempContainerID})
	})
	mux.handle(http.MethodPut, "/containers/"+tempContainerID+"/archive", func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/", r.URL.Query().Get("path"))
		w.WriteHeader(http.StatusOK)
	})
	mux.handle(http.MethodPost, "/commit", func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, tempContainerID, r.URL.Query().Get("container"))
		assert.Equal(t, "local/new-api", r.URL.Query().Get("repo"))
		assert.Equal(t, "v2", r.URL.Query().Get("tag"))
		w.WriteHeader(http.StatusCreated)
	})
	mux.handle(http.MethodDelete, "/containers/"+tempContainerID, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	binaryPath := filepath.Join(t.TempDir(), "new-api")
	require.NoError(t, os.WriteFile(binaryPath, []byte("test-binary"), 0o755))
	d := &dockerEngineImpl{client: fakeEngineClient(mux)}
	require.NoError(t, d.BuildImageWithBinary(
		context.Background(),
		"local/new-api:v1",
		binaryPath,
		"local/new-api:v2",
	))
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

func TestRunDockerUpdateHelper_RejectsInvalidArgumentsBeforeDocker(t *testing.T) {
	base := []string{"/new-api", dockerUpdateHelperCommand, "old", "local/new-api:v2", "unix:///missing.sock", "true", ""}
	validHash := sha256.Sum256([]byte("compose"))
	validSpec, err := json.Marshal(composeSyncSpec{
		ComposeFile:    "compose.yaml",
		ComposeService: "new-api",
		ExpectedSHA256: fmt.Sprintf("%x", validHash),
	})
	require.NoError(t, err)

	for _, tc := range []struct {
		name string
		args []string
	}{
		{name: "wrong count", args: base[:6]},
		{name: "invalid bool", args: append(append([]string(nil), base[:5]...), "maybe", "")},
		{name: "invalid base64", args: append(append([]string(nil), base[:6]...), "%%%")},
		{name: "invalid JSON", args: append(append([]string(nil), base[:6]...), base64.RawURLEncoding.EncodeToString([]byte("{")))},
		{name: "invalid spec", args: append(append([]string(nil), base[:6]...), base64.RawURLEncoding.EncodeToString([]byte(`{"compose_file":"../escape.yaml","compose_service":"new-api","expected_sha256":"0000000000000000000000000000000000000000000000000000000000000000"}`)))},
		{name: "invalid checksum", args: append(append([]string(nil), base[:6]...), base64.RawURLEncoding.EncodeToString([]byte(`{"compose_file":"compose.yaml","compose_service":"new-api","expected_sha256":"not-a-checksum"}`)))},
		{name: "unsafe service", args: append(append([]string(nil), base[:6]...), base64.RawURLEncoding.EncodeToString([]byte(`{"compose_file":"compose.yaml","compose_service":"../other","expected_sha256":"0000000000000000000000000000000000000000000000000000000000000000"}`)))},
	} {
		t.Run(tc.name, func(t *testing.T) {
			handled, err := RunDockerUpdateHelper(tc.args)
			assert.True(t, handled)
			require.Error(t, err)
		})
	}

	encodedValidSpec := base64.RawURLEncoding.EncodeToString(validSpec)
	handled, err := RunDockerUpdateHelper(append(append([]string(nil), base[:6]...), encodedValidSpec))
	assert.True(t, handled)
	require.Error(t, err, "a valid specification proceeds to Docker engine construction")
}

func TestRunDockerUpdateHelper_IgnoresNormalInvocation(t *testing.T) {
	handled, err := RunDockerUpdateHelper([]string{"/new-api", "serve"})
	assert.False(t, handled)
	require.NoError(t, err)
}

func TestEngineClient_EscapesDockerResourceAndQueryValues(t *testing.T) {
	requests := make(chan *http.Request, 4)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests <- r
		switch r.Method {
		case http.MethodGet:
			jsonResponse(w, http.StatusOK, map[string]any{"Id": "image-id"})
		case http.MethodPost:
			w.WriteHeader(http.StatusNoContent)
		case http.MethodDelete:
			w.WriteHeader(http.StatusNoContent)
		}
	}))
	defer srv.Close()

	d := &dockerEngineImpl{client: &engineClient{do: srv.Client().Do, base: srv.URL}}
	ctx := context.Background()
	require.NoError(t, d.renameContainer(ctx, "old/id", "new&name=value"))
	require.NoError(t, d.deleteContainer(ctx, "old/id"))
	_, err := d.inspectImage(ctx, "registry.example/app:tag/with?query")
	require.NoError(t, err)
	require.NoError(t, d.commitContainer(ctx, "old&id", "local/new-api&other=x", "v2?tag"))
	close(requests)

	var seen []string
	for request := range requests {
		seen = append(seen, request.Method+" "+request.URL.EscapedPath()+"?"+request.URL.RawQuery)
		switch request.Method {
		case http.MethodGet:
			assert.Contains(t, request.URL.EscapedPath(), "%2F")
		case http.MethodDelete:
			assert.Contains(t, request.URL.EscapedPath(), "%2F")
			assert.Equal(t, "true", request.URL.Query().Get("force"))
		case http.MethodPost:
			if request.URL.Path == "/commit" {
				assert.Equal(t, "old&id", request.URL.Query().Get("container"))
				assert.Equal(t, "local/new-api&other=x", request.URL.Query().Get("repo"))
				assert.Equal(t, "v2?tag", request.URL.Query().Get("tag"))
			} else {
				assert.Equal(t, "new&name=value", request.URL.Query().Get("name"))
			}
		}
	}
	assert.Len(t, seen, 4)
}
