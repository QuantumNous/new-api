import Link from 'next/link';

const examples = [
  {
    title: 'useChat',
    link: '/01-chat-text',
  },
  {
    title: 'useChat with tools',
    link: '/02-chat-data',
  },
  {
    title: 'useChat with attachments',
    link: '/03-chat-attachments',
  },
];

export default function Home() {
  return (
    <main className="flex flex-col gap-2 p-4">
      {examples.map((example, index) => (
        <Link key={example.link} className="flex flex-row" href={example.link}>
          <div className="w-8 text-zinc-400">{index + 1}.</div>
          <div className="hover:underline">{example.title}</div>
        </Link>
      ))}
    </main>
  );
}
