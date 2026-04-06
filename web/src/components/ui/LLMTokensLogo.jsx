/**
 * LLMTokensLogo — inline React logo component for llm-tokens.com
 *
 * Props:
 *   size    — icon diameter in px (default 32)
 *   variant — 'icon' | 'wordmark' (default 'wordmark')
 *   theme   — 'dark' | 'light' (default 'dark')
 */
const TokenIcon = ({ size = 32 }) => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    viewBox='0 0 48 48'
    fill='none'
    width={size}
    height={size}
    aria-hidden='true'
  >
    <defs>
      <clipPath id='lt-clip'>
        <circle cx='24' cy='24' r='19.5' />
      </clipPath>
      <linearGradient id='lt-ring' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stopColor='#34D399' />
        <stop offset='100%' stopColor='#059669' />
      </linearGradient>
    </defs>
    <circle cx='24' cy='24' r='23' fill='#0A0F0D' />
    <g clipPath='url(#lt-clip)'>
      {/* Row 1 — bright left */}
      <rect x='4'  y='13'    width='16' height='5.5' rx='2.75' fill='#10B981' />
      <rect x='23' y='13'    width='11' height='5.5' rx='2.75' fill='#10B981' opacity='0.45' />
      <rect x='37' y='13'    width='8'  height='5.5' rx='2.75' fill='#10B981' opacity='0.18' />
      {/* Row 2 — bright center */}
      <rect x='4'  y='21.25' width='8'  height='5.5' rx='2.75' fill='#10B981' opacity='0.22' />
      <rect x='15' y='21.25' width='16' height='5.5' rx='2.75' fill='#10B981' opacity='0.88' />
      <rect x='34' y='21.25' width='11' height='5.5' rx='2.75' fill='#10B981' opacity='0.38' />
      {/* Row 3 — bright right */}
      <rect x='4'  y='29.5'  width='7'  height='5.5' rx='2.75' fill='#10B981' opacity='0.15' />
      <rect x='14' y='29.5'  width='10' height='5.5' rx='2.75' fill='#10B981' opacity='0.45' />
      <rect x='27' y='29.5'  width='17' height='5.5' rx='2.75' fill='#10B981' />
    </g>
    <circle cx='24' cy='24' r='22' stroke='url(#lt-ring)' strokeWidth='1.25' fill='none' />
    <path
      d='M 8.5 14 A 18 18 0 0 1 39.5 14'
      stroke='white'
      strokeWidth='0.75'
      opacity='0.12'
      strokeLinecap='round'
      fill='none'
    />
  </svg>
);

const LLMTokensLogo = ({ size = 32, variant = 'wordmark', theme = 'dark' }) => {
  const textColor = theme === 'dark' ? '#f0fdf4' : '#0A0F0D';
  const subColor = '#10B981';

  if (variant === 'icon') return <TokenIcon size={size} />;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.round(size * 0.3),
        textDecoration: 'none',
      }}
    >
      <TokenIcon size={size} />
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span
          style={{
            fontFamily: "'DM Mono', 'IBM Plex Mono', 'Fira Code', monospace",
            fontSize: Math.round(size * 0.44),
            fontWeight: 500,
            letterSpacing: '0.03em',
            color: textColor,
          }}
        >
          llm-tokens
        </span>
        <span
          style={{
            fontFamily: "'DM Mono', 'IBM Plex Mono', 'Fira Code', monospace",
            fontSize: Math.round(size * 0.28),
            fontWeight: 400,
            letterSpacing: '0.18em',
            color: subColor,
            marginTop: 2,
          }}
        >
          .com
        </span>
      </span>
    </span>
  );
};

export { TokenIcon };
export default LLMTokensLogo;
