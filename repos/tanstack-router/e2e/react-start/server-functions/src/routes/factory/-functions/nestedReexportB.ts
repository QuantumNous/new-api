/**
 * Middle module in the nested re-export chain.
 * Re-exports everything from nestedReexportC.
 *
 * Chain: nestedReexportA -> nestedReexportB (this file) -> nestedReexportC
 */
export * from './nestedReexportC'
