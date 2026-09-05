// Package cached handles a [metadata.Provider] implementation that both downloads and caches the MDS3 blob. This
// effectively is the recommended provider in most instances as it's fairly robust. Alternatively we suggest
// implementing a similar provider that leverages the [memory.Provider] as an underlying element.
//
// This provider only specifically performs updates at the time it's initialized. It has no automatic update
// functionality. This may change in the future however if you want this functionality at this time we recommend making
// your own implementation.
package cached
