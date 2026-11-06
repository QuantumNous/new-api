'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Github, ExternalLink } from 'lucide-react';
import { navItems } from '../app/constants';

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-72 h-screen flex-col border-r border-[var(--border)] bg-[var(--background-secondary)]">
      {/* Logo */}
      <div className="flex items-center gap-3 p-5 border-b border-[var(--border)]">
        <div className="w-9 h-9 rounded-lg bg-[var(--background-tertiary)] border border-[var(--border)] flex items-center justify-center text-xs leading-none whitespace-nowrap">
          <span>🦜</span>
          <span>🔗</span>
        </div>
        <div>
          <h1 className="font-semibold text-[var(--foreground)]">LangChain</h1>
          <p className="text-xs text-[var(--foreground-muted)]">
            AI SDK Examples
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-xs font-semibold text-[var(--foreground-secondary)] uppercase tracking-wider">
          Examples
        </div>
        {navItems.map(item => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-start gap-3 px-3 py-3 rounded-lg transition-all ${
                isActive
                  ? 'bg-[var(--accent-light)] text-[var(--accent)]'
                  : 'hover:bg-[var(--background-tertiary)] text-[var(--foreground-secondary)] hover:text-[var(--foreground)]'
              }`}
            >
              <span
                className={`flex-shrink-0 mt-0.5 ${isActive ? 'text-[var(--accent)]' : 'text-[var(--foreground-secondary)] group-hover:text-[var(--foreground)]'}`}
              >
                <Icon className="w-5 h-5" strokeWidth={1.5} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{item.label}</span>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-[var(--accent-light)] text-[var(--accent)]">
                      {item.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--foreground-secondary)] truncate mt-0.5 opacity-80">
                  {item.description}
                </p>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--border)]">
        <a
          href="https://ai-sdk.dev/providers/adapters/langchain#langchain"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--background-tertiary)] rounded-lg transition-colors"
        >
          <BookOpen className="w-4 h-4" strokeWidth={1.5} />
          Documentation
          <ExternalLink className="w-3 h-3 ml-auto" strokeWidth={2} />
        </a>
        <a
          href="https://github.com/vercel/ai/tree/main/examples/next-langchain"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--background-tertiary)] rounded-lg transition-colors"
        >
          <Github className="w-4 h-4" strokeWidth={1.5} />
          GitHub
          <ExternalLink className="w-3 h-3 ml-auto" strokeWidth={2} />
        </a>
      </div>
    </aside>
  );
}
