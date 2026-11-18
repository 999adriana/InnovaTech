# Cómo trabajamos en paralelo

`main` es siempre la versión que funciona y que se presenta (`static/islands.html`, servida por `app.py`).
La demo activa conserva el prototipo integrado en `static/islands.html`. Hay una refactorización modular paralela en `islands.html` (raíz), `static/js/` y `static/css/`, pero `app.py` todavía no la sirve. `static/index.html` es otro prototipo. No abras los HTML directamente ni cambies la ruta del servidor sin integrar primero sus recursos.

## Ramas y archivos de cada una (todo dentro de `static/`)

| Rama | Parte | Archivos |
|---|---|---|
| `presentacion` | Intro de nubes, resumen, despliegue, elección de isla | `js/presentacion/escena3d.js`, `js/presentacion/flujo.js`, `css/presentacion/*`, bloque PRESENTACIÓN de `static/islands.html` |
| `mundo-liquidez` | Liquidez y fondo de emergencia | `js/mundos/liquidez.js`, `css/mundos/liquidez.css`, bloque MUNDO: LIQUIDEZ |
| `mundo-ahorro` | Ahorro y flujo de caja | `js/mundos/ahorro/*`, `css/mundos/ahorro-1.css`, `css/mundos/ahorro-2.css`, bloque MUNDO: AHORRO |
| `mundo-deuda` | Deuda | `js/mundos/deuda.js`, `css/mundos/deuda.css`, bloque MUNDO: DEUDA |
| `mundo-inversiones` | Inversiones | `js/mundos/inversiones.js`, `css/mundos/inversiones.css`, bloque MUNDO: INVERSIONES |
| `mundo-proteccion` | Protección y seguros | `js/mundos/proteccion.js`, `css/mundos/proteccion.css`, bloque MUNDO: PROTECCIÓN |

- Archivos compartidos: `js/core/estado.js` y `js/core/dom.js`. Si hay que cambiarlos, avisa antes al equipo.
- Cada archivo empieza con un comentario que explica qué hace cada función.
- En `static/islands.html`, edita solo dentro de tu bloque `MUNDO: … INICIO / FIN`.
- **No cambies el orden de los `<link>` ni de los `<script>` en `static/islands.html`**: es el orden del código original y el resultado depende de él.

## Conectar un mundo nuevo (liquidez, deuda o inversiones)

1. Crea tu `<section id="...">` dentro de tu bloque en `static/islands.html`.
2. Escribe su código en tu `.js` y sus estilos en tu `.css`.
3. Para que se abra al llegar a la isla hay que añadir unas líneas en `js/presentacion/flujo.js`. Los tres puntos exactos están en la cabecera de ese archivo. Avisa a quien lleva la rama `presentacion` para que no editéis las mismas líneas a la vez.

## Día a día

### Ejecutar la web local

Desde la carpeta raíz del repositorio, en PowerShell:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app:app --reload
```

Abre `http://127.0.0.1:8000/`. No abras `static/islands.html` haciendo doble clic: la página necesita FastAPI para `/api/cases` y `/api/case/{id}`. Si el selector de familias no carga, comprueba `http://127.0.0.1:8000/api/cases` y la terminal donde corre Uvicorn.

El `.env` debe contener `LLM_PROXY_URL` y `TEAM_KEY` para generar el mapa. MCP (`MCP_URL`, `MCP_TOKEN`) es opcional si se usan los datos locales de `cases/`. Nunca compartas ni subas `.env`.

```bash
git fetch origin
git switch mundo-deuda            # tu rama
git pull origin main              # antes de cada sesión: trae lo último de main
git add static/...                # solo tus archivos
git commit -m "Deuda: ..."
git push
# Cuando funcione: en GitHub abre un Pull Request de tu rama a main; lo revisa otro y se hace merge.
```

Reglas:
- Nunca hagas commit directamente en `main`.
- Haz `git pull origin main` a menudo, y siempre antes de abrir el Pull Request.
- Si hay conflicto: conserva los cambios de las dos partes y borra solo las marcas `<<<<<<<`, `=======` y `>>>>>>>`.
- Nunca subas el `.env`.
