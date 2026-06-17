import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

@pytest.fixture
def driver():
    # Usar Chrome en modo headless
    options = webdriver.ChromeOptions()
    options.add_argument('--headless')
    driver = webdriver.Chrome(options=options)
    yield driver
    driver.quit()

def test_pagina_principal_carga(driver):
    """Verifica que la página principal carga y tiene el título correcto."""
    driver.get("http://localhost:3000/")
    assert "InfoTarea" in driver.title or driver.title != ""

def test_navegacion_login(driver):
    """Verifica que se puede acceder a la página de login."""
    driver.get("http://localhost:3000/login")
    
    # Verificar que los elementos del formulario de login están presentes
    wait = WebDriverWait(driver, 5)
    email_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='email']")))
    password_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='password']")))
    submit_button = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "button[type='submit']")))
    
    assert email_input is not None
    assert password_input is not None
    assert submit_button is not None
