export const debug =
  process.env.TSR_VITE_DEBUG &&
  ['true', 'start-plugin-core'].includes(process.env.TSR_VITE_DEBUG)
