package common

import (
	"io"
	"os"
)

// GinLogWriterFactory, when set by the host application (e.g. LynxtonAPI), is used by
// logger.SetupLogger to build gin.DefaultWriter and gin.DefaultErrorWriter instead of the
// default io.MultiWriter(stdout, file) / io.MultiWriter(stderr, file).
//
// Implementations should write human-readable legacy lines to logFile as needed and emit
// structured logs separately (e.g. JSON on stdout) so container collectors see one format.
var GinLogWriterFactory func(stdout io.Writer, logFile *os.File) (out io.Writer, errOut io.Writer)
