import json
import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, Query
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

# Caché en memoria para respuestas instantáneas en la demo (0 ms tras la primera carga)
RAW_DATA_CACHE: dict[str, dict] = {}
ISLAND_MAP_CACHE: dict[str, dict] = {}


async def fetch_family_data(case_id: str) -> dict:
    """Extrae financial-health, investment-analysis y persona.md (MCP con respaldo local)."""
    if case_id in RAW_DATA_CACHE:
        return RAW_DATA_CACHE[case_id]

    data = {"financial_health": {}, "investment_analysis": {}, "persona": ""}

    # 1. Intento vía servidor MCP
    try:
        http = create_mcp_http_client(headers={"Authorization": f"Bearer {os.environ['MCP_TOKEN']}"})
        async with streamable_http_client(os.environ["MCP_URL"], http_client=http) as (read, write, *_):
            async with ClientSession(read, write) as mcp:
                await mcp.initialize()
                fh = await mcp.call_tool("get_case", {"caseId": case_id, "part": "financial-health"})
                ia = await mcp.call_tool("get_case", {"caseId": case_id, "part": "investment-analysis"})
                data["financial_health"] = json.loads(fh.content[0].text)["value"]
                data["investment_analysis"] = json.loads(ia.content[0].text)["value"]
                try:
                    ps = await mcp.call_tool("get_case", {"caseId": case_id, "part": "persona"})
                    val = json.loads(ps.content[0].text)["value"]
                    data["persona"] = val if isinstance(val, str) else json.dumps(val, ensure_ascii=False)
                except Exception:
                    pass
    except Exception as e:
        print(f"[INFO] Usando respaldo local cases/ para {case_id} (MCP: {e})")
        base_path = Path("cases") / case_id
        fh_file = base_path / "financial-health.json"
        ia_file = base_path / "investment-analysis.json"
        if fh_file.exists():
            data["financial_health"] = json.loads(fh_file.read_text(encoding="utf-8"))
        if ia_file.exists():
            data["investment_analysis"] = json.loads(ia_file.read_text(encoding="utf-8"))

    # 2. Garantizar lectura de persona.md desde disco si MCP no lo devolvió
    if not data["persona"]:
        persona_file = Path("cases") / case_id / "persona.md"
        if persona_file.exists():
            data["persona"] = persona_file.read_text(encoding="utf-8")

    RAW_DATA_CACHE[case_id] = data
    return data


def family_identity(case_id: str, financial_health: dict) -> dict[str, str]:
    household = financial_health.get("case", {}).get("household", [])
    adult_names = [
        person["first_name"]
        for person in household
        if person.get("role") != "child" and person.get("first_name")
    ]
    return {
        "family_name": " & ".join(adult_names) or case_id,
        "family_label": case_id.rsplit("-", 1)[-1].title(),
    }


@app.get("/api/case/{case_id}")
async def get_island_map(case_id: str, refresh: bool = Query(default=False)):
    """Genera y cachea el mapa enriquecido de LifePath con psicología, simulador y perspectivas."""
    if not refresh and case_id in ISLAND_MAP_CACHE:
        return ISLAND_MAP_CACHE[case_id]

    raw_data = await fetch_family_data(case_id)

    system_prompt = """
    Eres el motor inteligente de LifePath (Sherpas Wealth). Transforma los datos financieros y el perfil psicologico (persona.md) de esta familia en un mapa interactivo de 4 islas en español.
    Usa EXCLUSIVAMENTE los datos y cifras reales proporcionados. No inventes numeros.
    ORDENA las 4 islas de MAYOR a MENOR urgencia real para esta familia segun sus tensiones en persona.md.

    Devuelve exclusivamente un JSON valido con esta estructura exacta:
    {
      "family_name": "Nombre de la familia",
      "score": 26,
      "headline": "Frase empatica y directa (max 12 palabras) sobre su reto principal",
      "welcome_intents": [
        {"label": "Opcion rapida 1 (ej. Comprar casa sin ahogarme)", "target_island_index": 0},
        {"label": "Opcion rapida 2 (ej. Asegurar mi jubilacion)", "target_island_index": 1},
        {"label": "Opcion rapida 3 (ej. No se por donde empezar)", "target_island_index": 0}
      ],
      "couple_perspectives": [
        {
          "member_name": "Nombre miembro 1 (o nombre unico si es soltero/a)",
          "focus_tag": "Su prioridad emocional (ej. Crecimiento y metas)",
          "custom_advice": "Consejo adaptado a su perfil psicologico D4-D6 en persona.md"
        }
      ],
      "simulator": {
        "target_island_index": 0,
        "action_label": "Accion concreta del deslizador (ej. Ahorro mensual extra o meses de ajuste)",
        "unit": "$/mes",
        "min_val": 0,
        "max_val": 1000,
        "step_val": 100,
        "recommended_val": 600,
        "score_boost": 24,
        "impact_explanation": "Como esta accion sana el puente entre su meta inmediata y su futuro"
      },
      "day3_widget": {
        "title": "Recordatorio inteligente Dia 3",
        "message": "Mensaje amigable y concreto de seguimiento conectado a sus cifras reales"
      },
      "islands": [
        {
          "id": "isla_1",
          "icon_type": "vivienda | jubilacion | ahorros | proteccion",
          "title": "Titulo corto (max 18 caracteres)",
          "status": "critical | warning | healthy",
          "bridge_status": "cracked | strained | golden",
          "simple_summary": "Explicacion sencilla de 2 frases sin jerga financiera conectada a lo que les preocupa",
          "expert_metrics": "Cifras exactas, porcentajes y fechas clave del informe",
          "first_step": "Primer paso accionable inmediato recomendado por Sherpas",
          "suggested_questions": ["Pregunta contextual 1", "Pregunta contextual 2"]
        }
      ]
    }
    Asegurate de que "islands" tenga exactamente 4 elementos ordenados por prioridad real. Si son pareja, incluye 2 objetos en "couple_perspectives"; si es una persona individual, incluye 1.
    """

    user_payload = json.dumps(raw_data, ensure_ascii=False)[:32000]

    response = llm.chat.completions.create(
        model="gpt-5-mini",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_payload}
        ]
    )

    result = json.loads(response.choices[0].message.content)
    financial_health = raw_data["financial_health"]
    financial_score = financial_health["score"]
    narrative = financial_health.get("narrative", {})

    result.update({
        **family_identity(case_id, financial_health),
        "score": financial_score["published_score"],
        "score_band": financial_score["band"],
        "score_message": financial_score.get("message", ""),
        "pillars": financial_score["pillars"],
        "protection_details": {
            "emergency": narrative.get("protection_emergency_fund_short_observations", ""),
            "life": narrative.get("protection_life_insurance_short_observations", ""),
            "umbrella": narrative.get("protection_umbrella_short_observations", ""),
        },
        "top_moves": financial_score.get("top_moves", []),
    })
    ISLAND_MAP_CACHE[case_id] = result
    return result


@app.get("/api/cases")
def list_cases():
    """Returns the available case IDs and display names for the family selector."""
    cases_dir = Path("cases")
    available_cases = []
    for case_path in sorted(cases_dir.iterdir()):
        financial_health_path = case_path / "financial-health.json"
        if not case_path.is_dir() or not financial_health_path.is_file():
            continue

        financial_health = json.loads(financial_health_path.read_text(encoding="utf-8"))
        available_cases.append({
            "id": case_path.name,
            **family_identity(case_path.name, financial_health),
        })
    return available_cases


class AskRequest(BaseModel):
    case_id: str
    island_title: str
    question: str
    member_perspective: str | None = None


@app.post("/api/ask")
async def ask_island_question(req: AskRequest):
    """Responde preguntas contextuales usando los datos financieros y psicologicos de la familia."""
    raw_data = await fetch_family_data(req.case_id)
    perspective_note = (
        f"Hablas especificamente con {req.member_perspective}; adapta el tono a su perfil en persona.md. "
        if req.member_perspective else ""
    )

    response = llm.chat.completions.create(
        model="gpt-5-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    f"Eres el asesor financiero personal de esta familia en LifePath (Sherpas). "
                    f"El usuario esta explorando la isla '{req.island_title}'. {perspective_note}"
                    f"Responde en espanol claro, calido y directo (maximo 3 frases) usando SOLO estos datos:\n\n"
                    f"{json.dumps(raw_data, ensure_ascii=False)[:32000]}"
                )
            },
            {"role": "user", "content": req.question}
        ]
    )
    return {"answer": response.choices[0].message.content}


@app.post("/api/prewarm")
async def prewarm_all_cases():
    """Precarga las 4 familias en cache antes de salir al escenario."""
    cases = [
        "michael-carter",
        "timothy-melanie-weah",
        "daniel-emily-johnson",
        "samantha-lewis"
    ]
    loaded = []
    for cid in cases:
        await get_island_map(cid)
        loaded.append(cid)
    return {"status": "ok", "cached_cases": loaded}


os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def serve_frontend():
    return FileResponse("static/islands.html")


if __name__ == "__main__":
    print("LifePath Backend v2 funcionando en: http://127.0.0.1:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000)
