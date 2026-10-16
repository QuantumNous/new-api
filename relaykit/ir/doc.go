// Package ir is the in-memory intermediate representation for text-protocol
// conversion.
//
// Wire formats (OpenAI Chat Completions, OpenAI Responses, Anthropic Messages,
// Gemini generateContent) are equal peers. Conversion is always
//
//	From(wire) → IR → To(wire)
//
// never pairwise through Chat Completions.
//
// Intake (From) keeps first-class semantics: thinking text and signatures,
// tool ids, cache_control, thought signatures, typed tools. Projection (To)
// may drop fields a target protocol cannot express; those losses belong in a
// Report. X → IR → X is required to be semantically stable.
//
// This package does not depend on Gin or the host gateway. Projectors live
// under ir/project.
package ir
