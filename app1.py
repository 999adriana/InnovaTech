import os
import json
from dotenv import load_dotenv
from openai import OpenAI

# 1. Cargar las variables del archivo .env
load_dotenv()

# 2. Configurar el cliente de IA usando el proxy del hackathon
llm = OpenAI(
    base_url=f"{os.environ['LLM_PROXY_URL']}/v1",
    api_key=os.environ["TEAM_KEY"]
)

# 3. Leer un caso de prueba (usando la carpeta local 'cases/' por seguridad y rapidez)
# (Busca dentro de cases/ el archivo JSON de una de las familias, por ejemplo Michael Carter)
case_path = "cases/michael-carter/financial-health.json" # Ajusta la ruta según la estructura real de tu carpeta cases/

try:
    with open(case_path, "r", encoding="utf-8") as f:
        case_data = json.load(f)
    print("¡Caso cargado con éxito desde la carpeta local!")
except Exception as e:
    print(f"No se pudo cargar el archivo local, error: {e}")
    case_data = {"error": "No se encontró el archivo"}

# 4. Enviar los datos al modelo de IA para que responda una pregunta
response = llm.chat.completions.create(
    model="gpt-5-mini",
    messages=[
        {
            "role": "system", 
            "content": "Eres un asesor financiero experto. Analiza los datos del siguiente caso y responde de forma clara y concisa.\n\n" + json.dumps(case_data)
        },
        {
            "role": "user", 
            "content": "¿Cuál es la situación financiera principal de este caso y qué recomendación le darías?"
        }
    ]
)

print("\n--- RESPUESTA DE LA IA ---")
print(response.choices[0].message.content)