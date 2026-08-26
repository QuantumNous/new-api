// Package project holds wire-format projectors for the text IR.
//
// Each subpackage implements From/To for one protocol. Host code should not
// call these directly once relayconvert delegates to IR; they are the
// implementation of that hub.
package project
