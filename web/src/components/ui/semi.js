/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Avatar as HeroAvatar,
  Button as HeroButton,
  Card as HeroCard,
  Checkbox as HeroCheckbox,
  Chip,
  Input as HeroInput,
  Pagination as HeroPagination,
  Select as HeroSelect,
  Skeleton as HeroSkeleton,
  Spinner as HeroSpinner,
  Switch as HeroSwitch,
  TextArea as HeroTextArea,
  Tooltip as HeroTooltip,
} from '@heroui/react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';

const cx = (...values) => values.filter(Boolean).join(' ');

const sizeMap = {
  small: 'sm',
  default: 'md',
  middle: 'md',
  large: 'lg',
};

const buttonThemeMap = {
  solid: 'primary',
  light: 'ghost',
  borderless: 'ghost',
  outline: 'outline',
};

const buttonTypeMap = {
  primary: 'primary',
  danger: 'danger',
  warning: 'secondary',
  tertiary: 'ghost',
  secondary: 'secondary',
};

const toEventValue = (handler, value, event, extra) => {
  if (!handler) return;
  return handler(value, event, extra);
};

const extractText = (node) => {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (!React.isValidElement(node)) return '';
  return extractText(node.props?.children);
};

const surfaceClass =
  'rounded-2xl border border-[color:var(--app-border)] bg-white/80 shadow-sm backdrop-blur dark:bg-slate-900/80';

function SectionLabel({ children, className }) {
  if (!children) return null;
  return (
    <div className={cx('mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100', className)}>
      {children}
    </div>
  );
}

export function Button({
  children,
  className,
  theme,
  type,
  size,
  icon,
  iconPosition = 'left',
  icononly,
  loading,
  disabled,
  onClick,
  onPress,
  htmlType,
  block,
  ...props
}) {
  const content = (
    <>
      {icon && iconPosition !== 'right' ? icon : null}
      {!icononly ? children : null}
      {icon && iconPosition === 'right' ? icon : null}
    </>
  );

  return (
    <HeroButton
      className={className}
      variant={buttonTypeMap[type] || buttonThemeMap[theme] || 'primary'}
      size={sizeMap[size] || 'md'}
      isDisabled={disabled}
      isPending={loading}
      isIconOnly={icononly}
      fullWidth={block}
      type={htmlType}
      onPress={onPress || onClick}
      {...props}
    >
      {content}
    </HeroButton>
  );
}

export const Icon = ({ svg, className, style }) => (
  <span className={className} style={style}>
    {svg}
  </span>
);

function TypographyText({ children, strong, link, className, style, copyable, ...props }) {
  const TagName = link ? 'a' : 'span';
  return (
    <TagName
      className={cx(strong && 'font-semibold', className)}
      style={style}
      {...props}
    >
      {children}
      {copyable ? (
        <button
          type='button'
          className='ml-2 text-xs text-sky-600'
          onClick={() => navigator.clipboard?.writeText(extractText(children))}
        >
          复制
        </button>
      ) : null}
    </TagName>
  );
}

function TypographyTitle({ heading = 4, children, className, style }) {
  const TagName = `h${Math.min(6, Math.max(1, heading))}`;
  return (
    <TagName
      className={cx(
        'font-semibold text-slate-900 dark:text-slate-100',
        heading <= 2 ? 'text-3xl' : heading === 3 ? 'text-2xl' : 'text-xl',
        className,
      )}
      style={style}
    >
      {children}
    </TagName>
  );
}

function TypographyParagraph({ children, className, style, ...props }) {
  return (
    <p className={cx('leading-6 text-slate-600 dark:text-slate-300', className)} style={style} {...props}>
      {children}
    </p>
  );
}

export const Typography = {
  Text: TypographyText,
  Title: TypographyTitle,
  Paragraph: TypographyParagraph,
};

export function Divider({ className, style }) {
  return <div className={cx('my-4 h-px w-full bg-slate-200 dark:bg-slate-800', className)} style={style} />;
}

export function Space({ children, spacing = 8, align = 'center', vertical = false, wrap, className, style }) {
  return (
    <div
      className={cx(vertical ? 'flex flex-col' : 'flex flex-row', wrap && 'flex-wrap', className)}
      style={{ gap: spacing, alignItems: align, ...style }}
    >
      {children}
    </div>
  );
}

export function Row({ children, gutter = 0, className, style }) {
  return (
    <div className={cx('flex flex-wrap', className)} style={{ marginLeft: -gutter / 2, marginRight: -gutter / 2, ...style }}>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child, {
              style: {
                paddingLeft: gutter / 2,
                paddingRight: gutter / 2,
                ...(child.props.style || {}),
              },
            })
          : child,
      )}
    </div>
  );
}

// Map a 24-column-grid span to a percentage width string. Returns null when
// the span is not provided so callers can omit unused breakpoints.
const colSpanToPercent = (span) =>
  typeof span === 'number' ? `${(span / 24) * 100}%` : null;

// Col understands the same xs/sm/md/lg/xl/xxl props the legacy 24-column grid
// used (matching antd / Semi). We render width via inline custom properties
// and pair them with responsive classes so the column collapses at each
// breakpoint rather than falling back to 100% (which made the operation
// settings render as a single tall column instead of a 2/4-column grid).
export function Col({
  children,
  span,
  xs,
  sm,
  md,
  lg,
  xl,
  xxl,
  className,
  style,
}) {
  const baseSpan = span ?? xs ?? 24;
  const baseWidth = colSpanToPercent(baseSpan);
  const responsive = {
    '--col-w-sm': colSpanToPercent(sm),
    '--col-w-md': colSpanToPercent(md),
    '--col-w-lg': colSpanToPercent(lg),
    '--col-w-xl': colSpanToPercent(xl),
    '--col-w-2xl': colSpanToPercent(xxl),
  };
  const responsiveStyle = Object.fromEntries(
    Object.entries(responsive).filter(([, v]) => v !== null),
  );
  const responsiveClass = cx(
    sm !== undefined && 'sm:!w-[var(--col-w-sm)]',
    md !== undefined && 'md:!w-[var(--col-w-md)]',
    lg !== undefined && 'lg:!w-[var(--col-w-lg)]',
    xl !== undefined && 'xl:!w-[var(--col-w-xl)]',
    xxl !== undefined && '2xl:!w-[var(--col-w-2xl)]',
  );
  return (
    <div
      className={cx(responsiveClass, className)}
      style={{ width: baseWidth, ...responsiveStyle, ...style }}
    >
      {children}
    </div>
  );
}

export function Card({ children, title, headerLine, footer, className, bodyStyle, style }) {
  return (
    <HeroCard className={cx(surfaceClass, className)} style={style}>
      {title ? (
        <div className={cx('px-6 pt-6', headerLine && 'border-b border-slate-200 pb-4 dark:border-slate-800')}>
          <SectionLabel className='mb-0'>{title}</SectionLabel>
        </div>
      ) : null}
      <div className='px-6 py-5' style={bodyStyle}>
        {children}
      </div>
      {footer ? <div className='border-t border-slate-200 px-6 py-4 dark:border-slate-800'>{footer}</div> : null}
    </HeroCard>
  );
}

export function Tag({ children, color = 'default', className, ...props }) {
  const colorMap = {
    red: 'danger',
    green: 'success',
    orange: 'warning',
    yellow: 'warning',
    blue: 'primary',
    cyan: 'primary',
    purple: 'secondary',
    grey: 'default',
    gray: 'default',
  };

  return (
    <Chip color={colorMap[color] || 'default'} variant='tertiary' className={className} {...props}>
      {children}
    </Chip>
  );
}

export function Avatar(props) {
  return <HeroAvatar {...props} />;
}

export function AvatarGroup({ children, className }) {
  return <div className={cx('flex -space-x-2', className)}>{children}</div>;
}

const baseInputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-0 transition focus:border-sky-400 dark:border-slate-700 dark:bg-slate-900';

export const Input = forwardRef(function Input(
  { value, defaultValue, onChange, showClear, prefix, suffix, addonAfter, addonBefore, className, style, ...props },
  ref,
) {
  const handleChange = (event) => toEventValue(onChange, event.target.value, event);

  return (
    <div className={cx('flex items-center gap-2', className)} style={style}>
      {addonBefore || prefix}
      <input ref={ref} className={baseInputClass} value={value} defaultValue={defaultValue} onChange={handleChange} {...props} />
      {showClear && value ? (
        <button type='button' onClick={() => toEventValue(onChange, '', null)}>
          <X size={14} />
        </button>
      ) : null}
      {suffix || addonAfter}
    </div>
  );
});

export const TextArea = forwardRef(function TextArea(
  { value, defaultValue, onChange, rows = 4, className, style, ...props },
  ref,
) {
  const handleChange = (event) => toEventValue(onChange, event.target.value, event);

  return (
    <textarea
      ref={ref}
      className={cx(baseInputClass, 'min-h-24', className)}
      style={style}
      rows={rows}
      value={value}
      defaultValue={defaultValue}
      onChange={handleChange}
      {...props}
    />
  );
});

export function InputNumber({ value, defaultValue, onChange, min, max, step = 1, className, style, ...props }) {
  const handleChange = (event) => {
    const nextValue = event.target.value === '' ? '' : Number(event.target.value);
    toEventValue(onChange, nextValue, event);
  };

  return (
    <input
      type='number'
      className={cx(baseInputClass, className)}
      style={style}
      value={value}
      defaultValue={defaultValue}
      min={min}
      max={max}
      step={step}
      onChange={handleChange}
      {...props}
    />
  );
}

// HeroUI v3 Switch is a compound component: it renders only an unstyled
// <input role="switch"> unless its Control + Thumb children are present.
// We always provide the anatomy so legacy `<Switch checked onChange />`
// callers render a proper toggle.
export function Switch({
  checked,
  defaultChecked,
  onChange,
  children,
  className,
  size = 'md',
  ...props
}) {
  const [internal, setInternal] = useState(defaultChecked || false);
  const selected = checked ?? internal;
  const handleValue = (next) => {
    if (checked === undefined) setInternal(next);
    toEventValue(onChange, next, null);
  };
  const heroSize = sizeMap[size] || size || 'md';

  return (
    <label className={cx('inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300', className)}>
      <HeroSwitch
        isSelected={selected}
        onValueChange={handleValue}
        size={heroSize}
        {...props}
      >
        <HeroSwitch.Control>
          <HeroSwitch.Thumb />
        </HeroSwitch.Control>
      </HeroSwitch>
      {children}
    </label>
  );
}

export function Checkbox({ checked, defaultChecked, onChange, children, className, ...props }) {
  const [internal, setInternal] = useState(defaultChecked || false);
  const selected = checked ?? internal;
  const handleValue = (next) => {
    if (checked === undefined) setInternal(next);
    toEventValue(onChange, next, null);
  };

  return (
    <label className={cx('inline-flex items-center gap-2 text-sm', className)}>
      <HeroCheckbox isSelected={selected} onValueChange={handleValue} {...props}>
        {children}
      </HeroCheckbox>
    </label>
  );
}

function RadioItem({ checked, value, onChange, children, className, extra, disabled, style, type, name, ...props }) {
  const isCard = type === 'card';

  return (
    <label
      className={cx(
        'inline-flex cursor-pointer items-start gap-2 text-sm transition',
        isCard
          ? 'rounded-2xl border border-slate-200 bg-white/80 p-4 hover:border-sky-300 hover:bg-sky-50/50 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-sky-700 dark:hover:bg-sky-950/20'
          : 'text-slate-700 dark:text-slate-300',
        checked && isCard && 'border-sky-500 bg-sky-50 ring-2 ring-sky-500/20 dark:border-sky-400 dark:bg-sky-950/35',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
      style={style}
    >
      <input
        type='radio'
        name={name}
        value={value}
        checked={Boolean(checked)}
        disabled={disabled}
        onChange={() => onChange?.(value)}
        className='mt-1 h-4 w-4 accent-sky-600'
        {...props}
      />
      <span className='min-w-0'>
        <span className='font-medium text-slate-900 dark:text-slate-100'>{children}</span>
        {extra ? <span className='mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400'>{extra}</span> : null}
      </span>
    </label>
  );
}

export function Radio({ checked, value, onChange, children, className, ...props }) {
  return (
    <RadioItem checked={checked} value={value} onChange={onChange} className={className} {...props}>
      {children}
    </RadioItem>
  );
}

export function RadioGroup({ value, defaultValue, onChange, children, className, direction, type, name, ...props }) {
  const [internal, setInternal] = useState(defaultValue);
  const selected = value ?? internal;
  const groupName = name || `radio-group-${useId()}`;

  return (
    <div
      className={cx(
        'flex gap-3',
        direction === 'horizontal' ? 'flex-row flex-wrap' : 'flex-col',
        className,
      )}
      {...props}
    >
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child, {
              checked: child.props.value === selected,
              type,
              name: groupName,
              onChange: (next) => {
                if (value === undefined) setInternal(next);
                toEventValue(onChange, next, null);
              },
            })
          : child,
      )}
    </div>
  );
}

function SelectOption({ children, value }) {
  return <option value={value}>{children}</option>;
}

export function Select({
  value,
  defaultValue,
  onChange,
  multiple,
  children,
  className,
  style,
  disabled,
  ...props
}) {
  const handleChange = (event) => {
    const nextValue = multiple
      ? Array.from(event.target.selectedOptions).map((option) => option.value)
      : event.target.value;
    toEventValue(onChange, nextValue, event);
  };

  return (
    <select
      className={cx(baseInputClass, className)}
      style={style}
      value={value}
      defaultValue={defaultValue}
      disabled={disabled}
      multiple={multiple}
      onChange={handleChange}
      {...props}
    >
      {children}
    </select>
  );
}

Select.Option = SelectOption;

// Some legacy callers reach for `Radio.Group` / `Checkbox.Group` instead of
// the standalone components. Mirror those to the matching exports so JSX
// like `<Radio.Group>...</Radio.Group>` keeps working without a rewrite.
Radio.Group = RadioGroup;

export function Tooltip({ content, children, ...props }) {
  if (!content) return children;
  return (
    <HeroTooltip content={content} {...props}>
      {children}
    </HeroTooltip>
  );
}

export function Popover({ content, children }) {
  return (
    <div className='group relative inline-flex'>
      {children}
      {content ? (
        <div className='invisible absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-sm -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-lg group-hover:visible dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'>
          {content}
        </div>
      ) : null}
    </div>
  );
}

const renderDropdownMenu = (menu) => {
  if (!Array.isArray(menu)) return menu;
  return (
    <Dropdown.Menu>
      {menu.map((item, index) => {
        if (!item) return null;
        if (item.divider || item.node === 'divider') {
          return <Dropdown.Divider key={item.name || index} />;
        }
        if (item.node === 'item' || item.children || item.name) {
          return (
            <Dropdown.Item
              key={item.name || index}
              icon={item.icon}
              onClick={item.onClick}
              className={item.className}
              type={item.type}
            >
              {item.children || item.label || item.name}
            </Dropdown.Item>
          );
        }
        return null;
      })}
    </Dropdown.Menu>
  );
};

export function Dropdown({ children, render, menu, trigger = 'hover' }) {
  const [open, setOpen] = useState(false);
  const overlay = typeof render === 'function' ? render() : (render || renderDropdownMenu(menu));

  const triggerProps =
    trigger === 'click'
      ? {
          onClick: () => setOpen((prev) => !prev),
        }
      : {
          onMouseEnter: () => setOpen(true),
          onMouseLeave: () => setOpen(false),
        };

  return (
    <div className='relative inline-flex' {...triggerProps}>
      {children}
      {open && overlay ? (
        <div className='absolute right-0 top-full z-30 mt-2 min-w-40 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900'>
          {overlay}
        </div>
      ) : null}
    </div>
  );
}

Dropdown.Menu = function DropdownMenu({ children, className }) {
  return <div className={cx('flex flex-col gap-1', className)}>{children}</div>;
};

Dropdown.Item = function DropdownItem({ children, icon, onClick, className, ...props }) {
  return (
    <button
      type='button'
      className={cx(
        'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
        className,
      )}
      onClick={onClick}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
};

Dropdown.Divider = Divider;

// Banner supports both new-style children and Semi-style title/description
// props. Without honoring `description` the inner text just disappeared
// (e.g. the model marketplace warning showed only an oversized icon).
export function Banner({
  children,
  type = 'info',
  className,
  icon,
  title,
  description,
  closeIcon,
  fullMode,
  bordered,
  style,
}) {
  const colorMap = {
    info: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200',
    warning:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200',
    danger:
      'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200',
    success:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200',
  };

  void fullMode; // not differentiated visually; accepted for API compat
  void bordered;

  return (
    <div
      className={cx(
        'rounded-2xl border px-4 py-3 text-sm',
        colorMap[type] || colorMap.info,
        className,
      )}
      style={style}
    >
      <div className='flex items-start gap-3'>
        {icon ? <div className='shrink-0'>{icon}</div> : null}
        <div className='min-w-0 flex-1'>
          {title ? <div className='font-medium'>{title}</div> : null}
          {description ? <div className={title ? 'mt-1' : ''}>{description}</div> : null}
          {children}
        </div>
        {closeIcon ? <div className='shrink-0'>{closeIcon}</div> : null}
      </div>
    </div>
  );
}

export function Empty({ image, title, description, children }) {
  return (
    <div className='flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900/50'>
      {image}
      {title ? <div className='text-base font-semibold'>{title}</div> : null}
      {description ? <div className='max-w-md text-sm text-slate-500'>{description}</div> : null}
      {children}
    </div>
  );
}

// Spin wraps its children in a relative container and overlays a spinner
// while `spinning` is true. When called without children it falls back to
// rendering just the spinner so it can be used as an inline indicator. The
// previous implementation returned null when `spinning` was false, which
// silently hid every child node it wrapped (this is why several settings
// pages rendered an empty card).
export function Spin({ spinning = true, tip, size = 'small', children, className, style }) {
  if (children === undefined) {
    if (!spinning) return null;
    return (
      <div className={cx('inline-flex items-center gap-2', className)} style={style}>
        <HeroSpinner size={sizeMap[size] || 'sm'} />
        {tip ? <span className='text-sm text-slate-500'>{tip}</span> : null}
      </div>
    );
  }
  return (
    <div className={cx('relative', className)} style={style}>
      {children}
      {spinning ? (
        <div className='pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/60 backdrop-blur-sm'>
          <div className='inline-flex items-center gap-2'>
            <HeroSpinner size={sizeMap[size] || 'sm'} />
            {tip ? <span className='text-sm text-slate-500'>{tip}</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Skeleton(props) {
  return <HeroSkeleton {...props} />;
}

export function Progress({ percent = 0, showInfo = true, className }) {
  return (
    <div className={className}>
      <div className='h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800'>
        <div className='h-full rounded-full bg-sky-500' style={{ width: `${percent}%` }} />
      </div>
      {showInfo ? <div className='mt-2 text-xs text-slate-500'>{percent}%</div> : null}
    </div>
  );
}

export function Badge({ count, children }) {
  return (
    <div className='relative inline-flex'>
      {children}
      {count ? (
        <span className='absolute -right-2 -top-2 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] text-white'>
          {count}
        </span>
      ) : null}
    </div>
  );
}

const TabsContext = createContext(null);

export function TabPane({ children }) {
  return children;
}

export function Tabs({ children, activeKey, defaultActiveKey, onChange, className, tabBarExtraContent }) {
  const panes = React.Children.toArray(children).filter(Boolean);
  const [internal, setInternal] = useState(defaultActiveKey || panes[0]?.props?.itemKey);
  const current = activeKey ?? internal;

  const setCurrent = (next) => {
    if (activeKey === undefined) setInternal(next);
    onChange?.(next);
  };

  const activePane = panes.find((pane) => pane.props.itemKey === current) || panes[0];

  return (
    <TabsContext.Provider value={{ current, setCurrent }}>
      <div className={cx('space-y-4', className)}>
        <div className='flex flex-wrap items-center gap-2'>
          {panes.map((pane) => {
            const selected = pane.props.itemKey === current;
            return (
              <button
                key={pane.props.itemKey}
                type='button'
                className={cx(
                  'rounded-full px-4 py-2 text-sm transition',
                  selected
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300',
                )}
                onClick={() => setCurrent(pane.props.itemKey)}
              >
                {pane.props.tab}
              </button>
            );
          })}
          <div className='ml-auto'>{tabBarExtraContent}</div>
        </div>
        <div>{activePane?.props?.children}</div>
      </div>
    </TabsContext.Provider>
  );
}

export function Layout({ children, className, style }) {
  return <div className={cx('flex min-h-0 min-w-0', className)} style={style}>{children}</div>;
}

Layout.Header = ({ children, className, style }) => <header className={className} style={style}>{children}</header>;
Layout.Footer = ({ children, className, style }) => <footer className={className} style={style}>{children}</footer>;
Layout.Content = ({ children, className, style }) => <main className={cx('min-w-0 flex-1', className)} style={style}>{children}</main>;
Layout.Sider = ({ children, className, style }) => <aside className={className} style={style}>{children}</aside>;

function Overlay({ open, onClose, title, children, footer, width = 560, position = 'center' }) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className='fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/50 p-4' onClick={onClose}>
      <div
        className={cx(
          'relative max-h-[85vh] w-full overflow-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950',
          position === 'right' && 'ml-auto mr-0 h-full max-h-[100vh] rounded-none rounded-l-3xl',
        )}
        style={{ maxWidth: position === 'right' ? Math.min(width, window.innerWidth) : width }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className='mb-4 flex items-start justify-between gap-4'>
          <div className='text-lg font-semibold'>{title}</div>
          <button type='button' className='rounded-full p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900' onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div>{children}</div>
        {footer !== null ? (
          <div className='mt-6 flex justify-end gap-2'>
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export function Modal({
  visible,
  open,
  title,
  children,
  footer,
  onCancel,
  onOk,
  okText = '确定',
  cancelText = '取消',
  closable = true,
  width,
}) {
  const isOpen = visible ?? open;
  const computedFooter =
    footer === undefined
      ? (
          <>
            <Button theme='borderless' onClick={onCancel}>
              {cancelText}
            </Button>
            <Button onClick={onOk}>{okText}</Button>
          </>
        )
      : footer;

  return (
    <Overlay open={isOpen} onClose={closable ? onCancel : undefined} title={title} footer={computedFooter} width={width}>
      {children}
    </Overlay>
  );
}

function showToastByType(type, options = {}) {
  pushToast(type, {
    title: options.title,
    content: options.content,
  });
}

Modal.confirm = ({ title, content, onOk, onCancel }) => {
  const confirmed = typeof window === 'undefined' ? true : window.confirm([title, extractText(content)].filter(Boolean).join('\n\n'));
  if (confirmed) {
    onOk?.();
  } else {
    onCancel?.();
  }
  return { destroy() {} };
};
Modal.info = (options) => showToastByType('info', options);
Modal.success = (options) => showToastByType('success', options);
Modal.warning = (options) => showToastByType('warning', options);
Modal.error = (options) => showToastByType('error', options);

export function SideSheet({ visible, title, children, onCancel, footer, width = 720 }) {
  return (
    <Overlay open={visible} onClose={onCancel} title={title} footer={footer} width={width} position='right'>
      {children}
    </Overlay>
  );
}

export function Popconfirm({ title, onConfirm, children }) {
  return (
    <span
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof window === 'undefined' || window.confirm(extractText(title))) {
          onConfirm?.();
        }
      }}
    >
      {children}
    </span>
  );
}

const pushToast = (type, input) => {
  const message = typeof input === 'string' ? input : input?.content || input?.title;

  if (typeof window === 'undefined' || !message) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent('app-toast', {
      detail: {
        type,
        message,
      },
    }),
  );
};

export const Toast = {
  info: (input) => pushToast('info', input),
  success: (input) => pushToast('success', input),
  warning: (input) => pushToast('warning', input),
  error: (input) => pushToast('error', input),
  close: () => {},
};

export const Notification = Toast;

export function Pagination({ currentPage = 1, total = 0, pageSize = 10, onPageChange, className }) {
  return (
    <div className={className}>
      <HeroPagination
        page={currentPage}
        total={Math.max(1, Math.ceil(total / pageSize))}
        onChange={onPageChange}
      />
    </div>
  );
}

export function Descriptions({ data = [] }) {
  return (
    <dl className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
      {data.map((item) => (
        <div key={item.key || item.label} className='rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60'>
          <dt className='text-xs text-slate-500'>{item.key || item.label}</dt>
          <dd className='mt-1 text-sm text-slate-900 dark:text-slate-100'>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Image({ src, alt, className, style, ...props }) {
  return <img src={src} alt={alt} className={className} style={style} {...props} />;
}

export function ImagePreview({ src, alt, className, style, ...props }) {
  return <img src={src} alt={alt} className={className} style={style} {...props} />;
}

export function Highlight({ sourceString, searchWords = [] }) {
  const text = sourceString || '';
  const query = searchWords.find(Boolean);
  if (!query) return <>{text}</>;
  const index = text.toLowerCase().indexOf(String(query).toLowerCase());
  if (index === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
}

export function Timeline({ children }) {
  return <div className='space-y-4'>{children}</div>;
}

Timeline.Item = function TimelineItem({ children }) {
  return (
    <div className='flex gap-3'>
      <div className='mt-1 h-2 w-2 rounded-full bg-sky-500' />
      <div>{children}</div>
    </div>
  );
};

export function List({ dataSource = [], renderItem }) {
  return <div className='space-y-3'>{dataSource.map((item, index) => <div key={item.key || index}>{renderItem(item)}</div>)}</div>;
}

export function ScrollList({ children, className, style }) {
  return <div className={cx('flex gap-3 overflow-x-auto pb-2', className)} style={style}>{children}</div>;
}

export function ScrollItem({ children, className, style }) {
  return <div className={cx('shrink-0', className)} style={style}>{children}</div>;
}

export function Slider({ value = 0, onChange, min = 0, max = 100, step = 1, className, ...props }) {
  return (
    <input
      type='range'
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => toEventValue(onChange, Number(event.target.value), event)}
      className={cx('w-full', className)}
      {...props}
    />
  );
}

export function Steps({ current = 0, children }) {
  const items = React.Children.toArray(children);
  return (
    <div className='flex flex-wrap gap-3'>
      {items.map((item, index) => (
        <div key={item.key || index} className={cx('rounded-full px-3 py-1 text-sm', index <= current ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800')}>
          {item.props.title || item.props.children}
        </div>
      ))}
    </div>
  );
}

Steps.Step = function Step({ children }) {
  return <>{children}</>;
};

export function Collapse({ children, className }) {
  return <div className={cx('space-y-3', className)}>{children}</div>;
}

Collapse.Panel = function CollapsePanel({ header, children, itemKey, collapsible }) {
  return (
    <details className='rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/70' open={collapsible !== 'disabled'}>
      <summary className='cursor-pointer list-none font-medium'>{header || itemKey}</summary>
      <div className='mt-4'>{children}</div>
    </details>
  );
};

export function Collapsible({ isOpen = false, keepDOM, children, trigger }) {
  if (!keepDOM && !isOpen) {
    return trigger || null;
  }
  return (
    <div>
      {trigger}
      {isOpen ? children : keepDOM ? <div className='hidden'>{children}</div> : null}
    </div>
  );
}

function renderCell(column, record, rowIndex) {
  if (column.render) {
    return column.render(record[column.dataIndex], record, rowIndex);
  }
  return column.dataIndex ? record[column.dataIndex] : null;
}

export function Table({
  columns = [],
  dataSource = [],
  rowKey = 'id',
  loading,
  empty,
  pagination,
  className,
  rowSelection,
  expandedRowRender,
  onRow,
}) {
  if (loading) {
    return <div className='py-8 text-center'><Spin /></div>;
  }

  if (!dataSource?.length) {
    return empty || <Empty description='No data' />;
  }

  return (
    <div className={cx('overflow-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950', className)}>
      <table className='min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800'>
        <thead className='bg-slate-50 dark:bg-slate-900'>
          <tr>
            {rowSelection ? <th className='px-4 py-3 text-left' /> : null}
            {columns.map((column) => (
              <th key={column.key || column.dataIndex || extractText(column.title)} className='px-4 py-3 text-left font-medium text-slate-500'>
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className='divide-y divide-slate-100 dark:divide-slate-900'>
          {dataSource.map((record, rowIndex) => {
            const rowProps = onRow?.(record, rowIndex) || {};
            const key = typeof rowKey === 'function' ? rowKey(record) : record[rowKey] ?? rowIndex;
            return (
              <React.Fragment key={key}>
                <tr {...rowProps} className={cx('align-top', rowProps.className)}>
                  {rowSelection ? (
                    <td className='px-4 py-3'>
                      <input
                        type='checkbox'
                        checked={rowSelection.selectedRowKeys?.includes(key)}
                        onChange={(event) => {
                          const nextKeys = new Set(rowSelection.selectedRowKeys || []);
                          if (event.target.checked) nextKeys.add(key);
                          else nextKeys.delete(key);
                          rowSelection.onChange?.(
                            Array.from(nextKeys),
                            dataSource.filter((item) => nextKeys.has(typeof rowKey === 'function' ? rowKey(item) : item[rowKey])),
                          );
                        }}
                      />
                    </td>
                  ) : null}
                  {columns.map((column) => (
                    <td key={column.key || column.dataIndex || extractText(column.title)} className='px-4 py-3 text-slate-700 dark:text-slate-200'>
                      {renderCell(column, record, rowIndex)}
                    </td>
                  ))}
                </tr>
                {expandedRowRender ? (
                  <tr>
                    <td colSpan={columns.length + (rowSelection ? 1 : 0)} className='bg-slate-50 px-4 py-3 dark:bg-slate-900/60'>
                      {expandedRowRender(record, rowIndex)}
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      {pagination === false || !pagination ? null : <div className='border-t border-slate-200 px-4 py-3 dark:border-slate-800' />}
    </div>
  );
}

export function Chat({ chats = [], roleConfig = {}, renderMessage }) {
  return (
    <div className='space-y-3'>
      {chats.map((item, index) => (
        <div key={item.id || index} className='rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/70'>
          <div className='mb-2 text-xs uppercase tracking-wide text-slate-500'>
            {roleConfig[item.role]?.name || item.role}
          </div>
          <div>{renderMessage ? renderMessage(item, index) : item.content}</div>
        </div>
      ))}
    </div>
  );
}

export function TagInput({ value = [], onChange, placeholder }) {
  const [draft, setDraft] = useState('');
  const tags = Array.isArray(value) ? value : [];

  const addTag = () => {
    const next = draft.trim();
    if (!next) return;
    onChange?.([...tags, next]);
    setDraft('');
  };

  return (
    <div className='rounded-2xl border border-slate-200 px-3 py-2 dark:border-slate-700'>
      <div className='mb-2 flex flex-wrap gap-2'>
        {tags.map((tag) => (
          <Tag key={tag}>{tag}</Tag>
        ))}
      </div>
      <div className='flex gap-2'>
        <input className={cx(baseInputClass, 'border-0 p-0')} value={draft} placeholder={placeholder} onChange={(event) => setDraft(event.target.value)} />
        <Button size='small' onClick={addTag}>添加</Button>
      </div>
    </div>
  );
}

const FormContext = createContext(null);

// Form state hook with a stable `api` reference. We snapshot `values` and
// `initialValues` into refs and read from them lazily; this keeps `api`
// identity-stable across renders so consumers (FormContext, Form's
// useEffect, useImperativeHandle) don't fire in a loop every time a single
// field changes — which previously caused "Maximum update depth exceeded"
// the moment SettingsGeneral mounted.
function useFormState(initialValues) {
  const [values, setValues] = useState(initialValues || {});
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const initRef = useRef(initialValues);
  initRef.current = initialValues;

  const api = useMemo(
    () => ({
      getValues: () => valuesRef.current,
      getValue: (name) => valuesRef.current[name],
      setValue: (name, nextValue) =>
        setValues((prev) => ({ ...prev, [name]: nextValue })),
      setValues: (nextValues) =>
        setValues((prev) => ({ ...prev, ...nextValues })),
      reset: () => setValues(initRef.current || {}),
      validate: async () => valuesRef.current,
      submit: () => valuesRef.current,
    }),
    [],
  );

  return [values, setValues, api];
}

function FieldWrapper({ label, extraText, children, className, style }) {
  return (
    <div className={cx('space-y-2', className)} style={style}>
      {label ? <label className='text-sm font-medium text-slate-700 dark:text-slate-300'>{label}</label> : null}
      {children}
      {extraText ? <div className='text-xs text-slate-500'>{extraText}</div> : null}
    </div>
  );
}

function useFormField(field, initValue, transform) {
  const context = useContext(FormContext);
  const didInit = useRef(false);

  // Only backfill the initial value once per field, and only when the form
  // is uncontrolled. When the parent supplies `values`, the initial state
  // is its responsibility — re-writing through `setValues` here just
  // mutates the shadow internal state without changing what we render,
  // which previously fed an infinite re-render loop.
  useEffect(() => {
    if (didInit.current) return;
    if (!context || !field || initValue === undefined) return;
    if (context.isControlled) {
      didInit.current = true;
      return;
    }
    if (context.values[field] === undefined) {
      context.setValues((prev) => ({ ...prev, [field]: initValue }));
    }
    didInit.current = true;
  }, [context, field, initValue]);

  const value = field && context ? context.values[field] : undefined;
  const setValue = useCallback(
    (nextValue) => {
      if (field && context) {
        context.api.setValue(field, transform ? transform(nextValue) : nextValue);
      }
    },
    [context, field, transform],
  );

  return [value, setValue];
}

export const Form = forwardRef(function Form(
  { children, initValues, values: controlledValues, getFormApi, onSubmit, className, style },
  ref,
) {
  const [internalValues, setInternalValues, api] = useFormState(initValues);
  const isControlled = controlledValues !== undefined;
  const values = isControlled ? controlledValues : internalValues;

  useImperativeHandle(ref, () => api, [api]);

  // Stash the latest getFormApi callback so we can hand the api object to
  // the parent on first mount without re-running the effect every render
  // (the parent often passes a fresh inline arrow each time).
  const getFormApiRef = useRef(getFormApi);
  getFormApiRef.current = getFormApi;
  useEffect(() => {
    getFormApiRef.current?.(api);
  }, [api]);

  const contextValue = useMemo(
    () => ({
      values,
      setValues: setInternalValues,
      api,
      isControlled,
    }),
    [values, setInternalValues, api, isControlled],
  );

  // Support both regular children and Semi-style render-prop children. Some
  // legacy callers pass `({ formState, values, formApi }) => <JSX/>` to gain
  // access to current form state without using context directly.
  const renderedChildren =
    typeof children === 'function'
      ? children({ formState: { values }, values, formApi: api })
      : children;

  return (
    <FormContext.Provider value={contextValue}>
      <form
        className={cx('space-y-4', className)}
        style={style}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit?.(values);
        }}
      >
        {renderedChildren}
      </form>
    </FormContext.Provider>
  );
});

function createFormField(Component, mapValue = (value) => value, valuePropName = 'value') {
  return function FormField({ field, label, extraText, initValue, onChange, ...props }) {
    const [value, setValue] = useFormField(field, initValue, mapValue);
    const componentProps = {
      ...props,
      [valuePropName]: props[valuePropName] ?? value,
      onChange: (nextValue, event, extra) => {
        setValue(nextValue);
        onChange?.(nextValue, event, extra);
      },
    };

    return (
      <FieldWrapper label={label} extraText={extraText}>
        <Component {...componentProps} />
      </FieldWrapper>
    );
  };
}

Form.Input = createFormField(Input);
Form.TextArea = createFormField(TextArea);
Form.InputNumber = createFormField(InputNumber);
Form.Select = createFormField(Select);
Form.Switch = createFormField(Switch, Boolean, 'checked');
Form.Checkbox = createFormField(Checkbox, Boolean, 'checked');
Form.RadioGroup = createFormField(RadioGroup);
Form.DatePicker = createFormField(Input);
Form.AutoComplete = createFormField(Input);
Form.Upload = createFormField(function UploadField({ onChange, multiple, accept }) {
  return <input type='file' accept={accept} multiple={multiple} onChange={(event) => onChange?.(Array.from(event.target.files || []), event)} />;
});
Form.TagInput = createFormField(TagInput);
Form.Select.Option = Select.Option;

Form.Section = function FormSection({ text, children }) {
  return (
    <section className='space-y-4 rounded-3xl border border-slate-200 bg-white/70 p-5 dark:border-slate-800 dark:bg-slate-950/60'>
      <SectionLabel>{text}</SectionLabel>
      {children}
    </section>
  );
};

Form.Slot = function FormSlot({ label, extraText, children }) {
  return (
    <FieldWrapper label={label} extraText={extraText}>
      {children}
    </FieldWrapper>
  );
};

export const DatePicker = Input;
export const Calendar = function Calendar({ value, onChange }) {
  return <Input type='date' value={value} onChange={onChange} />;
};

export function Nav({
  children,
  isCollapsed,
  selectedKeys = [],
  openKeys = [],
  onOpenChange,
  onSelect,
  renderWrapper,
  className,
}) {
  return (
    <div className={cx('flex flex-col gap-2', className)}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        return React.cloneElement(child, {
          isCollapsed,
          selectedKeys,
          openKeys,
          onOpenChange,
          onSelect,
          renderWrapper,
        });
      })}
    </div>
  );
}

Nav.Item = function NavItem({
  text,
  icon,
  itemKey,
  isCollapsed,
  selectedKeys,
  onSelect,
  renderWrapper,
  className,
}) {
  const selected = selectedKeys?.includes(itemKey);
  const element = (
    <button
      type='button'
      className={cx(
        'flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm transition',
        selected
          ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-50'
          : 'text-slate-600 hover:bg-white/60 dark:text-slate-300 dark:hover:bg-slate-900/70',
        className,
      )}
      onClick={() => onSelect?.({ itemKey })}
    >
      {icon}
      {!isCollapsed ? <span className='truncate'>{text}</span> : null}
    </button>
  );

  return renderWrapper ? renderWrapper({ itemElement: element, props: { itemKey } }) : element;
};

Nav.Sub = function NavSub({
  text,
  icon,
  itemKey,
  children,
  isCollapsed,
  openKeys,
  onOpenChange,
  selectedKeys,
  onSelect,
  renderWrapper,
}) {
  const open = openKeys?.includes(itemKey);

  return (
    <div className='space-y-2'>
      <button
        type='button'
        className='flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-white/60 dark:text-slate-300 dark:hover:bg-slate-900/70'
        onClick={() =>
          onOpenChange?.({
            openKeys: open ? openKeys.filter((key) => key !== itemKey) : [...(openKeys || []), itemKey],
          })
        }
      >
        {icon}
        {!isCollapsed ? <span className='truncate'>{text}</span> : null}
        {!isCollapsed ? (
          <span className='ml-auto'>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
        ) : null}
      </button>
      {!isCollapsed && open ? (
        <div className='ml-4 space-y-1'>
          {React.Children.map(children, (child) =>
            React.isValidElement(child)
              ? React.cloneElement(child, {
                  isCollapsed,
                  selectedKeys,
                  onSelect,
                  renderWrapper,
                })
              : child,
          )}
        </div>
      ) : null}
    </div>
  );
};

export function SplitButtonGroup({ children }) {
  return <div className='inline-flex items-center gap-2'>{children}</div>;
}
