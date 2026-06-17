import pytest
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

@pytest.fixture
def driver():
    options = webdriver.ChromeOptions()
    options.add_argument('--headless')
    driver = webdriver.Chrome(options=options)
    yield driver
    driver.quit()

def test_acceso_registro(driver):
    """Prueba 1: Verificar que la página de Registro carga correctamente."""
    driver.get("http://localhost:3000/register")
    # Verificamos que contenga elementos típicos de un registro (nombre, email, etc.)
    wait = WebDriverWait(driver, 5)
    name_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='text']")))
    assert name_input is not None

def test_acceso_recuperar_password(driver):
    """Prueba 2: Verificar que la página de Recuperación de contraseña existe."""
    driver.get("http://localhost:3000/forgot-password")
    wait = WebDriverWait(driver, 5)
    email_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='email']")))
    assert email_input is not None

def test_proteccion_rutas_privadas(driver):
    """Prueba 3: Verificar que acceder al Dashboard sin login redirige."""
    driver.get("http://localhost:3000/student/dashboard")
    # Debería redirigir al login
    time.sleep(2)
    assert "/login" in driver.current_url or "/student/dashboard" not in driver.current_url

def test_pagina_no_encontrada_404(driver):
    """Prueba 4: Verificar el manejo de rutas inexistentes (Error 404)."""
    driver.get("http://localhost:3000/ruta-inexistente-12345")
    # En Next.js, por lo general el título de la pestaña muestra '404'
    assert "404" in driver.title or "Not Found" in driver.page_source or "no encontrada" in driver.page_source.lower()
