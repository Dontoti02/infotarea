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

def test_validacion_login_vacio(driver):
    """Verifica que no se puede iniciar sesión con campos vacíos."""
    driver.get("http://localhost:3000/login")
    
    wait = WebDriverWait(driver, 5)
    submit_button = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[type='submit']")))
    submit_button.click()
    
    # La URL no debería cambiar si hay validación
    time.sleep(1)
    assert "/login" in driver.current_url

def test_login_credenciales_invalidas(driver):
    """Verifica el comportamiento con credenciales inválidas."""
    driver.get("http://localhost:3000/login")
    
    wait = WebDriverWait(driver, 5)
    email_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='email']")))
    password_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='password']")))
    submit_button = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[type='submit']")))
    
    email_input.send_keys("usuario_inexistente@ejemplo.com")
    password_input.send_keys("contraseña12345")
    submit_button.click()
    
    # Esperar un poco a que procese Supabase/Next
    time.sleep(2)
    
    # Verificar que seguimos en la página de login
    assert "/login" in driver.current_url
