/*
 * Migrated SettingsLog.jsx - Color Variables Implementation
 * Replace hardcoded colors with CSS variables
 */

// MIGRATED COMPONENT SNIPPET
// This shows the key changes needed for SettingsLog.jsx

// BEFORE (hardcoded colors):
<Text strong style={{ color: '#52c41a' }}>
  {t('成功')}
</Text>

<div style={{
  background: '#fff7e6',
  border: '1px solid #ffd591',
  color: '#333'
}}>
  <Text strong style={{ color: '#d46b08' }}>
    {t('警告')}
  </Text>
  <Text style={{ color: '#333' }}>
    {t('将删除')} 
  </Text>
  <Text strong style={{ color: '#cf1322' }}>
    {t('危险')}
  </Text>
  <Text style={{ color: '#8c8c8c' }}>
    {t('次要信息')}
  </Text>
</div>

// AFTER (CSS variables):
<Text strong style={{ color: 'var(--semi-color-success)' }}>
  {t('成功')}
</Text>

<div style={{
  background: 'var(--semi-color-warning-light-default)',
  border: '1px solid var(--semi-color-warning-light-active)',
  color: 'var(--semi-color-text-0)'
}}>
  <Text strong style={{ color: 'var(--semi-color-warning)' }}>
    {t('警告')}
  </Text>
  <Text style={{ color: 'var(--semi-color-text-0)' }}>
    {t('将删除')} 
  </Text>
  <Text strong style={{ color: 'var(--semi-color-danger)' }}>
    {t('危险')}
  </Text>
  <Text style={{ color: 'var(--semi-color-text-2)' }}>
    {t('次要信息')}
  </Text>
</div>

// ALTERNATIVE (CSS classes approach):
// Add these classes to components.css:
.log-success-text {
  color: var(--semi-color-success);
  font-weight: 600;
}

.log-warning-box {
  background: var(--semi-color-warning-light-default);
  border: 1px solid var(--semi-color-warning-light-active);
  color: var(--semi-color-text-0);
  padding: 12px;
  border-radius: var(--semi-border-radius-medium);
}

.log-warning-text {
  color: var(--semi-color-warning);
  font-weight: 600;
}

.log-primary-text {
  color: var(--semi-color-text-0);
}

.log-secondary-text {
  color: var(--semi-color-text-2);
}

.log-danger-text {
  color: var(--semi-color-danger);
  font-weight: 600;
}

// Usage with CSS classes:
<Text strong className="log-success-text">
  {t('成功')}
</Text>

<div className="log-warning-box">
  <Text strong className="log-warning-text">
    {t('警告')}
  </Text>
  <Text className="log-primary-text">
    {t('将删除')} 
  </Text>
  <Text strong className="log-danger-text">
    {t('危险')}
  </Text>
  <Text className="log-secondary-text">
    {t('次要信息')}
  </Text>
</div>