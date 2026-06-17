import { NextResponse } from 'next/server';
import { createClient as createSSRClient } from '@/lib/supabase/server';
import { createClient as createVanillaClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    // 1. Verify caller is an admin
    const supabaseServer = await createSSRClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: profile } = await supabaseServer.from('profiles').select('role').eq('id', user.id).single();
    
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: "Acceso denegado: Solo los administradores pueden crear usuarios." }, { status: 403 });
    }

    // 2. Read request body
    const body = await request.json();
    const { email, password, full_name, role, section } = body;

    if (!email || !password || !full_name || !role) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    // 3. Create user using vanilla client
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const supabaseVanilla = createVanillaClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      }
    );

    let createdUser = null;
    let creationError: any = null;

    if (serviceRoleKey) {
      // Bypasses email confirmations and rate limits entirely by using the Admin Auth API
      const { data: adminData, error: adminError } = await supabaseVanilla.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name,
          role
        }
      });
      createdUser = adminData?.user || null;
      creationError = adminError;
    } else {
      // Fallback to standard signUp (subject to email confirmations and strict rate limits)
      const { data: signUpData, error: signUpError } = await supabaseVanilla.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name,
            role
          }
        }
      });
      createdUser = signUpData?.user || null;
      creationError = signUpError;
    }

    if (creationError || !createdUser) {
      const isRateLimit = creationError?.message?.toLowerCase().includes("rate limit") || creationError?.status === 429;
      const rateLimitMessage = "Límite de solicitudes de Supabase alcanzado. Por favor, configura la clave SUPABASE_SERVICE_ROLE_KEY en tu archivo .env.local para omitir los límites de tasa de registro de Supabase, o espera unos minutos antes de volver a intentarlo.";
      return NextResponse.json({ 
        error: isRateLimit ? rateLimitMessage : (creationError?.message || "Error al registrar usuario en Supabase.") 
      }, { status: isRateLimit ? 429 : 400 });
    }

    // 4. Save credentials securely in temp_credentials for admin review
    if (createdUser) {
      const { error: credsError } = await supabaseVanilla
        .from('temp_credentials')
        .insert({
          profile_id: createdUser.id,
          email,
          temp_password: password
        });

      if (credsError) {
        console.error('Error saving credentials in temp_credentials:', credsError);
        // Note: We don't fail the whole request since the user auth was already created,
        // but we log it for troubleshooting.
      }

      // 5. Associate student with their course section if role is student and section is provided
      if (role === 'student' && section) {
        let courseId = null;

        // Check if the course with this section already exists
        const { data: existingCourse } = await supabaseVanilla
          .from('courses')
          .select('id')
          .eq('section', section)
          .limit(1)
          .maybeSingle();

        if (existingCourse) {
          courseId = existingCourse.id;
        } else {
          // Auto-create a course for this section
          const { data: newCourse, error: courseError } = await supabaseVanilla
            .from('courses')
            .insert({
              name: `Aula ${section}`,
              section: section
            })
            .select('id')
            .single();

          if (!courseError && newCourse) {
            courseId = newCourse.id;
          } else {
            console.error('Error auto-creating course for section:', courseError);
          }
        }

        // Add user as a member of this course
        if (courseId) {
          const { error: memberError } = await supabaseVanilla
            .from('course_members')
            .insert({
              course_id: courseId,
              profile_id: createdUser.id
            });

          if (memberError) {
            console.error('Error enrolling student in course:', memberError);
          }
        }
      }
    }

    return NextResponse.json({ success: true, user: createdUser });
  } catch (err: any) {
    return NextResponse.json({ error: "Error interno del servidor: " + err.message }, { status: 500 });
  }
}
