import { apple } from './os';

// Whether a screen reader is *actually* running cannot be detected. These flags
// identify platforms where a specific screen reader could be active. VoiceOver
// is the system screen reader on Apple platforms and works with every browser
// there, so the flag is purely an OS check; engine-specific quirks (e.g. the
// NSAccessibility virtual-cursor focus path) should be gated at the call site.
/**
 * The user *may* be using VoiceOver — actual activation is not detectable.
 * True on any Apple platform (macOS, iOS, iPadOS).
 */
export const voiceOver = apple;
