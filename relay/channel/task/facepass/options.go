package facepass

// Options controls Face API mask behavior.
type Options struct {
	SingleEye bool
	Size      int // clamped to 1–10 by ClampSize / NormalizeOptions
}

// BoolDefaultTrue: nil/true => true; false => false.
func BoolDefaultTrue(p *bool) bool {
	if p == nil {
		return true
	}
	return *p
}

// ClampSize: nil => 5; clamp to 1–10.
func ClampSize(p *int) int {
	if p == nil {
		return 5
	}
	n := *p
	if n < 1 {
		return 1
	}
	if n > 10 {
		return 10
	}
	return n
}

// NormalizeOptions applies defaults and clamps Size.
func NormalizeOptions(opts Options) Options {
	if opts.Size < 1 {
		opts.Size = 1
	}
	if opts.Size > 10 {
		opts.Size = 10
	}
	return opts
}
