const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envUrl = 'https://hkeknrvplpumecxvxvgf.supabase.co';
const envKey = 'sb_secret_B1rWd5SYCQMfG0kCx704zA_m1YHnA7u';

const supabase = createClient(envUrl, envKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function test() {
  const testEmail = `test.student.${Date.now()}@infotarea.com`;
  console.log('1. Creating test auth user for:', testEmail);
  
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: 'password123',
    email_confirm: true,
    user_metadata: { full_name: 'Test Parallel Profile Trigger', role: 'student' }
  });

  if (authErr) {
    console.error('FAILED to create auth user:', authErr.message);
    process.exit(1);
  }

  const newUserId = authData.user.id;
  console.log('Successfully created auth user with ID:', newUserId);

  // 2. Wait 1 second for any triggers
  await new Promise(r => setTimeout(r, 1000));

  // 3. Query profiles table
  console.log('2. Querying profiles table for ID...');
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', newUserId)
    .single();

  if (profileErr) {
    console.error('FAILED to fetch profile from profiles table:', profileErr.message);
  } else {
    console.log('SUCCESS! Profile automatically created by trigger:', profile);
  }

  // 4. Test manual temp_credentials insertion
  console.log('3. Testing temp_credentials insertion...');
  const { error: credsErr } = await supabase
    .from('temp_credentials')
    .insert({
      profile_id: newUserId,
      email: testEmail,
      temp_password: 'password123'
    });

  if (credsErr) {
    console.error('FAILED to insert into temp_credentials:', credsErr.message);
  } else {
    console.log('SUCCESS! Inserted into temp_credentials.');
  }

  // 5. Test manual course creation and membership
  console.log('4. Testing courses & course_members...');
  const { data: course, error: courseErr } = await supabase
    .from('courses')
    .insert({ name: 'Aula 9Z', section: '9Z' })
    .select('id')
    .single();

  let courseId = course?.id;
  if (courseErr) {
    console.log('Note: courses insert error or duplicate:', courseErr.message);
    // Try selection
    const { data: existing } = await supabase
      .from('courses')
      .select('id')
      .eq('section', '9Z')
      .maybeSingle();
    courseId = existing?.id;
  }

  if (courseId) {
    console.log('Course ID:', courseId);
    const { error: memberErr } = await supabase
      .from('course_members')
      .insert({ course_id: courseId, profile_id: newUserId });

    if (memberErr) {
      console.error('FAILED to insert into course_members:', memberErr.message);
    } else {
      console.log('SUCCESS! Inserted into course_members.');
    }
  }

  // Cleanup
  console.log('5. Cleaning up...');
  await supabase.auth.admin.deleteUser(newUserId);
  if (courseId) {
    await supabase.from('courses').delete().eq('id', courseId);
  }
  console.log('Done!');
}

test().catch(console.error);
