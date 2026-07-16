package selfupdate

// DockerCapability describes whether a Docker-based update is possible.
// Fields match the design check payload (image / socket / container id).
type DockerCapability struct {
	Image           string `json:"image,omitempty"`
	SocketAvailable bool   `json:"socket_available"`
	ContainerID     string `json:"container_id,omitempty"`
	// Reason is optional human-readable detail when socket/image is unavailable.
	Reason string `json:"reason,omitempty"`
}

// BinaryCapability describes whether a binary self-update is possible.
type BinaryCapability struct {
	Platform   string `json:"platform,omitempty"`
	AssetFound bool   `json:"asset_found"`
	// Reason is optional human-readable detail when no asset matches.
	Reason string `json:"reason,omitempty"`
}

// Asset is a single downloadable artifact attached to a GitHub release.
type Asset struct {
	Name        string `json:"name"`
	DownloadURL string `json:"browser_download_url"`
	Size        int64  `json:"size"`
}

// ReleaseInfo holds metadata for a single GitHub release.
type ReleaseInfo struct {
	TagName     string  `json:"tag_name"`
	Name        string  `json:"name"`
	Body        string  `json:"body"`
	HTMLURL     string  `json:"html_url"`
	PublishedAt string  `json:"published_at"`
	Assets      []Asset `json:"assets"`
}

// Info is the full update-check result returned to callers.
type Info struct {
	DeployMode     DeployMode        `json:"deploy_mode"`
	CurrentVersion string            `json:"current_version"`
	LatestVersion  string            `json:"latest_version,omitempty"`
	HasUpdate      bool              `json:"has_update"`
	Release        *ReleaseInfo      `json:"release,omitempty"`
	Docker         *DockerCapability `json:"docker,omitempty"`
	Binary         *BinaryCapability `json:"binary,omitempty"`
	UpdateSource   string            `json:"update_source,omitempty"`
	Enabled        bool              `json:"enabled"`
	Cached         bool              `json:"cached"`
	Warning        string            `json:"warning,omitempty"`
}
