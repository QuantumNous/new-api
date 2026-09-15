import Link from 'next/link';

const VARIANTS = [
  { slug: 'basic', label: 'Basic' },
  { slug: 'basic-with-stop', label: 'Basic (with stop)' },
  { slug: 'ai-sdk-coding', label: 'AI SDK Coding' },
  { slug: 'weather', label: 'Weather' },
  { slug: 'weather-only', label: 'Weather Only' },
  { slug: 'weather-approval', label: 'Weather Approval' },
  { slug: 'workflow', label: 'Workflow' },
] as const;

const HARNESSES = [
  {
    slug: 'claude-code',
    label: 'Claude Code',
    variants: [
      'basic',
      'basic-with-stop',
      'ai-sdk-coding',
      'weather',
      'weather-only',
      'weather-approval',
      'workflow',
    ],
  },
  {
    slug: 'codex',
    label: 'Codex',
    variants: [
      'basic',
      'basic-with-stop',
      'ai-sdk-coding',
      'weather',
      'weather-approval',
      'workflow',
    ],
  },
  {
    slug: 'deepagents',
    label: 'Deep Agents',
    variants: [
      'basic',
      'basic-with-stop',
      'ai-sdk-coding',
      'weather',
      'weather-only',
      'weather-approval',
      'workflow',
    ],
  },
  {
    slug: 'opencode',
    label: 'OpenCode',
    variants: [
      'basic',
      'basic-with-stop',
      'ai-sdk-coding',
      'weather',
      'weather-only',
      'weather-approval',
      'workflow',
    ],
  },
  {
    slug: 'pi',
    label: 'Pi',
    variants: [
      'basic',
      'basic-with-stop',
      'ai-sdk-coding',
      'weather',
      'weather-only',
      'weather-approval',
      'workflow',
    ],
  },
] as const;

const VARIANT_LABELS: Record<string, string> = Object.fromEntries(
  VARIANTS.map(v => [v.slug, v.label]),
);

export default function Home() {
  return (
    <main className="flex flex-col gap-4 pt-12 pb-24 mx-auto w-full max-w-5xl">
      <h1 className="text-xl font-bold">Harness examples</h1>
      <ul className="flex flex-col gap-4 pl-0 list-none">
        {HARNESSES.map(h => (
          <li key={h.slug}>
            <span className="font-semibold">{h.label}</span>
            <ul className="list-disc pl-6">
              {h.variants.map(variant => (
                <li key={variant}>
                  <Link
                    href={`/harness/${h.slug}/${variant}`}
                    className="text-blue-600 underline"
                  >
                    {VARIANT_LABELS[variant] ?? variant}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </main>
  );
}
