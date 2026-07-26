/**
 * Hairline dividers between the cells of a 2 → 3 → 5 column KPI strip, shared
 * by the Overview and Stats strips so the two tabs read as one system. The
 * grid reflows across breakpoints, so each axis is stated explicitly at every
 * breakpoint: a cell that starts a row must drop its left border, and the
 * first row must drop its top border. The colour is always present so no
 * toggle can fall back to Tailwind's default grey.
 */
export function kpiDividerClasses(i: number): string[] {
  return [
    'border-[var(--border-subtle)]',
    i % 2 === 0 ? 'border-l-0' : 'border-l',
    i < 2 ? 'border-t-0' : 'border-t',
    i % 3 === 0 ? 'sm:border-l-0' : 'sm:border-l',
    i < 3 ? 'sm:border-t-0' : 'sm:border-t',
    i === 0 ? 'xl:border-l-0' : 'xl:border-l',
    'xl:border-t-0',
  ]
}
