// @amp-plugin updated automatically from https://ampcode.com/@amp/plugins/grok-45-mode.ts
// @amp-agent-mode {"key":"grok45","label":"Grok 4.5"}

import type { PluginAPI } from '@ampcode/plugin'

const GROK_45_PROMPT = 'You are Amp. Help the user complete software engineering tasks.'

const DEEP_TOOL_NAMES = [
	'apply_patch',
	'create_file',
	'edit_file',
	'find_thread',
	'finder',
	'librarian',
	'oracle',
	'painter',
	'Read',
	'read_mcp_resource',
	'read_thread',
	'read_web_page',
	'shell_command',
	'shell_command_status',
	'skill',
	'Task',
	'view_media',
	'web_search',
	'mcp__*',
] as const

export default function (amp: PluginAPI) {
	if (!amp.experimental) {
		amp.logger.log('Experimental plugin API is not available.')
		return
	}

	const agent = amp.experimental.createAgent({
		name: 'grok-4-5',
		model: 'xai/grok-4.5',
		instructions: GROK_45_PROMPT,
		tools: DEEP_TOOL_NAMES,
		reasoningEffort: 'high',
		display: { label: 'Grok 4.5', color: '#10b981' },
	})

	amp.experimental.registerAgentMode({
		key: 'grok45',
		label: 'Grok 4.5',
		description: 'Grok 4.5 with deep-mode tools and a minimal prompt',
		color: '#10b981',
		agent: agent.definition,
	})
}
