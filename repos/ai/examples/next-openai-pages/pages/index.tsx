import Link from 'next/link';

const examples = [
  {
    title: 'Generate text',
    link: '/basics/generate-text',
  },
  {
    title: 'Stream text',
    link: '/basics/stream-text',
  },
  {
    title: 'Generate object',
    link: '/basics/generate-object',
  },
  {
    title: 'Stream object',
    link: '/basics/stream-object',
  },
  {
    title: 'Generate chat completion',
    link: '/chat/generate-chat',
  },
  {
    title: 'Stream chat completion',
    link: '/chat/stream-chat',
  },
  {
    title: 'Stream chat completion (API route)',
    link: '/chat/stream-chat-api-route',
  },
  {
    title: 'Stream chat completion (edge runtime)',
    link: '/chat/stream-chat-edge',
  },
  {
    title: 'Call tools',
    link: '/tools/call-tool',
  },
  {
    title: 'Call tools in parallel',
    link: '/tools/call-tools-in-parallel',
  },
  {
    title: 'Route components using language model',
    link: '/generative-user-interface/route-components',
  },
  {
    title: 'Stream OpenAI Assistant API response',
    link: '/assistants/stream-assistant-response',
  },
  {
    title: 'Stream OpenAI Assistant API response with tool calls',
    link: '/assistants/stream-assistant-response-with-tools',
  },
  {
    title: 'Stream OpenAI Assistant API response and switch between threads',
    link: '/assistants/stream-assistant-switch-threads',
  },
];

export default function Home() {
  return (
    <main className={`flex flex-col gap-2 p-2`}>
      {examples.map((example, index) => (
        <Link key={example.link} className="flex flex-row" href={example.link}>
          <div className="w-8 text-zinc-400">{index + 1}.</div>
          <div className="hover:underline">{example.title}</div>
        </Link>
      ))}
    </main>
  );
}
