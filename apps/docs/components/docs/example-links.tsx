import Link from 'next/link';

export const ExampleLinks = ({
  examples,
  resolveHref = href => href,
}: {
  examples: { title: string; link: string }[];
  resolveHref?: (href: string) => string;
}) => (
  <div className="not-prose my-4 flex flex-col gap-2">
    {examples.map((example, index) => (
      <Link
        className="flex flex-row items-center gap-2 text-gray-900 text-sm hover:text-gray-1000"
        href={resolveHref(example.link)}
        key={`${example.link}-${example.title}-${index}`}
      >
        <span aria-hidden>↗</span>
        {example.title}
      </Link>
    ))}
  </div>
);
