package router

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNoRouteAPIPathClassificationIsCaseInsensitive(t *testing.T) {
	for _, path := range []string{
		"/v1/chat/completions",
		"/V1/chat/completions",
		"/api/usage/token",
		"/API/usage/token",
		"/V1BETA/models",
		"/assets/app.js",
		"/ASSETS/app.js",
	} {
		t.Run(path, func(t *testing.T) {
			assert.True(t, isRelayNoRoutePath(path))
		})
	}
	for _, path := range []string{"/", "/dashboard", "/studio/"} {
		t.Run(path, func(t *testing.T) {
			assert.False(t, isRelayNoRoutePath(path))
		})
	}
}
