import './globals.css';

export const metadata = {
  title: 'AI SDK - WorkflowAgent Chat',
  description:
    'Example of using the AI SDK WorkflowAgent with Next.js and Workflow DevKit.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
