"""
Pruebas de Aceptación y BDD
Proyecto: InfoTarea - Primera Entrega
Criterios de Aceptación: Given - When - Then (Gherkin)
"""
import pytest

class GestorAceptacionInfoTarea:
    def __init__(self):
        self.tareas = {}
        self.entregas = {}
        self.calificaciones = {}

    def publicar_tarea(self, docente_id, curso_id, titulo, limite):
        tarea_id = f"t-{len(self.tareas)+1}"
        self.tareas[tarea_id] = {
            "id": tarea_id,
            "docente_id": docente_id,
            "curso_id": curso_id,
            "titulo": titulo,
            "limite": limite,
            "publicada": True
        }
        return self.tareas[tarea_id]

    def enviar_tarea(self, estudiante_id, tarea_id, contenido):
        if tarea_id not in self.tareas:
            raise ValueError("Tarea no existe")
        entrega_id = f"sub-{len(self.entregas)+1}"
        self.entregas[entrega_id] = {
            "id": entrega_id,
            "estudiante_id": estudiante_id,
            "tarea_id": tarea_id,
            "contenido": contenido,
            "estado": "entregada"
        }
        return self.entregas[entrega_id]

    def calificar_entrega(self, entrega_id, nota, feedback):
        if entrega_id not in self.entregas:
            raise ValueError("Entrega no existe")
        self.entregas[entrega_id]["estado"] = "calificada"
        self.calificaciones[entrega_id] = {
            "nota": nota,
            "feedback": feedback
        }
        return self.entregas[entrega_id]

def test_aceptacion_hu03_publicacion_tarea():
    # GIVEN: Un docente con acceso al aula "Ciencias 1A"
    app = GestorAceptacionInfoTarea()
    # WHEN: Publica una tarea con fecha límite
    tarea = app.publicar_tarea("docente-1", "aula-1a", "Maqueta del Sistema Solar", "2026-10-30")
    # THEN: La tarea queda publicada y accesible
    assert tarea["publicada"] is True
    assert tarea["titulo"] == "Maqueta del Sistema Solar"

def test_aceptacion_hu04_envio_tarea_estudiante():
    # GIVEN: Una tarea activa en el sistema
    app = GestorAceptacionInfoTarea()
    tarea = app.publicar_tarea("docente-1", "aula-1a", "Ensayo Literario", "2026-10-30")
    # WHEN: El estudiante envía su entrega
    entrega = app.enviar_tarea("estudiante-1", tarea["id"], "Texto del ensayo y enlace de archivo.")
    # THEN: El estado de la entrega es "entregada"
    assert entrega["estado"] == "entregada"
    assert entrega["estudiante_id"] == "estudiante-1"

def test_aceptacion_hu05_revision_y_calificacion_docente():
    # GIVEN: Una entrega realizada por un estudiante
    app = GestorAceptacionInfoTarea()
    tarea = app.publicar_tarea("docente-1", "aula-1a", "Matemática Aplicada", "2026-10-30")
    entrega = app.enviar_tarea("estudiante-1", tarea["id"], "Desarrollo de ejercicios 1 al 10")
    # WHEN: El docente califica con nota 19 y retroalimentación
    calificada = app.calificar_entrega(entrega["id"], 19, "Excelente resolución y orden paso a paso.")
    # THEN: El estado pasa a "calificada" y los datos quedan grabados
    assert calificada["estado"] == "calificada"
    assert app.calificaciones[entrega["id"]]["nota"] == 19
    assert "Excelente" in app.calificaciones[entrega["id"]]["feedback"]
