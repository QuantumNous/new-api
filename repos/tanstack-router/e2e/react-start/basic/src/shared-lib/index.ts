/**
 * Library index - re-exports from middleware and types.
 *
 * This barrel file re-exports from both:
 * 1. ./middleware - has runtime code (createMiddleware)
 * 2. ./types - has ONLY type exports (compiles to empty JS)
 *
 * The compiler must handle the type-only module gracefully when
 * tracing exports through this barrel file.
 */
export * from './middleware'
export * from './typedefs'
