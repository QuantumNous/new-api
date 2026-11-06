import { loadChat } from '@/util/chat-store';
import { Chat } from '../chat';

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const messages = await loadChat(id);

  return <Chat id={id} autoResume={true} initialMessages={messages} />;
}
