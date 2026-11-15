import asyncio
import json
import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from mcp import ClientSession
from mcp.client.streamable_http import create_mcp_http_client, streamable_http_client
from openai import OpenAI
import uvicorn

load_dotenv()

app = FastAPI(title="LifePath - Sherpas Hackathon")

llm = OpenAI(
    base_url=f"{os.environ['LLM_PROXY_URL'].rstrip('/')}/v1",
    api_key=os.environ["TEAM_KEY"]
)

# 1. Función para obtener los datos del caso (MCP con respaldo automático local en cases/)
async def fetch_family_data(case_id: str) -> dict:
    try:
        http = create_mcp_http_client(headers={"Authorization": f"Bearer {os.environ['MCP_TOKEN']}"})
        async with streamable_http_client(os.environ["MCP_URL"], http_client=http) as (read, write, *_):
            async with ClientSession(read, write) as mcp:
                await mcp.initialize()
                fh = await mcp.call_tool("get_case", {"caseId": case_id, "part": "financial-health"})
                ia = await mcp.call_tool("get_case", {"caseId": case_id, "part": "investment-analysis"})
                return {
                    "financial_health": json.loads(fh.content[0].text)["value"],
                    "investment_analysis": json.loads(ia.content[0].text)["value"]
                }
    except Exception as e:
        print(f"Usando respaldo local cases/ para {case_id} (motivo MCP: {e})")
        base_path = Path("cases") / case_id
        fh_data = json.loads((base_path / "financial-health.json").read_text(encoding="utf-8"))
        ia_file = base_path / "investment-analysis.json"
        ia_data = json.loads(ia_file.read_text(encoding="utf-8")) if ia_file.exists() else {}
        return {"financial_health": fh_data, "investment_analysis": ia_data}

# 2. Endpoint que transforma el informe financiero en el Archipiélago de Islas 3D
@app.get("/api/case/{case_id}")
async def get_island_map(case_id: str):
    raw_data = await fetch_family_data(case_id)
    
    system_prompt = """
    Eres el motor de LifePath. Transforma los datos financieros de esta familia en un mapa interactivo de 4 islas en español.
    Usa SOLO los datos proporcionados, no inventes cifras. Devuelve exclusivamente un JSON válido con esta estructura exacta:
    {
      "family_name": "Nombre de la familia",
      "score": 26,
      "headline": "Frase resumen muy breve de su situación",
      "islands": [
        {
          "id": "vivienda",
          "title": "Título corto de la isla (ej. Casa 2027)",
          "status": "critical | warning | healthy",
          "bridge_status": "cracked | strained | golden",
          "simple_summary": "Explicación sencilla de 2 frases sin jerga financiera",
          "expert_metrics": "Cifras exactas y porcentajes clave del informe",
          "first_step": "Acción concreta inmediata recomendada por Sherpas",
          "suggested_questions": ["Pregunta 1", "Pregunta 2"]
        }
      ]
    }
    Genera exactamente 4 islas con los ids: "vivienda", "jubilacion", "ahorros", "proteccion".
    """

    response = llm.chat.completions.create(
        model="gpt-5-mini",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(raw_data)[:28000]}
        ]
    )
    return json.loads(response.choices[0].message.content)

# 3. Endpoint de Preguntas y Respuestas contextual por cada isla
class AskRequest(BaseModel):
    case_id: str
    island_title: str
    question: str

@app.post("/api/ask")
async def ask_island_question(req: AskRequest):
    raw_data = await fetch_family_data(req.case_id)
    
    response = llm.chat.completions.create(
        model="gpt-5-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    f"Eres el asesor financiero personal de esta familia en la app LifePath. "
                    f"El usuario está explorando la isla '{req.island_title}'. "
                    f"Responde en español claro, empático y directo (máximo 3 frases) usando SOLO estos datos:\n\n"
                    f"{json.dumps(raw_data)[:28000]}"
                )
            },
            {"role": "user", "content": req.question}
        ]
    )
    return {"answer": response.choices[0].message.content}

# 4. Servir la aplicación web móvil
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def serve_frontend():
    return FileResponse("static/index.html")

if __name__ == "__main__":
    print("LifePath funcionando en: http://127.0.0.1:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000)