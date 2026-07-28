import { onScopeDispose, ref } from 'vue'

/**
 * Client-side image handling for the ticket prototype. There is no real upload
 * endpoint in the mock backend, so files are turned into object URLs that stay
 * valid for the session — mirroring the frontend mock's ObjectURL approach.
 * Returns i18n keys for errors so callers translate at the display layer.
 */

export interface TicketImage {
  id: string
  url: string
  error: string | null
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
/** Rejected-file tiles are informational; they dismiss themselves. */
const ERROR_DISMISS_MS = 4000

export function useTicketImages(maxCount = 4) {
  const images = ref<TicketImage[]>([])
  const errorTimers = new Set<number>()

  function validate(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) return 'tickets.upload.typeError'
    if (file.size > MAX_FILE_SIZE) return 'tickets.upload.sizeLimit'
    return null
  }

  function validCount(): number {
    return images.value.filter((img) => !img.error).length
  }

  function nextId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  function addFiles(files: File[]) {
    for (const file of files) {
      const error = validate(file)
      if (error) {
        // Surface the rejection briefly so users understand why a file was
        // skipped. Error tiles never consume an upload slot and auto-dismiss;
        // no object URL is created for invalid files.
        const id = nextId()
        images.value.push({ id, url: '', error })
        const timer = window.setTimeout(() => {
          errorTimers.delete(timer)
          remove(id)
        }, ERROR_DISMISS_MS)
        errorTimers.add(timer)
        continue
      }
      if (validCount() >= maxCount) continue
      images.value.push({
        id: nextId(),
        url: URL.createObjectURL(file),
        error: null,
      })
    }
  }

  function remove(id: string) {
    const index = images.value.findIndex((img) => img.id === id)
    if (index === -1) return
    const [removed] = images.value.splice(index, 1)
    if (removed.url) URL.revokeObjectURL(removed.url)
  }

  function getUrls(): string[] {
    return images.value
      .filter((img) => img.url && !img.error)
      .map((img) => img.url)
  }

  function reset() {
    for (const timer of errorTimers) window.clearTimeout(timer)
    errorTimers.clear()
    for (const img of images.value) {
      if (img.url) URL.revokeObjectURL(img.url)
    }
    images.value = []
  }

  function canAddMore(): boolean {
    return validCount() < maxCount
  }

  onScopeDispose(reset)

  return { images, addFiles, remove, getUrls, reset, canAddMore, maxCount }
}
