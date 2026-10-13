package zcode

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"

	"smart-router/api"
)

type Route struct {
	Group      string       `json:"group"`
	Model      string       `json:"model"`
	Protocol   api.Protocol `json:"protocol"`
	BindingIDs []string     `json:"binding_ids"`
}

type Manifest struct {
	Kind           string  `json:"kind"`
	SchemaVersion  int     `json:"schema_version"`
	DryRun         bool    `json:"dry_run"`
	Apply          bool    `json:"apply"`
	Revision       string  `json:"revision"`
	SnapshotSHA256 string  `json:"snapshot_sha256"`
	RouteCount     int     `json:"route_count"`
	Routes         []Route `json:"routes"`
}

func BuildDryRun(snapshot api.SignedSnapshot) (Manifest, error) {
	if err := snapshot.Validate(); err != nil {
		return Manifest{}, err
	}
	payload, err := json.Marshal(snapshot)
	if err != nil {
		return Manifest{}, err
	}
	sum := sha256.Sum256(payload)
	manifest := Manifest{
		Kind: "zcode_manifest", SchemaVersion: 1, DryRun: true, Apply: false,
		Revision: snapshot.Revision, SnapshotSHA256: hex.EncodeToString(sum[:]),
		RouteCount: len(snapshot.Routes), Routes: make([]Route, 0, len(snapshot.Routes)),
	}
	for _, snapshotRoute := range snapshot.Routes {
		route := Route{
			Group: snapshotRoute.Group, Model: snapshotRoute.Model,
			Protocol:   snapshotRoute.Protocol,
			BindingIDs: make([]string, 0, len(snapshotRoute.Bindings)),
		}
		for _, binding := range snapshotRoute.Bindings {
			if !strings.HasPrefix(binding.BindingID, "bnd_") {
				return Manifest{}, errors.New("zcode accepts opaque binding IDs only")
			}
			route.BindingIDs = append(route.BindingIDs, binding.BindingID)
		}
		manifest.Routes = append(manifest.Routes, route)
	}
	return manifest, nil
}
