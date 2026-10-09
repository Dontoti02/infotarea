import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * PRUEBAS DE ACEPTACIÓN (ACCEPTANCE / BDD TESTS)
 * Sistema InfoTarea - Primera Entrega
 * Basadas en Criterios de Aceptación Given-When-Then (Gherkin BDD)
 * para validar los flujos de negocio clave desde la perspectiva del usuario final.
 */

// Simulación de Flujos de Aceptación de Negocio
class InfoTareaAcceptanceFlows {
  constructor() {
    this.users = new Map();
    this.courses = new Map();
    this.enrollments = [];
    this.tasks = new Map();
    this.submissions = new Map();
    this.academicPeriods = [];
    this.messages = [];
    this.adminNotices = [];
    this.parentLinks = new Map();
  }

  // HU-01: Autenticación y Redirección por Rol
  loginUser(email, password) {
    const user = Array.from(this.users.values()).find(u => u.email === email && u.password === password);
    if (!user) return { success: false, redirectUrl: '/login?error=invalid_credentials' };
    
    let redirectUrl = '/';
    if (user.role === 'admin') redirectUrl = '/admin/dashboard';
    else if (user.role === 'teacher') redirectUrl = '/teacher/dashboard';
    else if (user.role === 'student') redirectUrl = '/student/dashboard';

    return { success: true, user, redirectUrl };
  }

  // HU-02: Creación de usuario y asignación a aula
  createUserAndEnroll(adminUser, { email, password, full_name, role, section }) {
    if (adminUser.role !== 'admin') throw new Error('Unauthorized');
    const userId = 'usr-' + (this.users.size + 1);
    const user = { id: userId, email, password, full_name, role };
    this.users.set(userId, user);

    if (role === 'student' && section) {
      let course = Array.from(this.courses.values()).find(c => c.section === section);
      if (!course) {
        const courseId = 'course-' + (this.courses.size + 1);
        course = { id: courseId, name: `Aula ${section}`, section };
        this.courses.set(courseId, course);
      }
      this.enrollments.push({ courseId: course.id, studentId: userId });
    }
    return user;
  }

  // HU-03: Creación de tarea por docente
  createTask(teacherUser, { title, description, dueDate, courseId, taskType }) {
    if (teacherUser.role !== 'teacher') throw new Error('Solo los docentes pueden crear tareas');
    const taskId = 'task-' + (this.tasks.size + 1);
    const task = {
      id: taskId,
      title,
      description,
      dueDate: new Date(dueDate),
      courseId,
      taskType,
      teacherId: teacherUser.id,
      createdAt: new Date()
    };
    this.tasks.set(taskId, task);
    return task;
  }

  // HU-04: Envío de entrega por estudiante
  submitTask(studentUser, { taskId, content, submittedAt = new Date() }) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error('Tarea no encontrada');
    const isEnrolled = this.enrollments.some(e => e.courseId === task.courseId && e.studentId === studentUser.id);
    if (!isEnrolled) throw new Error('El estudiante no pertenece a este curso');

    const subId = 'sub-' + (this.submissions.size + 1);
    const status = submittedAt.getTime() <= task.dueDate.getTime() ? 'submitted_on_time' : 'submitted_late';
    const submission = {
      id: subId,
      taskId,
      studentId: studentUser.id,
      content,
      submittedAt,
      status,
      score: null,
      feedback: null
    };
    this.submissions.set(subId, submission);
    return submission;
  }

  // HU-05: Calificación y feedback por docente
  gradeSubmission(teacherUser, { submissionId, score, feedback }) {
    if (teacherUser.role !== 'teacher') throw new Error('Unauthorized');
    const submission = this.submissions.get(submissionId);
    if (!submission) throw new Error('Entrega no encontrada');
    if (score < 0 || score > 20) throw new Error('Nota fuera de rango');

    submission.score = score;
    submission.feedback = feedback;
    submission.status = 'graded';
    return submission;
  }

  // HU-06: Cierre de año escolar por administrador
  closeAcademicYear(adminUser, { yearLabel, yearNumber }) {
    if (adminUser.role !== 'admin') throw new Error('Unauthorized');
    const period = {
      id: 'period-' + (this.academicPeriods.length + 1),
      yearLabel,
      yearNumber,
      closedBy: adminUser.id,
      totalStudentsArchived: Array.from(this.users.values()).filter(u => u.role === 'student').length,
      totalTasksArchived: this.tasks.size,
      totalSubmissionsArchived: this.submissions.size
    };
    this.academicPeriods.push(period);
    // Limpieza de tablas operacionales
    this.tasks.clear();
    this.submissions.clear();
    return period;
  }

  // HU-12: Comunicación Docente-Estudiante (chat y flujo principal)
  sendChatMessage(senderUser, { receiverId, courseId, content, channelType = 'teacher_student' }) {
    if (!['teacher', 'student'].includes(senderUser.role)) {
      throw new Error('Solo docentes y estudiantes participan en el chat pedagógico');
    }
    if (!content || !content.trim()) throw new Error('El mensaje no puede estar vacío');

    const message = {
      id: 'msg-' + (this.messages.length + 1),
      senderId: senderUser.id,
      senderRole: senderUser.role,
      receiverId,
      courseId,
      channelType,
      content: content.trim(),
      isRead: false,
      sentAt: new Date()
    };
    this.messages.push(message);
    return message;
  }

  // HU-13: Comunicación Administrador-Docente (avisos y mensajes)
  publishAdminTeacherNotice(adminUser, { title, content, priority = 'urgente' }) {
    if (adminUser.role !== 'admin') throw new Error('Solo los administradores pueden emitir avisos oficiales');
    if (!title || !content) throw new Error('Datos incompletos para el aviso');

    const notice = {
      id: 'notice-' + (this.adminNotices.length + 1),
      title: title.trim(),
      content: content.trim(),
      priority,
      targetRole: 'teacher',
      senderId: adminUser.id,
      publishedAt: new Date(),
      acknowledgedBy: []
    };
    this.adminNotices.push(notice);
    return notice;
  }

  // HU-14: Comunicación Estudiante-Padre (habilitación progresiva del flujo)
  updateParentProgressiveFlow(studentUser, { parentName, parentEmail, targetStage }) {
    if (studentUser.role !== 'student') throw new Error('Solo los estudiantes configuran su vínculo familiar');
    if (targetStage < 1 || targetStage > 3) throw new Error('Etapa de habilitación fuera de rango [1, 3]');

    const link = {
      id: 'link-' + studentUser.id,
      studentId: studentUser.id,
      parentName: parentName || 'Apoderado Registrado',
      parentEmail: parentEmail || 'padre@infotarea.edu',
      progressiveStage: targetStage,
      status: targetStage === 3 ? 'active' : targetStage === 2 ? 'linked' : 'pending',
      inviteCode: `PADRE-${studentUser.id.toUpperCase()}-2026`,
      shareGrades: true,
      shareTasks: true,
      updatedAt: new Date()
    };
    this.parentLinks.set(studentUser.id, link);
    return link;
  }
}

// ===============================================
// SUITE DE PRUEBAS DE ACEPTACIÓN BDD
// ===============================================

test('ACEP-01: HU-01 Autenticación y redirección al Dashboard según el rol', () => {
  const app = new InfoTareaAcceptanceFlows();
  
  // GIVEN: Existen usuarios con diferentes roles en el sistema
  app.users.set('admin-1', { id: 'admin-1', email: 'admin@infotarea.edu', password: 'SecretPassword123!', role: 'admin' });
  app.users.set('teacher-1', { id: 'teacher-1', email: 'docente@infotarea.edu', password: 'DocentePassword123!', role: 'teacher' });
  app.users.set('student-1', { id: 'student-1', email: 'alumno@infotarea.edu', password: 'AlumnoPassword123!', role: 'student' });

  // WHEN: El administrador inicia sesión con credenciales correctas
  const adminLogin = app.loginUser('admin@infotarea.edu', 'SecretPassword123!');
  // THEN: El sistema lo autentica y redirige al panel de administración
  assert.equal(adminLogin.success, true);
  assert.equal(adminLogin.redirectUrl, '/admin/dashboard');

  // WHEN: El docente inicia sesión
  const teacherLogin = app.loginUser('docente@infotarea.edu', 'DocentePassword123!');
  // THEN: Redirige al panel de gestión docente
  assert.equal(teacherLogin.redirectUrl, '/teacher/dashboard');

  // WHEN: El estudiante inicia sesión
  const studentLogin = app.loginUser('alumno@infotarea.edu', 'AlumnoPassword123!');
  // THEN: Redirige al dashboard del estudiante
  assert.equal(studentLogin.redirectUrl, '/student/dashboard');

  // WHEN: Se ingresa una contraseña errónea
  const failedLogin = app.loginUser('admin@infotarea.edu', 'WrongPassword');
  // THEN: Deniega el acceso y permanece en login con aviso de error
  assert.equal(failedLogin.success, false);
  assert.ok(failedLogin.redirectUrl.includes('/login?error=invalid_credentials'));
});

test('ACEP-02: HU-02 Administrador registra un estudiante y el sistema crea automáticamente su aula', () => {
  const app = new InfoTareaAcceptanceFlows();
  const admin = { id: 'admin-1', role: 'admin' };

  // GIVEN: El administrador está autenticado en la plataforma
  // WHEN: Registra un nuevo estudiante indicando el aula "4to Primaria - A"
  const newStudent = app.createUserAndEnroll(admin, {
    email: 'estudiante.rojas@infotarea.edu',
    password: 'Password123!',
    full_name: 'Mateo Rojas',
    role: 'student',
    section: '4to Primaria - A'
  });

  // THEN: El estudiante queda registrado
  assert.equal(newStudent.email, 'estudiante.rojas@infotarea.edu');
  // AND: El aula se crea y el estudiante queda matriculado
  const course = Array.from(app.courses.values()).find(c => c.section === '4to Primaria - A');
  assert.ok(course !== undefined);
  assert.equal(course.name, 'Aula 4to Primaria - A');
  const enrollment = app.enrollments.find(e => e.studentId === newStudent.id && e.courseId === course.id);
  assert.ok(enrollment !== undefined);
});

test('ACEP-03: HU-03 Docente publica una tarea académica con fecha límite', () => {
  const app = new InfoTareaAcceptanceFlows();
  const teacher = { id: 'teacher-1', role: 'teacher' };
  const courseId = 'course-ciencias-1';
  app.courses.set(courseId, { id: courseId, name: 'Ciencias Naturales 3A', section: '3A' });

  // GIVEN: El docente tiene un curso a cargo
  // WHEN: Publica una tarea con fecha de vencimiento y formato de entrega
  const task = app.createTask(teacher, {
    title: 'Informe de Investigación sobre la Célula',
    description: 'Elaborar un resumen ilustrado en formato PDF sobre organelos celulares.',
    dueDate: '2026-10-20T23:59:00Z',
    courseId: courseId,
    taskType: 'homework'
  });

  // THEN: La tarea se guarda y queda activa para los estudiantes
  assert.equal(task.title, 'Informe de Investigación sobre la Célula');
  assert.equal(task.taskType, 'homework');
  assert.equal(task.teacherId, teacher.id);
  assert.ok(app.tasks.has(task.id));
});

test('ACEP-04: HU-04 Estudiante envía su entrega antes de la fecha límite (on_time)', () => {
  const app = new InfoTareaAcceptanceFlows();
  const student = { id: 'student-1', role: 'student' };
  const courseId = 'course-ciencias-1';
  app.courses.set(courseId, { id: courseId, name: 'Ciencias' });
  app.enrollments.push({ courseId, studentId: student.id });

  // GIVEN: Existe una tarea asignada en el curso del estudiante con vencimiento a las 23:59
  const task = {
    id: 'task-1',
    courseId,
    title: 'Ensayo Histórico',
    dueDate: new Date('2026-10-15T23:59:00Z')
  };
  app.tasks.set(task.id, task);

  // WHEN: El estudiante envía su trabajo a las 20:00 (antes de la hora límite)
  const submission = app.submitTask(student, {
    taskId: task.id,
    content: 'Adjunto el enlace y texto de mi ensayo sobre el Bicentenario.',
    submittedAt: new Date('2026-10-15T20:00:00Z')
  });

  // THEN: La entrega se marca satisfactoriamente como entregada a tiempo
  assert.equal(submission.status, 'submitted_on_time');
  assert.equal(submission.studentId, student.id);
  assert.equal(submission.score, null); // Aún no calificada
});

test('ACEP-05: HU-05 Docente califica la entrega con nota vigesimal y retroalimentación', () => {
  const app = new InfoTareaAcceptanceFlows();
  const teacher = { id: 'teacher-1', role: 'teacher' };
  const subId = 'sub-101';
  app.submissions.set(subId, {
    id: subId,
    taskId: 'task-1',
    studentId: 'student-1',
    content: 'Trabajo final presentado',
    status: 'submitted_on_time',
    score: null,
    feedback: null
  });

  // GIVEN: Existe una entrega pendiente de revisión
  // WHEN: El docente asigna nota de 18 y comentarios pedagógicos
  const graded = app.gradeSubmission(teacher, {
    submissionId: subId,
    score: 18,
    feedback: 'Excelente trabajo argumentativo, felicitaciones por la estructura.'
  });

  // THEN: El estado de la entrega pasa a "graded" y los datos quedan registrados
  assert.equal(graded.status, 'graded');
  assert.equal(graded.score, 18);
  assert.equal(graded.feedback, 'Excelente trabajo argumentativo, felicitaciones por la estructura.');
});

test('ACEP-06: HU-06 Cierre de ciclo escolar: archivado de histórico y reinicio de ciclo operativo', () => {
  const app = new InfoTareaAcceptanceFlows();
  const admin = { id: 'admin-1', role: 'admin' };
  
  // GIVEN: El sistema contiene estudiantes, tareas y entregas acumuladas
  app.users.set('stu-1', { id: 'stu-1', role: 'student' });
  app.users.set('stu-2', { id: 'stu-2', role: 'student' });
  app.tasks.set('t-1', { id: 't-1', title: 'Tarea 1' });
  app.submissions.set('s-1', { id: 's-1', content: 'Entrega 1' });

  // WHEN: El administrador realiza el cierre del año lectivo 2026
  const period = app.closeAcademicYear(admin, {
    yearLabel: 'Periodo Escolar Anual 2026',
    yearNumber: 2026
  });

  // THEN: Se crea el registro histórico con el balance de entidades archivadas
  assert.equal(period.yearNumber, 2026);
  assert.equal(period.totalStudentsArchived, 2);
  assert.equal(period.totalTasksArchived, 1);
  assert.equal(period.totalSubmissionsArchived, 1);

  // AND: Las tablas operacionales quedan vacías para dar inicio al nuevo año escolar
  assert.equal(app.tasks.size, 0);
  assert.equal(app.submissions.size, 0);
});

// ==============================================================
// PRUEBAS DE ACEPTACIÓN - ITERACIÓN Nº 3 (ENTREGA INCREMENTAL)
// ==============================================================

test('ACEP-07: HU-12 Comunicación Docente-Estudiante: chat y flujo principal', () => {
  const app = new InfoTareaAcceptanceFlows();
  const teacher = { id: 'teacher-carlos', role: 'teacher' };
  const student = { id: 'student-mateo', role: 'student' };
  const courseId = 'course-mat-4a';

  // GIVEN: El estudiante tiene dudas sobre la tarea del curso
  // WHEN: El estudiante envía un mensaje en el canal docente-estudiante
  const studentMsg = app.sendChatMessage(student, {
    receiverId: teacher.id,
    courseId,
    content: 'Profesor Carlos, ¿el gráfico debe ser a mano alzada o en computadora?'
  });

  // THEN: El mensaje queda registrado en el hilo de conversación
  assert.equal(studentMsg.senderRole, 'student');
  assert.equal(studentMsg.channelType, 'teacher_student');
  assert.equal(studentMsg.isRead, false);
  assert.equal(app.messages.length, 1);

  // WHEN: El docente responde en el mismo hilo pedagógico
  const teacherReply = app.sendChatMessage(teacher, {
    receiverId: student.id,
    courseId,
    content: 'Hola Mateo, puede ser en computadora o en tu cuaderno con regla.'
  });

  // THEN: La respuesta del docente se asocia al canal correctamente
  assert.equal(teacherReply.senderRole, 'teacher');
  assert.equal(app.messages.length, 2);
});

test('ACEP-08: HU-13 Comunicación Administrador-Docente: avisos y mensajes', () => {
  const app = new InfoTareaAcceptanceFlows();
  const admin = { id: 'admin-dir-1', role: 'admin' };
  const teacher = { id: 'teacher-carlos', role: 'teacher' };

  // GIVEN: La Dirección emite una circular oficial para la plana docente
  // WHEN: Se publica el aviso con prioridad urgente
  const notice = app.publishAdminTeacherNotice(admin, {
    title: 'Circular N° 04: Cierre de Registro de Notas Bimestrales',
    content: 'Se recuerda consolidar las notas en InfoTarea antes del viernes a las 18:00.',
    priority: 'urgente'
  });

  // THEN: El aviso se publica con destino a docentes y prioridad requerida
  assert.equal(notice.targetRole, 'teacher');
  assert.equal(notice.priority, 'urgente');
  assert.equal(app.adminNotices.length, 1);
  assert.ok(notice.title.includes('Circular N° 04'));
});

test('ACEP-09: HU-14 Comunicación Estudiante-Padre: habilitación progresiva del flujo', () => {
  const app = new InfoTareaAcceptanceFlows();
  const student = { id: 'student-mateo', role: 'student' };

  // GIVEN: Estudiante inicia el proceso de vinculación con su apoderado (Fase 1)
  const fase1 = app.updateParentProgressiveFlow(student, {
    parentName: 'Elena Rojas',
    parentEmail: 'elena.rojas@familias.edu',
    targetStage: 1
  });
  assert.equal(fase1.progressiveStage, 1);
  assert.equal(fase1.status, 'pending');
  assert.ok(fase1.inviteCode.startsWith('PADRE-'));

  // WHEN: Se autorizan los permisos de avance académico (Fase 2)
  const fase2 = app.updateParentProgressiveFlow(student, {
    parentName: 'Elena Rojas',
    parentEmail: 'elena.rojas@familias.edu',
    targetStage: 2
  });
  assert.equal(fase2.progressiveStage, 2);
  assert.equal(fase2.status, 'linked');

  // WHEN: Se completa la activación y se habilita el canal de mensajería (Fase 3: 100%)
  const fase3 = app.updateParentProgressiveFlow(student, {
    parentName: 'Elena Rojas',
    parentEmail: 'elena.rojas@familias.edu',
    targetStage: 3
  });
  // THEN: El flujo queda plenamente activo
  assert.equal(fase3.progressiveStage, 3);
  assert.equal(fase3.status, 'active');
  assert.equal(fase3.shareGrades, true);
});
