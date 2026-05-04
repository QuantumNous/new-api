#!/usr/bin/env python3
"""Fill empty French translations in fr.json."""
import json
import sys
import os

path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'locales', 'fr.json')
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

trans = data['translation']
empty_keys = [k for k, v in trans.items() if v == '']
print(f'Total keys: {len(trans)}')
print(f'Empty keys: {len(empty_keys)}')

# Code/JSX indicators - keys containing these are code snippets, not translatable text
code_indicators = [
    'className', 'onClick', 'useState', 'return (', '<div', '<span', '<Modal',
    '<Card>', '<Form.', '<Avatar', '<Input', '<Button', '<Tag', '<Badge', '<Tooltip',
    'useEffect', 'useMemo', 'useCallback', '.current', 'console.',
    'localStorage', '=> {', '=> (', '.filter(', '.map(', '.some(',
    'async ', 'await ', 'const ', 'function ', 'switch (',
    'try {', 'catch (', 'export const', 'export default', 'import ',
    '.push({', '.startsWith(', '.includes(',
    'JSON.parse', 'JSON.stringify', 'formApiRef', 'formRef.current',
    'window.', 'document.create', 'new Date(', 'new Intl',
    'res.data', 'API.put(', 'API.post(', 'API.get(',
    'Modal.confirm(', 'Modal.success(', 'Modal.info(',
    'onCancel()', 'props.refresh',
    '!== ', '=== \'', '|| \'', '&&',
    'setLoading', 'setIs', 'setShow', 'setKey', 'setModel', 'setProcess',
    'setVerify', 'setCustom', 'setAdvanced', 'setDoubao', 'setSelected',
    'setOrigin', 'setEmail', 'setRouter', 'setPay', 'setHtmlCode',
    'showError(', 'showSuccess(', 'showInfo(',
    'ref.current', 'hasExecuted', 'searchParams', 'source.readyState',
    'shouldStop', 'isBatchTesting', 'isStreamComplete',
    'codeElements', 'link.startsWith',
    'editingGroup', 'modules.pricing', 'config;',
    'modelData.', 'model.vendor', 'model.supported_endpoint',
    'model.enable_groups', 'model.quota_type',
    'normalizeTags', 'tagsArr',
    'res = await', 'params = data', 'value = String',
    'checked) =>', 'moduleKey', 'inputs[item', 'isEdit &&',
    'localInputs', 'emailDomainWhitelist', 'verifyResponse',
    'requestQueue', 'checkboxOptions',
    'isModuleVisible', 'headerNavModules', 'sidebar_modules',
    'customRequestMode', 'customRequestBody',
    'filterGroup', 'filterVendor', 'filterTag', 'filterEndpointType',
    'filterQuotaType', 'statusState', 'activePage',
    'loadModels', 'loadVendors', 'uptimeStatusMap',
    'billingExpr', 'groupRatio',
    'keyValuePairs', 'styledSendNode', 'sendNode',
    'setupStatus', 'trimmed.startsWith', 'payMethodForm',
    'result.filter', 'result = result',
    'iconName', 'avatarText', 'tooltipContent',
    'isMobile &&', 'hasMobile',
    'error.response', 'success, message', 'styleState',
    'chats = localStorage', 'filteredItems', 'filteredLinks', 'filteredModels',
    'showYear', 'nextWeekYear', 'nextDay', 'nextStr',
    'isEnterpriseAccount', 'doubaoApi', 'advancedSettingsOpen',
    'SELECTED_COLOR', 'isValid(true)', 'errorMessage(',
    'chatItems', 'domainList)', 'ipList)', 'allowedPorts)',
    'waffoPayMethods)', 'priceData', 'data.tags', 'data.endpoints',
    'isReasoningExpanded', 'MESSAGE_ROLES',
    'getModelPriceItems', 'objectToKeyValueArray',
    'ratioTypeFilter', 'processVisible', 'processInvoice', 'processStatus',
    'isVideoModalOpen', 'videoUrl', 'useManualInput', 'keyMode',
    'system_prompt_override', 'include_tax',
    '{/* ', '{...', '...props', 'React.clone',
    '.setValue(', '.getValue(', '.setValues(',
    'newRouterMap', 'newModules',
    'collapsed])', 'editMode ===',
    'type === ', 'key === ', 'value === ',
    'newTheme ?', 'quotaDisplayType',
    'steps = [',
    'SidebarModulesAdmin', 'SensitiveWords:',
    'CheckSensitive', 'DataExport', 'ApiInfo:',
    'DisplayTokenStat', 'DefaultCollapse', 'DemoSite',
    'SelfUseMode', 'HeaderNavModules:', 'SSRF',
    'aws_key_type', 'vertex_key_type', 'force_format',
    'thinking_to_content', 'proxy:',
    'ANNOUNCEMENT_LEGEND', 'DEBUG_TABS', 'DEFAULT_MESSAGES',
    'ERROR_MESSAGES', 'DEFAULT_CONFIG', 'API_ENDPOINTS',
    'DEFAULT_CHART', 'THINK_TAG_REGEX',
    'modelColorMap', 'baseColors', 'extendedColors',
    'renderTimestamp', 'createSectionTitle', 'hasImageContent',
    'formatDynamicPrice', 'formatPriceInfo', 'renderModelPrice',
    'getUptimeStatusColor', 'submitEpayForm', 'findCustomCurrency',
    'getSettingsCardInfo', 'getModelDescription',
    '// ', '/*', '* @param', '* @returns',
    'handleBackToLogin', 'handleCloseModal', 'clearTestResults',
    'handlePayMethodModalOk', 'reset2FAVerifyState',
    # Color comments
    '// 中紫罗兰', '// 主色', '// 亮绿', '// 介于',
    '// 午夜蓝', '// 天蓝', '// 强粉', '// 暗灰',
    '// 暗蓝', '// 橙红', '// 橙色', '// 浅海',
    '// 浅珊', '// 浅粉', '// 浅绿', '// 海洋',
    '// 淡桃', '// 淡橙', '// 深天', '// 深橙',
    '// 深紫', '// 热粉', '// 皇家', '// 矢车',
    '// 米色', '// 粉红', '// 粉蓝', '// 纯蓝',
    '// 苍紫', '// 道奇', '// 金色', '// 金黄',
    '// 中紫色', '// 优先使用',
]

# Identify code keys
code_keys = set()
for k in empty_keys:
    for ind in code_indicators:
        if ind in k:
            code_keys.add(k)
            break

text_keys = [k for k in empty_keys if k not in code_keys]

print(f'Code/JSX keys (copy as-is): {len(code_keys)}')
print(f'Text keys to translate: {len(text_keys)}')

# Print text keys for inspection
for k in text_keys:
    print(f'TEXT: {repr(k)}')

sys.exit(0)
