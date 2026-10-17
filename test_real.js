import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vafrsmzqzgfuamrrtyob.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_nZncHSR3P5rsiXETvcPCvQ_YpM3YJFi';
const supabase = createClient(supabaseUrl, supabaseKey);

const channel = supabase.channel('system_online_users');

channel.on('presence', { event: 'sync' }, () => {
  const newState = channel.presenceState();
  console.log('sync', JSON.stringify(newState, null, 2));
});

channel.subscribe();
setTimeout(() => { process.exit(); }, 3000);
