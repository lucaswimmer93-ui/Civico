// ADD THIS AT BOTTOM OF messages.js

export async function getThreadReadState(threadId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("message_read_status")
    .select("user_id, last_read_at")
    .eq("thread_id", threadId);

  if (error) throw error;

  const others = (data || []).filter(r => r.user_id !== user.id);

  const lastReadByOthersAt = others.length
    ? others.reduce((max, r) => {
        if (!r.last_read_at) return max;
        return !max || r.last_read_at > max ? r.last_read_at : max;
      }, null)
    : null;

  return {
    currentUserId: user.id,
    lastReadByOthersAt
  };
}
