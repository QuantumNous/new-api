package selfupdate

// Status represents the current state of the self-update subsystem.
type Status struct {
	Phase     string `json:"phase"`
	Message   string `json:"message"`
	Updating  bool   `json:"updating"`
	Error     string `json:"error,omitempty"`
	UpdatedAt int64  `json:"updated_at"`
}
