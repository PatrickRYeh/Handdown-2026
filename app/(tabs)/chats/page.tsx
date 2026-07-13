import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchConversations } from '@/lib/conversations';
import { ConversationList } from '@/components/conversation-list';

// Chats tab (PRD §7.2): server-rendered conversations list, sorted by most
// recent message; the client component keeps it live via Realtime.
export default async function ChatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const conversations = await fetchConversations(supabase, user.id);

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 px-5 pb-3 pt-5 backdrop-blur">
        <h1 className="text-2xl font-bold text-brand">Chats</h1>
      </header>
      <ConversationList conversations={conversations} />
    </div>
  );
}
