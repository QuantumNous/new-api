/** Presentation settings for the isolated static preview. No gateway or account APIs run here. */
export function useStatus() {
  return { status: { register_enabled: true }, loading: false, error: null }
}
