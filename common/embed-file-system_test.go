package common

import (
	"io"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"

	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
)

func TestEmbedFileSystemGETRouting(t *testing.T) {
	gin.SetMode(gin.TestMode)

	frontendFS := &embedFileSystem{FileSystem: http.FS(fstest.MapFS{
		"index.html":                         {Data: []byte("embedded index")},
		"client/yecai-client-apps.png":       {Data: []byte("client image")},
		"another-directory/example-file.txt": {Data: []byte("example")},
	})}
	router := gin.New()
	router.NoRoute(
		static.Serve("/", frontendFS),
		func(c *gin.Context) {
			c.Header("X-SPA-Query", c.Request.URL.RawQuery)
			c.Data(http.StatusOK, "text/html; charset=utf-8", []byte("spa index"))
		},
	)

	for _, test := range []struct {
		name          string
		target        string
		wantBody      string
		wantQuery     string
		wantSPARender bool
	}{
		{name: "client path", target: "/client", wantBody: "spa index", wantSPARender: true},
		{name: "client slash path", target: "/client/", wantBody: "spa index", wantSPARender: true},
		{name: "client query", target: "/client?source=header", wantBody: "spa index", wantQuery: "source=header", wantSPARender: true},
		{name: "client slash query", target: "/client/?source=refresh", wantBody: "spa index", wantQuery: "source=refresh", wantSPARender: true},
		{name: "root", target: "/", wantBody: "spa index", wantSPARender: true},
		{name: "root query", target: "/?source=root", wantBody: "spa index", wantQuery: "source=root", wantSPARender: true},
		{name: "another directory", target: "/another-directory", wantBody: "spa index", wantSPARender: true},
		{name: "missing path", target: "/missing", wantBody: "spa index", wantSPARender: true},
		{name: "real file", target: "/client/yecai-client-apps.png", wantBody: "client image"},
		{name: "real file query", target: "/client/yecai-client-apps.png?cache=1", wantBody: "client image"},
	} {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, test.target, nil)
			response := httptest.NewRecorder()

			router.ServeHTTP(response, request)

			if response.Code != http.StatusOK {
				t.Fatalf("GET %s returned %d, want %d; Location=%q", test.target, response.Code, http.StatusOK, response.Header().Get("Location"))
			}
			if location := response.Header().Get("Location"); location != "" {
				t.Fatalf("GET %s unexpectedly redirected to %q", test.target, location)
			}
			if body := response.Body.String(); body != test.wantBody {
				t.Fatalf("GET %s body = %q, want %q", test.target, body, test.wantBody)
			}
			wantContentType := "image/png"
			if test.wantSPARender {
				wantContentType = "text/html; charset=utf-8"
			}
			if contentType := response.Header().Get("Content-Type"); contentType != wantContentType {
				t.Fatalf("GET %s Content-Type = %q, want %q", test.target, contentType, wantContentType)
			}
			if test.wantSPARender {
				if query := response.Header().Get("X-SPA-Query"); query != test.wantQuery {
					t.Fatalf("GET %s passed query %q to SPA fallback, want %q", test.target, query, test.wantQuery)
				}
			} else if query := response.Header().Get("X-SPA-Query"); query != "" {
				t.Fatalf("GET %s unexpectedly reached SPA fallback", test.target)
			}
		})
	}
}

type testHTTPFileSystem func(string) (http.File, error)

func (open testHTTPFileSystem) Open(name string) (http.File, error) {
	return open(name)
}

type testHTTPFile struct {
	stat      fs.FileInfo
	statErr   error
	closeCall int
}

func (f *testHTTPFile) Close() error {
	f.closeCall++
	return nil
}

func (f *testHTTPFile) Read([]byte) (int, error)           { return 0, io.EOF }
func (f *testHTTPFile) Seek(int64, int) (int64, error)     { return 0, nil }
func (f *testHTTPFile) Readdir(int) ([]fs.FileInfo, error) { return nil, io.EOF }
func (f *testHTTPFile) Stat() (fs.FileInfo, error)         { return f.stat, f.statErr }

func TestEmbedFileSystemExistsClosesProbeOnStatFailure(t *testing.T) {
	probe := &testHTTPFile{statErr: fs.ErrInvalid}
	frontendFS := &embedFileSystem{FileSystem: testHTTPFileSystem(func(string) (http.File, error) {
		return probe, nil
	})}

	if frontendFS.Exists("/", "/broken") {
		t.Fatal("Exists returned true when Stat failed")
	}
	if probe.closeCall != 1 {
		t.Fatalf("probe Close called %d times, want 1", probe.closeCall)
	}
}
