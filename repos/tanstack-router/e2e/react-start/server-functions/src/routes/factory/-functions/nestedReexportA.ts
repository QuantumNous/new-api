/**
 * Top-level module in the nested re-export chain.
 * Re-exports everything from nestedReexportB.
 *
 * Chain: nestedReexportA (this file) -> nestedReexportB -> nestedReexportC
 */
export * from './nestedReexportB'
