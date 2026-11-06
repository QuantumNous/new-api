import { LogoIconVercel } from '@vercel/geistdocs/assets/logos';
import { LanguageSelector, ThemeToggle } from '@vercel/geistdocs/controls';

export const Footer = () => (
  <footer className="border-t px-4 py-5 md:px-6">
    <div className="mx-auto flex max-w-[1448px] flex-col items-center justify-between gap-4 sm:flex-row">
      <div className="flex items-center gap-2">
        <LogoIconVercel className="size-4 shrink-0" />
        <p className="text-center text-gray-800 text-sm sm:text-left">Vercel</p>
      </div>
      <div className="flex items-center gap-2">
        <LanguageSelector />
        <a
          aria-label="AI SDK on GitHub"
          className="inline-flex size-9 items-center justify-center rounded-md text-gray-900 hover:bg-gray-100 hover:text-gray-1000 focus-visible:ring-2 focus-visible:ring-blue-700"
          href="https://github.com/vercel/ai"
          rel="noopener noreferrer"
          target="_blank"
        >
          <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24">
            <path
              d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.87c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.35 1.09 2.92.83.09-.65.35-1.09.64-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0 1 12 6.82a9.6 9.6 0 0 1 2.5.34c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.86V21c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"
              fill="currentColor"
            />
          </svg>
        </a>
        <ThemeToggle />
      </div>
    </div>
  </footer>
);
