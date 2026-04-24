package main

import (
	"strings"
	"testing"
)

func TestInjectAppBasePath(t *testing.T) {
	index := []byte(`<!doctype html>
<html>
  <head>
    <base href="./" />
  </head>
  <body>
    <script>
      window.__NEW_API_RUNTIME__ = { appBasePath: "__APP_BASE_PATH_PLACEHOLDER__" };
    </script>
  </body>
</html>`)

	got := injectAppBasePath(index, "/new-api")

	if strings.Contains(string(got), "__APP_BASE_PATH_PLACEHOLDER__") {
		t.Fatalf("injectAppBasePath() left placeholder in HTML: %s", got)
	}

	if !strings.Contains(string(got), `window.__NEW_API_RUNTIME__ = { appBasePath: "/new-api" };`) {
		t.Fatalf("injectAppBasePath() did not inject the expected base path: %s", got)
	}

	if !strings.Contains(string(got), `<base href="/new-api/" />`) {
		t.Fatalf("injectAppBasePath() did not inject the expected base href: %s", got)
	}
}

func TestInjectAppBasePathUsesRootBaseHrefWhenEmpty(t *testing.T) {
	index := []byte(`<base href="./" />`)

	got := injectAppBasePath(index, "")

	if !strings.Contains(string(got), `<base href="/" />`) {
		t.Fatalf("injectAppBasePath() did not inject root base href: %s", got)
	}
}

func TestInjectAppBasePathEscapesQuotes(t *testing.T) {
	index := []byte(`window.__NEW_API_RUNTIME__ = { appBasePath: "__APP_BASE_PATH_PLACEHOLDER__" };`)

	got := injectAppBasePath(index, `/new-api/"quoted"`)

	if !strings.Contains(string(got), `"/new-api/\"quoted\""`) {
		t.Fatalf("injectAppBasePath() did not JSON-escape the base path: %s", got)
	}
}
