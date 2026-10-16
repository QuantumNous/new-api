import { redirect } from 'next/navigation';
import { createChat } from '@util/chat-store';

export default async function ChatPage() {
  const chatId = await createChat();
  redirect(`/chat/persistence-metadata/${chatId}`);
}
