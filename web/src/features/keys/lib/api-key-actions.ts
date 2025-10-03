// ============================================================================
// API Key Action Messages
// ============================================================================

type ApiKeyAction = 'enable' | 'disable' | 'delete'

const ACTION_MESSAGES: Record<ApiKeyAction, string> = {
  enable: 'API Key enabled successfully',
  disable: 'API Key disabled successfully',
  delete: 'API Key deleted successfully',
}

/**
 * Get success message for API key management action
 */
export function getApiKeyActionMessage(action: ApiKeyAction): string {
  return ACTION_MESSAGES[action]
}
