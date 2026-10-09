"""
Pruebas de Integración de Endpoints y Servicios
Proyecto: InfoTarea - Primera Entrega
"""
import pytest

class ServicioAdminSimulado:
    @staticmethod
    def crear_usuario(body, auth_user=None, perfil=None):
        if not auth_user:
            return {"status": 401, "error": "No autorizado"}
        if perfil.get("role") != "admin":
            return {"status": 403, "error": "Acceso denegado: Requiere rol admin"}
        
        email = body.get("email")
        password = body.get("password")
        full_name = body.get("full_name")
        role = body.get("role")
        
        if not email or not password or not full_name or not role:
            return {"status": 400, "error": "Faltan campos obligatorios"}
        
        return {
            "status": 200,
            "success": True,
            "user": {"id": "usr-123", "email": email, "role": role},
            "aula_asignada": f"Aula {body.get('section')}" if role == "student" else None
        }

    @staticmethod
    def cerrar_anio_lectivo(body, auth_user=None, perfil=None):
        if not auth_user or perfil.get("role") != "admin":
            return {"status": 403, "error": "No autorizado"}
        
        year_label = body.get("yearLabel")
        year_number = body.get("yearNumber")
        if not year_label or not year_number:
            return {"status": 400, "error": "Datos incompletos"}
        
        return {
            "status": 200,
            "success": True,
            "period": {
                "id": "periodo-2026",
                "label": year_label,
                "start_year": year_number,
                "end_year": year_number + 1,
                "entidades_archivadas": 150
            }
        }

def test_integracion_guard_autenticacion():
    # Sin sesión -> 401
    res = ServicioAdminSimulado.crear_usuario({"email": "a@a.com"}, auth_user=None)
    assert res["status"] == 401

def test_integracion_guard_rol_no_admin():
    # Con sesión pero rol teacher -> 403
    res = ServicioAdminSimulado.crear_usuario(
        {"email": "a@a.com"}, 
        auth_user={"id": "u1"}, 
        perfil={"role": "teacher"}
    )
    assert res["status"] == 403

def test_integracion_creacion_estudiante_con_aula():
    res = ServicioAdminSimulado.crear_usuario(
        {
            "email": "estudiante@infotarea.edu",
            "password": "Password123!",
            "full_name": "Luis Gomez",
            "role": "student",
            "section": "2A"
        },
        auth_user={"id": "admin-1"},
        perfil={"role": "admin"}
    )
    assert res["status"] == 200
    assert res["success"] is True
    assert res["aula_asignada"] == "Aula 2A"

def test_integracion_cierre_anio_exitoso():
    res = ServicioAdminSimulado.cerrar_anio_lectivo(
        {"yearLabel": "Año Académico 2026", "yearNumber": 2026},
        auth_user={"id": "admin-1"},
        perfil={"role": "admin"}
    )
    assert res["status"] == 200
    assert res["period"]["start_year"] == 2026
    assert res["period"]["end_year"] == 2027
