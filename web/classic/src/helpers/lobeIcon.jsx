import React from 'react';
import * as LobeIcons from '@lobehub/icons';

function parseValue(raw) {
  if (raw == null) return true;
  let v = String(raw).trim();
  if (v.startsWith('{') && v.endsWith('}')) v = v.slice(1, -1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(v)) return Number(v);
  return v;
}

export function getLobeIcon(iconName, size = 20) {
  if (!iconName || typeof iconName !== 'string' || !iconName.trim()) {
    return (
      <div className='flex items-center justify-center rounded-full text-xs font-medium'
        style={{ width: size, height: size, backgroundColor: 'var(--semi-color-fill-0)', color: 'var(--semi-color-text-2)' }}>
        {iconName ? iconName.charAt(0).toUpperCase() : '?'}
      </div>
    );
  }

  const segments = iconName.trim().split('.');
  const baseKey = segments[0];
  const BaseIcon = LobeIcons[baseKey];

  let IconComponent;
  let propStartIndex;

  if (BaseIcon && segments.length > 1 && BaseIcon[segments[1]]) {
    IconComponent = BaseIcon[segments[1]];
    propStartIndex = 2;
  } else {
    IconComponent = LobeIcons[baseKey];
    propStartIndex = segments.length > 1 && /^[A-Z]/.test(segments[1]) ? 2 : 1;
  }

  if (!IconComponent || (typeof IconComponent !== 'function' && typeof IconComponent !== 'object')) {
    return (
      <div className='flex items-center justify-center rounded-full text-xs font-medium'
        style={{ width: size, height: size, backgroundColor: 'var(--semi-color-fill-0)', color: 'var(--semi-color-text-2)' }}>
        {baseKey.charAt(0).toUpperCase()}
      </div>
    );
  }

  const props = {};
  for (let i = propStartIndex; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg) continue;
    const eqIdx = seg.indexOf('=');
    if (eqIdx === -1) { props[seg.trim()] = true; continue; }
    props[seg.slice(0, eqIdx).trim()] = parseValue(seg.slice(eqIdx + 1).trim());
  }
  if (props.size == null) props.size = size;

  return <IconComponent {...props} />;
}
