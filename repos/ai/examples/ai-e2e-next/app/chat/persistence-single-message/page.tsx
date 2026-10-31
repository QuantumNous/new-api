import { redirect } from 'next/navigation';
import { createChat } from '@util/chat-store';

export default async function ChatPage() {
  const id = await createChat();
  redirect(`/chat/persistence-single-message/${id}`);
}
