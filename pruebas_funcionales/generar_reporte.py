import json
import os
import pygal
from pygal.style import DefaultStyle

def generar_graficos(json_report_path, output_dir):
    if not os.path.exists(json_report_path):
        print(f"Error: No se encontró el reporte JSON en {json_report_path}")
        return

    with open(json_report_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Extraer el resumen
    summary = data.get('summary', {})
    
    # Contar resultados
    passed = summary.get('passed', 0)
    failed = summary.get('failed', 0)
    skipped = summary.get('skipped', 0)

    if passed == 0 and failed == 0 and skipped == 0:
        print("No hay datos de pruebas para generar gráficos.")
        return

    os.makedirs(output_dir, exist_ok=True)

    # Gráfico de torta (Pie Chart)
    pie_chart = pygal.Pie(inner_radius=.4, style=DefaultStyle)
    pie_chart.title = 'Resultados de Pruebas Funcionales'
    
    if passed > 0:
        pie_chart.add(f'Pasados ({passed})', passed)
    if failed > 0:
        pie_chart.add(f'Fallidos ({failed})', failed)
    if skipped > 0:
        pie_chart.add(f'Saltados ({skipped})', skipped)

    pie_path = os.path.join(output_dir, 'grafico_torta.svg')
    pie_chart.render_to_file(pie_path)
    print(f"Gráfico de torta guardado en: {pie_path}")

    # Gráfico de barras (Bar Chart)
    bar_chart = pygal.Bar(style=DefaultStyle)
    bar_chart.title = 'Detalle de Pruebas Funcionales'
    
    if passed > 0:
        bar_chart.add('Pasados', passed)
    if failed > 0:
        bar_chart.add('Fallidos', failed)
    if skipped > 0:
        bar_chart.add('Saltados', skipped)

    bar_path = os.path.join(output_dir, 'grafico_barras.svg')
    bar_chart.render_to_file(bar_path)
    print(f"Gráfico de barras guardado en: {bar_path}")

if __name__ == '__main__':
    reporte_json = os.path.join(os.path.dirname(__file__), '.report.json')
    carpeta_salida = os.path.join(os.path.dirname(__file__), 'reports')
    generar_graficos(reporte_json, carpeta_salida)
