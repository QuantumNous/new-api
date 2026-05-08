/**
 * Get message content styles based on role
 * Encapsulates styling logic for user and assistant messages
 */
export function getMessageContentStyles() {
  return [
    // Assistant content fills the row; user bubble auto-width
    'group-[.is-assistant]:w-full',
    'group-[.is-assistant]:max-w-none',
    'group-[.is-user]:w-fit',
    // User bubble: rounded and themed background
    'group-[.is-user]:text-foreground',
    'group-[.is-user]:bg-secondary',
    'dark:group-[.is-user]:bg-muted',
    'group-[.is-user]:rounded-3xl',
    // Assistant bubble: flat serif style (one-sided style)
    'group-[.is-assistant]:text-foreground',
    'group-[.is-assistant]:bg-transparent',
    'group-[.is-assistant]:p-0',
    'group-[.is-assistant]:font-serif',
    // Preferred readable widths and wrapping
    'leading-relaxed',
    'break-words',
    'whitespace-pre-wrap',
    'sm:leading-7',
    // Cap user bubble width so it does not look like a banner
    'group-[.is-user]:max-w-[85%]',
    'sm:group-[.is-user]:max-w-[62ch]',
    'md:group-[.is-user]:max-w-[68ch]',
    'lg:group-[.is-user]:max-w-[72ch]',
  ].join(' ')
}
