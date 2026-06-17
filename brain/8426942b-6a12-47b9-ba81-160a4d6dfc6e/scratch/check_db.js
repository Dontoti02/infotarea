const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '..', '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    envVars[key] = value;
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Test join with specific foreign keys
  // Let's try profiles!teacher_id
  const { data: d1, error: e1 } = await supabase
    .from('courses')
    .select('*, teacher:profiles!teacher_id(full_name)')
    .limit(1);
    
  if (e1) {
    console.log("profiles!teacher_id failed:", e1.message);
  } else {
    console.log("profiles!teacher_id succeeded!", d1[0]);
  }

  // Let's also try profiles!courses_teacher_id_fkey
  const { data: d2, error: e2 } = await supabase
    .from('courses')
    .select('*, teacher:profiles!courses_teacher_id_fkey(full_name)')
    .limit(1);
    
  if (e2) {
    console.log("profiles!courses_teacher_id_fkey failed:", e2.message);
  } else {
    console.log("profiles!courses_teacher_id_fkey succeeded!", d2[0]);
  }
}

main();
