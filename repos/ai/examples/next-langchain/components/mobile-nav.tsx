'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Zap, Menu, X, ExternalLink } from 'lucide-react';
import { navItems } from '../app/constants';

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const currentPage = navItems.find(item => item.href === pathname);

  return (
    <div className="lg:hidden">
      {/* Mobile header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--background-secondary)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-600 to-yellow-500 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" strokeWidth={2} />
          </div>
          <div>
            <h1 className="font-semibold text-sm text-[var(--foreground)]">
              {currentPage?.label || 'AI SDK + LangChain'}
            </h1>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-lg hover:bg-[var(--background-tertiary)] transition-colors"
          aria-label="Toggle menu"
        >
          {isOpen ? (
            <X className="w-6 h-6 text-[var(--foreground)]" strokeWidth={2} />
          ) : (
            <Menu
              className="w-6 h-6 text-[var(--foreground)]"
              strokeWidth={2}
            />
          )}
        </button>
      </div>

      {/* Mobile menu dropdown */}
      {isOpen && (
        <div className="absolute top-[65px] left-0 right-0 z-50 bg-[var(--background-secondary)] border-b border-[var(--border)] shadow-lg animate-fade-in">
          <nav className="p-4 space-y-2">
            {navItems.map(item => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex flex-col px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? 'bg-[var(--accent-light)] text-[var(--accent)]'
                      : 'hover:bg-[var(--background-tertiary)] text-[var(--foreground-secondary)]'
                  }`}
                >
                  <span className="font-medium">{item.label}</span>
                  <span className="text-xs text-[var(--foreground-secondary)]">
                    {item.description}
                  </span>
                </Link>
              );
            })}
          </nav>
          <div className="p-4 pt-0 border-t border-[var(--border)] mt-2">
            <a
              href="https://sdk.vercel.ai/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--foreground-secondary)] hover:text-[var(--foreground)]"
            >
              Documentation
              <ExternalLink className="w-3 h-3" strokeWidth={2} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
