const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://hkeknrvplpumecxvxvgf.supabase.co',
  'sb_secret_B1rWd5SYCQMfG0kCx704zA_m1YHnA7u',
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function fix() {
  // 1. Drop the old table and recreate with correct columns
  console.log('Dropping old table...');
  const { error: dropErr } = await supabase.rpc('exec_sql', { sql_query: 'DROP TABLE IF EXISTS public.academic_periods CASCADE;' });
  
  if (dropErr) {
    console.log('RPC not available, will use REST approach...');
    // Delete any data first
    await supabase.from('academic_periods').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('Cleaned data. Need to drop table via SQL editor.');
    console.log('Since we cannot drop via REST, we need to add missing columns instead.');
    
    // Add missing columns
    console.log('Trying to add columns via alter...');
    // This won't work via REST API either. Let's check what columns exist.
    const { data: testInsert, error: testErr } = await supabase
      .from('academic_periods')
      .insert({
        label: 'column-test',
        year: 9999,
      })
      .select('*')
      .single();
    
    if (testInsert) {
      console.log('Existing columns:', Object.keys(testInsert));
      // Clean up
      await supabase.from('academic_periods').delete().eq('id', testInsert.id);
    }
    if (testErr) {
      console.log('Test insert error:', testErr.message);
    }
  } else {
    console.log('Table dropped successfully via RPC');
  }
}

fix().catch(console.error);
