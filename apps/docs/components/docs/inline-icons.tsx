/** Inline check/cross marks used heavily in provider capability tables. */

export const Check = ({ size = 18 }: { size?: number }) => (
  <span className="inline-flex align-middle text-green-900">
    <svg
      aria-label="Supported"
      fill="none"
      height={size}
      role="img"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
      width={size}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  </span>
);

export const Cross = ({ size = 18 }: { size?: number }) => (
  <span className="inline-flex align-middle text-gray-900">
    <svg
      aria-label="Not supported"
      fill="none"
      height={size}
      role="img"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
      width={size}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  </span>
);
