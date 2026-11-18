import asyncio
import json
import os
from math import isfinite
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from mcp import ClientSession
from mcp.client.streamable_http import create_mcp_http_client, streamable_http_client
from openai import OpenAI, OpenAIError, Timeout
import uvicorn

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

app = FastAPI(title="LifePath - Sherpas Hackathon")

llm_proxy_url = os.getenv("LLM_PROXY_URL")
team_key = os.getenv("TEAM_KEY")
missing_llm_settings = [
    name for name, value in (("LLM_PROXY_URL", llm_proxy_url), ("TEAM_KEY", team_key))
    if not value
]
if missing_llm_settings:
    raise RuntimeError(
        f"Falta configurar {', '.join(missing_llm_settings)} en el entorno o en el archivo .env."
    )

llm = OpenAI(
    base_url=f"{llm_proxy_url.rstrip('/')}/v1",
    api_key=team_key,
    timeout=45.0,
    max_retries=0,
)

# Caché en memoria para respuestas instantáneas en la demo (0 ms tras la primera carga)
RAW_DATA_CACHE: dict[str, dict] = {}
ISLAND_MAP_CACHE: dict[str, dict] = {}


async def request_llm(**kwargs):
    try:
        return await asyncio.to_thread(llm.chat.completions.create, **kwargs)
    except OpenAIError as error:
        print(f"[ERROR] Falló el servicio de IA ({type(error).__name__}).")
        raise HTTPException(
            status_code=502,
            detail="El servicio de IA no está disponible. Revisa TEAM_KEY, LLM_PROXY_URL y la conexión.",
        ) from error


async def fetch_family_data(case_id: str) -> dict:
    """Extrae financial-health, investment-analysis y persona.md (MCP con respaldo local)."""
    if case_id in RAW_DATA_CACHE:
        return RAW_DATA_CACHE[case_id]

    data = {"financial_health": {}, "investment_analysis": {}, "persona": ""}

    # 1. Intento vía servidor MCP
    try:
        http = create_mcp_http_client(
            headers={"Authorization": f"Bearer {os.environ['MCP_TOKEN']}"},
            timeout=Timeout(10.0),
        )
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
        base_path = BASE_DIR / "cases" / case_id
        fh_file = base_path / "financial-health.json"
        ia_file = base_path / "investment-analysis.json"
        if fh_file.exists():
            data["financial_health"] = json.loads(fh_file.read_text(encoding="utf-8"))
        if ia_file.exists():
            data["investment_analysis"] = json.loads(ia_file.read_text(encoding="utf-8"))

    # 2. Garantizar lectura de persona.md desde disco si MCP no lo devolvió
    if not data["persona"]:
        persona_file = BASE_DIR / "cases" / case_id / "persona.md"
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


def investment_data_for_ui(investment_analysis: dict) -> dict:
    """Expose the investment figures needed by the interactive island."""
    metrics = investment_analysis.get("key_metrics", {})
    cash = metrics.get("facts", {}).get("cash", {}).get("accessibleCash", {})
    target_analysis = metrics.get("targetAnalysis", {})
    portfolio_analysis = metrics.get("portfolioAnalysis", {})
    concentration = metrics.get("concentrationAndDiversification", {}).get("totals", {})
    positions = investment_analysis.get("positions", [])
    invested_total = concentration.get("investablePortfolioValue")
    if invested_total is None:
        invested_total = sum(float(position.get("value") or 0) for position in positions)

    return {
        "positions": positions,
        "invested_total": invested_total,
        "accessible_cash": cash,
        "target_performance": target_analysis.get("performance", {}),
        "portfolio_performance": portfolio_analysis.get("performance", {}),
        "target_allocation_efc": target_analysis.get("assetAllocations", {}).get("assetAllocationsEFC", []),
    }


def _case_number(value, field: str) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"El dato financiero {field} no es numérico.") from error
    if not isfinite(number):
        raise ValueError(f"El dato financiero {field} no es finito.")
    return number


def savings_data_for_ui(financial_health: dict) -> dict:
    cashflow = financial_health["key_metrics"]["cashflowStatement"]
    income = _case_number(cashflow["inflows"]["total"], "ingresos anuales")
    liquidity = financial_health["key_metrics"]["savingsAndExpenses"]["liquidityContext"]
    cash_balance = _case_number(liquidity["emergencyFundInCash"], "efectivo accesible")
    styles = {
        "Taxes": ("taxes", "Impuestos", "Impuestos y retenciones del hogar.", "receipt", "#b98562"),
        "Expenses": ("expenses", "Gastos esenciales", "Gastos cotidianos recogidos en el informe.", "bag", "#8fa88d"),
        "Housing Expenses": ("housing", "Vivienda", "Hipoteca, impuestos y gastos de vivienda.", "home", "#d9b36c"),
        "Debt Payments": ("debt", "Deudas", "Pagos de deuda registrados en el informe.", "wallet", "#c4a4b0"),
        "Savings": ("saving", "Ahorro e inversión", "Aportaciones de ahorro registradas actualmente.", "plant", "#9da97a"),
    }
    categories = []
    for index, item in enumerate(cashflow["outflows"]["items"]):
        source_name = item["name"]
        category_id, name, detail, icon, color = styles.get(
            source_name,
            (f"category-{index}", source_name, "Importe mensual del informe.", "spark", "#9da97a"),
        )
        annual_amount = _case_number(item["total"], f"salida anual: {source_name}")
        categories.append({
            "id": category_id,
            "name": name,
            "detail": detail,
            "hint": f"Importe mensual registrado: ${annual_amount / 12:,.0f} al mes.",
            "icon": icon,
            "color": color,
            "amount": annual_amount / 12,
        })
    return {
        "currency": "USD",
        "income": income / 12,
        "cash_balance": cash_balance,
        "categories": categories,
    }


def protection_rings_for_ui(financial_health: dict) -> dict:
    protection = financial_health["key_metrics"]["protection"]

    def ring(current, recommended, meter_label, current_note, recommended_note):
        current_amount = _case_number(current, f"{meter_label}: cobertura actual")
        recommended_amount = _case_number(recommended, f"{meter_label}: objetivo recomendado")
        ratio = current_amount / recommended_amount if recommended_amount > 0 else 0
        status = "healthy" if ratio >= 1 else "warning" if ratio >= 0.5 else "critical"
        return {
            "current": current_amount,
            "recommended": recommended_amount,
            "coverage_ratio": ratio,
            "meter_label": meter_label,
            "current_note": current_note,
            "recommended_note": recommended_note,
            "status": status,
        }

    emergency = protection["emergencyFund"]
    emergency_current = emergency["cashAndExpensesOverview"]["cashReserves"]
    emergency_target = emergency["recommendedEmergencyFundLevels"]
    emergency_months = emergency_target["minimumMonthsRecommended"]

    life = protection["lifeInsurance"]
    life_basics = life["lifeInsuranceCoverageBasics"]
    life_recommendations = life["lifeInsuranceCoverageRecommendations"]
    life_current = sum(
        _case_number(life_basics.get(key, 0), f"seguro de vida: {key}")
        for key in ("lifeInsuranceAmountClient", "lifeInsuranceAmountCoClient")
    )
    life_recommended = sum(
        _case_number(life_recommendations.get(key, 0), f"seguro de vida: {key}")
        for key in ("clientMinRecommendedCoverage", "coClientMinRecommendedCoverage")
    )

    umbrella = protection["umbrellaInsurance"]
    umbrella_details = umbrella["umbrellaCoverage"]
    umbrella_current = (
        _case_number(umbrella_details["umbrellaCoverageAmount"], "responsabilidad civil")
        if umbrella_details["hasUmbrellaPolicy"] else 0
    )
    umbrella_recommended = umbrella["coverageRecommendationsAndAnalysis"]["umbrellaMinRecommendedCoverage"]

    return {
        "emergency": ring(
            emergency_current,
            emergency_target["minimumAmountAdjustedAfterShortTermCashNeeds"],
            "Colchón frente al objetivo mínimo",
            "Efectivo accesible actual según el informe.",
            f"Mínimo recomendado: {emergency_months} meses, más necesidades de corto plazo.",
        ),
        "life": ring(
            life_current,
            life_recommended,
            "Cobertura de vida frente al mínimo recomendado",
            "Suma de las coberturas de vida registradas.",
            "Mínimo recomendado combinado para los adultos.",
        ),
        "umbrella": ring(
            umbrella_current,
            umbrella_recommended,
            "Responsabilidad civil frente al mínimo recomendado",
            "Cobertura registrada." if umbrella_details["hasUmbrellaPolicy"] else "El informe no registra una póliza.",
            "Mínimo recomendado según el informe.",
        ),
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

    response = await request_llm(
        model="gpt-5-mini",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_payload}
        ]
    )

    if not response.choices or not response.choices[0].message.content:
        raise HTTPException(status_code=502, detail="El servicio de IA devolvió una respuesta vacía.")
    try:
        result = json.loads(response.choices[0].message.content)
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=502, detail="El servicio de IA devolvió una respuesta no válida.") from error
    if not isinstance(result, dict):
        raise HTTPException(status_code=502, detail="El servicio de IA devolvió un mapa con formato no válido.")

    financial_health = raw_data["financial_health"]
    financial_score = financial_health["score"]
    narrative = financial_health.get("narrative", {})

    result.update({
        **family_identity(case_id, financial_health),
        "score": financial_score["published_score"],
        "score_band": financial_score["band"],
        "score_message": financial_score.get("message", ""),
        "pillars": financial_score["pillars"],
        "savings_data": savings_data_for_ui(financial_health),
        "protection_rings": protection_rings_for_ui(financial_health),
        "protection_details": {
            "emergency": narrative.get("protection_emergency_fund_short_observations", ""),
            "life": narrative.get("protection_life_insurance_short_observations", ""),
            "umbrella": narrative.get("protection_umbrella_short_observations", ""),
        },
        "investment_data": investment_data_for_ui(raw_data["investment_analysis"]),
        "top_moves": financial_score.get("top_moves", []),
    })
    ISLAND_MAP_CACHE[case_id] = result
    return result


@app.get("/api/cases")
def list_cases():
    """Returns the available case IDs and display names for the family selector."""
    cases_dir = BASE_DIR / "cases"
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

    response = await request_llm(
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
    answer = response.choices[0].message.content
    if not answer:
        raise HTTPException(status_code=502, detail="El servicio de IA devolvió una respuesta vacía.")
    return {"answer": answer}


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


app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")


@app.get("/")
def serve_frontend():
    return FileResponse(BASE_DIR / "static" / "islands.html")


if __name__ == "__main__":
    print("LifePath Backend v2 funcionando en: http://127.0.0.1:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000)