import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">Google Vertex AI Demo</h1>
      <div className="flex gap-4">
        <Link
          href="/edge"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Edge Runtime Demo
        </Link>
        <Link
          href="/node"
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
        >
          Node Runtime Demo
        </Link>
      </div>
    </main>
  );
}
