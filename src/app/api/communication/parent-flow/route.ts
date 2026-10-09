import { NextResponse } from 'next/server';
import { createClient as createSSRClient } from '@/lib/supabase/server';
import { processParentProgressiveFlow } from '@/shared/utils/domain-logic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');

    const supabase = await createSSRClient();
    const { data: { user } } = await supabase.auth.getUser();

    const targetStudentId = studentId || user?.id;
    if (!targetStudentId) {
      return NextResponse.json({ error: 'Estudiante no especificado' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('parent_student_links')
      .select('*')
      .eq('student_id', targetStudentId)
      .maybeSingle();

    if (error || !data) {
      const cleanId = targetStudentId.substring(0, 4).toUpperCase();
      // Default initial progressive state
      return NextResponse.json({
        success: true,
        link: {
          student_id: targetStudentId,
          progressive_stage: 1,
          status: 'pending',
          invite_code: `PADRE-${cleanId}-2026`,
          share_grades: true,
          share_tasks: true,
          share_attendance: true
        }
      });
    }

    return NextResponse.json({ success: true, link: data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSSRClient();
    const { data: { user } } = await supabase.auth.getUser();

    const body = await request.json();
    const studentId = user?.id || body.studentId || 'demo-student';

    const result = processParentProgressiveFlow({
      studentId,
      parentName: body.parentName,
      parentEmail: body.parentEmail,
      parentPhone: body.parentPhone,
      currentStage: body.currentStage || 1,
      targetStage: body.targetStage || 2,
      shareGrades: body.shareGrades ?? true,
      shareTasks: body.shareTasks ?? true
    });

    if (!result.success) {
      return NextResponse.json({ error: result.errors.join(', ') }, { status: 400 });
    }

    // Try persisting to Supabase parent_student_links
    const upsertData = {
      student_id: studentId,
      parent_name: body.parentName || null,
      parent_email: body.parentEmail || null,
      parent_phone: body.parentPhone || null,
      invite_code: result.inviteCode,
      progressive_stage: result.currentStage,
      status: result.status,
      share_grades: body.shareGrades ?? true,
      share_tasks: body.shareTasks ?? true,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('parent_student_links')
      .upsert(upsertData, { onConflict: 'student_id' })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({
        success: true,
        flow: {
          ...upsertData,
          id: 'mock-link-' + Date.now()
        },
        message: result.message,
        persisted: false
      });
    }

    return NextResponse.json({
      success: true,
      flow: data,
      message: result.message,
      persisted: true
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
