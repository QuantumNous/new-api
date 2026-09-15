import Link from 'next/link';

export const IndexCards = ({
  cards,
  resolveHref = href => href,
}: {
  cards: {
    title: string;
    description: string;
    href: string;
  }[];
  resolveHref?: (href: string) => string;
}) => (
  <div className="not-prose grid grid-cols-1 gap-4 sm:grid-cols-2">
    {cards.map(card => (
      <Link
        className="flex flex-col gap-1 rounded-lg border border-gray-alpha-400 p-4 hover:border-gray-alpha-600"
        href={resolveHref(card.href)}
        key={card.href}
      >
        <div className="font-medium text-gray-1000">{card.title}</div>
        <div className="text-gray-900 text-sm">{card.description}</div>
      </Link>
    ))}
  </div>
);
