package dto

// UserGroupInfo describes a single usable group for the current user.
type UserGroupInfo struct {
	Ratio any    `json:"ratio"`
	Desc  string `json:"desc"`
}
