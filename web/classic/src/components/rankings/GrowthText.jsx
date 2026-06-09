import React from 'react';

export default function GrowthText({ value, className = '' }) {
  if (!Number.isFinite(value) || value === 0) {
    return <span className={`font-mono text-xs ${className}`} style={{ color: 'var(--semi-color-text-2)' }}>0%</span>;
  }
  const isUp = value > 0;
  const color = isUp ? 'var(--semi-color-success)' : 'var(--semi-color-danger)';
  return (
    <span className={`font-mono text-xs ${className}`} style={{ color }}>
      {isUp ? '↑' : '↓'}
      {Math.abs(value).toFixed(Math.abs(value) >= 100 ? 0 : 1)}%
    </span>
  );
}
