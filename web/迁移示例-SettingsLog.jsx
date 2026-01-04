/*
 * Color Migration Helper - SettingsLog.jsx
 * Replace hardcoded colors with CSS variables
 */

// Original code with hardcoded colors:
/*
<Text strong style={{ color: '#52c41a' }}>
<div style={{
  background: '#fff7e6',
  border: '1px solid #ffd591',
  color: '#333'
}}>
<Text strong style={{ color: '#d46b08' }}>
<Text style={{ color: '#333' }}>
<Text style={{ color: '#8c8c8c' }}>
*/

// Migrated code with CSS variables:
/*
<Text strong style={{ color: 'var(--semi-color-success)' }}>
<div style={{
  background: 'var(--semi-color-warning-light-default)',
  border: '1px solid var(--semi-color-warning-light-active)',
  color: 'var(--semi-color-text-0)'
}}>
<Text strong style={{ color: 'var(--semi-color-warning)' }}>
<Text style={{ color: 'var(--semi-color-text-0)' }}>
<Text style={{ color: 'var(--semi-color-text-2)' }}>
*/

// Alternative approach using CSS classes:
/*
// Add to components.css:
.log-success-text {
  color: var(--semi-color-success);
  font-weight: 600;
}

.log-warning-box {
  background: var(--semi-color-warning-light-default);
  border: 1px solid var(--semi-color-warning-light-active);
  color: var(--semi-color-text-0);
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

// Usage in component:
<Text strong className="log-success-text">
<div className="log-warning-box">
<Text strong className="log-warning-text">
<Text className="log-primary-text">
<Text className="log-secondary-text">
*/