'use client';
import * as React from 'react';
import * as Select from 'docs/src/components/Select';

const translations = {
  variants: {
    Default: 'Default',
    System: 'MUI System',
    Css: 'Plain CSS',
    CssModules: 'CSS Modules',
    Tailwind: 'Tailwind v4',
  } as Record<string, string>,
};

export interface DemoVariantSelectorProps extends React.HtmlHTMLAttributes<HTMLDivElement> {
  onVariantChange?: () => void;
  variants: string[];
  selectedVariant: string | null;
  selectVariant: React.Dispatch<React.SetStateAction<string | null>>;
}

export function DemoVariantSelector({
  variants,
  selectedVariant,
  selectVariant,
  onVariantChange,
}: DemoVariantSelectorProps) {
  const handleVariantChange = React.useCallback(
    (value: string | null) => {
      selectVariant(value);
      onVariantChange?.();
    },
    [selectVariant, onVariantChange],
  );

  return (
    <Select.Root
      items={translations.variants}
      value={selectedVariant}
      onValueChange={handleVariantChange}
    >
      <Select.Trigger aria-label="Styling method" />
      <Select.Popup>
        {variants.map((variantName) => (
          <Select.Item key={variantName} value={variantName}>
            {translations.variants[variantName]}
          </Select.Item>
        ))}
      </Select.Popup>
    </Select.Root>
  );
}
