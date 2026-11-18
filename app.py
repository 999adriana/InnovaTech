import json
import os
from math import isfinite
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
    base_url=f"{os.environ.get('LLM_PROXY_URL', 'http://localhost').rstrip('/')}/v1",
    api_key=os.environ.get("TEAM_KEY", "missing"),
    timeout=90,
)

# Mapas de islas ya generados por la IA y guardados en disco: el enlace publico sigue
# funcionando aunque la clave del modelo caduque (las cifras siempre salen de los datos).
MAPS_DIR = Path("cases") / "_maps"


def load_saved_map(case_id: str) -> dict | None:
    f = MAPS_DIR / f"{case_id}.json"
    if f.exists():
        return json.loads(f.read_text(encoding="utf-8"))
    return None


def save_map(case_id: str, island_map: dict) -> None:
    try:
        MAPS_DIR.mkdir(parents=True, exist_ok=True)
        (MAPS_DIR / f"{case_id}.json").write_text(json.dumps(island_map, ensure_ascii=False, indent=1), encoding="utf-8")
    except OSError as e:
        print(f"[INFO] No se pudo guardar el mapa de {case_id}: {e}")

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
        "Taxes": ("taxes", "Taxes", "Household taxes and withholdings.", "receipt", "#b98562"),
        "Expenses": ("expenses", "Essential expenses", "Everyday spending recorded in the report.", "bag", "#8fa88d"),
        "Housing Expenses": ("housing", "Housing", "Mortgage, property taxes and housing costs.", "home", "#d9b36c"),
        "Debt Payments": ("debt", "Debt", "Debt payments recorded in the report.", "wallet", "#c4a4b0"),
        "Savings": ("saving", "Savings & investing", "Savings contributions currently recorded.", "plant", "#9da97a"),
    }
    categories = []
    for index, item in enumerate(cashflow["outflows"]["items"]):
        source_name = item["name"]
        category_id, name, detail, icon, color = styles.get(
            source_name,
            (f"category-{index}", source_name, "Monthly amount from the report.", "spark", "#9da97a"),
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
            "Cushion versus the minimum target",
            "Accessible cash today according to the report.",
            f"Recommended minimum: {emergency_months} months, plus short-term needs.",
        ),
        "life": ring(
            life_current,
            life_recommended,
            "Life cover versus the recommended minimum",
            "Sum of the life cover recorded.",
            "Combined recommended minimum for the adults.",
        ),
        "umbrella": ring(
            umbrella_current,
            umbrella_recommended,
            "Umbrella liability versus the recommended minimum",
            "Cover recorded." if umbrella_details["hasUmbrellaPolicy"] else "The report records no policy.",
            "Recommended minimum according to the report.",
        ),
    }


@app.get("/api/case/{case_id}")
async def get_island_map(case_id: str, refresh: bool = Query(default=False)):
    """Genera y cachea el mapa enriquecido de LifePath con psicología, simulador y perspectivas."""
    if not refresh and case_id in ISLAND_MAP_CACHE:
        return ISLAND_MAP_CACHE[case_id]

    raw_data = await fetch_family_data(case_id)

    system_prompt = """
    Eres el motor inteligente de LifePath (Sherpas Wealth). Transforma los datos financieros y el perfil psicologico (persona.md) de esta familia en un mapa interactivo de 4 islas. ESCRIBE TODOS LOS TEXTOS DEL JSON EN INGLES (English), con el mismo vocabulario del informe.
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

    try:
        response = llm.chat.completions.create(
            model="gpt-5-mini",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_payload}
            ]
        )
        result = json.loads(response.choices[0].message.content)
        save_map(case_id, result)
    except Exception as e:
        result = load_saved_map(case_id)
        if result is None:
            raise
        print(f"[INFO] Usando el mapa guardado para {case_id} (LLM: {e})")
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
        # datos completos para el dashboard de Investment analysis y para las islas de deuda y objetivos
        "investment_analysis": raw_data["investment_analysis"],
        "financial_health": financial_health,
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
        f"You are speaking with {req.member_perspective}; adapt the tone to their profile in persona.md. "
        if req.member_perspective else ""
    )

    try:
        response = llm.chat.completions.create(
            model="gpt-5-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"You are the assistant for this family's Sherpas financial plan report. You know the report in detail and you only answer questions about it. "
                        f"The user is currently looking at: '{req.island_title}'. {perspective_note}"
                        f"Answer in clear, warm, plain English (at most 4 sentences). Use ONLY the figures in the data below and quote them as the report labels them; "
                        f"if the answer is not in the data, say so. Do not give personalised investment advice.\n\n"
                        f"{json.dumps(raw_data, ensure_ascii=False)[:32000]}"
                    )
                },
                {"role": "user", "content": req.question}
            ]
        )
    except Exception as e:
        print(f"[INFO] Asistente no disponible: {e}")
        return {"answer": "The assistant is not available right now. Every figure of your plan is still on the islands: open any island to see it."}
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