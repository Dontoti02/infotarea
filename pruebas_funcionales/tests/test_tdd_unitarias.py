"""
Pruebas Unitarias bajo Metodología TDD (Test-Driven Development)
Proyecto: InfoTarea - Primera Entrega
"""
import pytest
import re
from datetime import datetime, timezone, timedelta

# ==========================================
# LÓGICA DE NEGOCIO IMPLEMENTADA (FASE VERDE)
# ==========================================

def validar_registro_usuario(email, password, full_name, role, section=None):
    errores = []
    if not email or not email.strip():
        errores.append("El correo electrónico es obligatorio.")
    elif not re.match(r"^[^@]+@[^@]+\.[^@]+$", email):
        errores.append("El formato del correo electrónico es inválido.")
    
    if not password or len(password) < 6:
        errores.append("La contraseña debe tener al menos 6 caracteres.")
    
    if not full_name or not full_name.strip():
        errores.append("El nombre completo es obligatorio.")
    
    if role not in ["admin", "teacher", "student"]:
        errores.append("El rol seleccionado no es válido.")
        
    if role == "student" and (not section or not section.strip()):
        errores.append("Los estudiantes deben tener una sección o aula asignada.")
        
    return {"valido": len(errores) == 0, "errores": errores}

def validar_creacion_tarea(titulo, curso_id, fecha_vencimiento, tipo_tarea, duracion_minutos=None):
    errores = []
    if not titulo or len(titulo.strip()) < 3:
        errores.append("El título de la tarea debe tener al menos 3 caracteres.")
    if not curso_id or not curso_id.strip():
        errores.append("Debe asignarse un curso a la tarea.")
    if not fecha_vencimiento:
        errores.append("La fecha de vencimiento es obligatoria.")
    if tipo_tarea not in ["homework", "forum", "exam"]:
        errores.append("El tipo de tarea no es válido.")
    if tipo_tarea == "exam" and (duracion_minutos is None or duracion_minutos <= 0):
        errores.append("Los exámenes deben contar con un tiempo límite en minutos.")
    return {"valido": len(errores) == 0, "errores": errores}

def evaluar_estado_entrega(fecha_envio_iso, fecha_limite_iso):
    formato = "%Y-%m-%dT%H:%M:%SZ"
    f_envio = datetime.strptime(fecha_envio_iso, formato)
    f_limite = datetime.strptime(fecha_limite_iso, formato)
    return "on_time" if f_envio <= f_limite else "late"

def evaluar_calificacion(nota, nota_maxima=20):
    errores = []
    if not isinstance(nota, (int, float)):
        return {"valido": False, "errores": ["La calificación debe ser numérica."]}
    if nota < 0 or nota > nota_maxima:
        return {"valido": False, "errores": [f"La nota debe estar entre 0 y {nota_maxima}."]}
    
    porcentaje = (nota / nota_maxima) * 100
    if porcentaje >= 90:
        escala = "AD" # Logro Destacado
    elif porcentaje >= 70:
        escala = "A"  # Logro Esperado
    elif porcentaje >= 55:
        escala = "B"  # En Proceso
    else:
        escala = "C"  # En Inicio
        
    return {"valido": True, "errores": [], "escala": escala}

def calcular_periodo_lectivo(anio_numero, etiqueta):
    if not isinstance(anio_numero, int) or anio_numero < 2000 or anio_numero > 2100:
        raise ValueError("El año escolar debe ser un año válido de 4 dígitos.")
    if not etiqueta or not etiqueta.strip():
        raise ValueError("La etiqueta del periodo es obligatoria.")
    return {
        "year_label": etiqueta.strip(),
        "start_year": anio_numero,
        "end_year": anio_numero + 1
    }

# ==========================================
# CASOS DE PRUEBA UNITARIOS TDD
# ==========================================

def test_tdd_registro_docente_valido():
    res = validar_registro_usuario("profesor@infotarea.edu", "ClaveSegura123!", "Profesor Ruiz", "teacher")
    assert res["valido"] is True
    assert len(res["errores"]) == 0

def test_tdd_estudiante_requiere_seccion():
    res = validar_registro_usuario("alumno@infotarea.edu", "ClaveSegura123!", "Pedro Garcia", "student")
    assert res["valido"] is False
    assert "Los estudiantes deben tener una sección o aula asignada." in res["errores"]

def test_tdd_password_minimo_seis_caracteres():
    res = validar_registro_usuario("usuario@infotarea.edu", "123", "Usuario Test", "teacher")
    assert res["valido"] is False
    assert "La contraseña debe tener al menos 6 caracteres." in res["errores"]

def test_tdd_email_formato_invalido():
    res = validar_registro_usuario("email_sin_arroba", "ClaveSegura123!", "Usuario Test", "teacher")
    assert res["valido"] is False
    assert "El formato del correo electrónico es inválido." in res["errores"]

def test_tdd_examen_requiere_duracion():
    res_invalido = validar_creacion_tarea("Examen Final", "c-101", "2026-11-20T10:00:00Z", "exam")
    assert res_invalido["valido"] is False
    assert "Los exámenes deben contar con un tiempo límite en minutos." in res_invalido["errores"]

    res_valido = validar_creacion_tarea("Examen Final", "c-101", "2026-11-20T10:00:00Z", "exam", 60)
    assert res_valido["valido"] is True

def test_tdd_evaluacion_entrega_a_tiempo_y_tardia():
    limite = "2026-10-15T23:59:00Z"
    assert evaluar_estado_entrega("2026-10-15T18:00:00Z", limite) == "on_time"
    assert evaluar_estado_entrega("2026-10-16T01:00:00Z", limite) == "late"

def test_tdd_escala_calificacion_vigesimal():
    assert evaluar_calificacion(19)["escala"] == "AD"
    assert evaluar_calificacion(15)["escala"] == "A"
    assert evaluar_calificacion(12)["escala"] == "B"
    assert evaluar_calificacion(8)["escala"] == "C"
    assert evaluar_calificacion(22)["valido"] is False
    assert evaluar_calificacion(-1)["valido"] is False

def test_tdd_periodo_lectivo_calculo_anio_siguiente():
    p = calcular_periodo_lectivo(2026, "Año Académico 2026")
    assert p["start_year"] == 2026
    assert p["end_year"] == 2027
    with pytest.raises(ValueError):
        calcular_periodo_lectivo(1995, "Año Invalido")
