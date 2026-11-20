/**
 * @tanstack/marko-virtual — Marko 6 adapter for @tanstack/virtual-core
 *
 * Provides row, column, and grid virtualisation for Marko 6 applications
 * via the `<virtualizer>` and `<window-virtualizer>` tags.
 *
 * Tags are auto-discovered by the Marko compiler when this package is
 * installed — no imports needed. Just use `<virtualizer>` or
 * `<window-virtualizer>` directly in your `.marko` files.
 *
 * @example
 * ```marko
 * // Row virtualisation
 * <div/scrollEl style="height: 400px; overflow-y: auto">
 *   <virtualizer|{ virtualItems, totalSize }|
 *     count=10000
 *     estimateSize=() => 35
 *     getScrollElement=scrollEl
 *   >
 *     <div style=`height: ${totalSize}px; position: relative`>
 *       <for|item| of=virtualItems>
 *         <div style=`position: absolute; top: 0; transform: translateY(${item.start}px); height: ${item.size}px`>
 *           Row ${item.index}
 *         </div>
 *       </for>
 *     </div>
 *   </virtualizer>
 * </div>
 *
 * // Column virtualisation — same tag, horizontal=true
 * <virtualizer|{ virtualItems, totalSize }|
 *   count=10000
 *   estimateSize=() => 100
 *   horizontal=true
 *   getScrollElement=scrollEl
 * >
 *   ...
 * </virtualizer>
 *
 * // Grid — compose two <virtualizer> tags
 * <virtualizer|{ virtualItems: rowItems, totalSize: rowTotal }|
 *   count=10000 estimateSize=() => 35 getScrollElement=scrollEl
 * >
 *   <virtualizer|{ virtualItems: colItems, totalSize: colTotal }|
 *     count=200 estimateSize=() => 100 horizontal=true getScrollElement=scrollEl
 *   >
 *     ...
 *   </virtualizer>
 * </virtualizer>
 * ```
 *
 * @packageDocumentation
 */

// Re-export everything from virtual-core so consumers only need this package
export * from '@tanstack/virtual-core'
