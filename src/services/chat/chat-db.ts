import { getSupabaseOrNull } from '@/lib/supabase';
import type { ChatConversationRow, ChatMessageRow } from '@/types/database';

export async function fetchLatestConversation(): Promise<ChatConversationRow | null> {
  const rows = await fetchConversations();
  return rows[0] ?? null;
}

export async function fetchConversations(): Promise<ChatConversationRow[]> {
  const supabase = getSupabaseOrNull();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('chat_conversations')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) {
    if (error.message.includes('does not exist')) {
      return [];
    }
    throw new Error(error.message);
  }
  return (data ?? []) as ChatConversationRow[];
}

export async function fetchConversationById(
  conversationId: string,
): Promise<ChatConversationRow | null> {
  const supabase = getSupabaseOrNull();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('chat_conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as ChatConversationRow | null) ?? null;
}

export async function fetchConversationMessages(
  conversationId: string,
): Promise<ChatMessageRow[]> {
  const supabase = getSupabaseOrNull();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at');

  if (error) {
    if (error.message.includes('does not exist')) {
      throw new Error(
        'Chat tables not found. Apply migrations in Supabase (see docs/supabase-dashboard-setup.md).',
      );
    }
    throw new Error(error.message);
  }
  return (data ?? []) as ChatMessageRow[];
}
