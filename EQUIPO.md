# Cómo trabajamos en paralelo

`main` es siempre la versión que funciona y que se presenta (`static/islands.html`, servida por `app.py`).
El código es exactamente el mismo que antes. Solo se ha repartido en archivos, uno o varios por parte, para que cada uno trabaje en su rama sin pisar a los demás.

## Ramas y archivos de cada una (todo dentro de `static/`)

| Rama | Parte | Archivos |
|---|---|---|
| `presentacion` | Intro de nubes, resumen, despliegue, elección de isla | `js/presentacion/escena3d.js`, `js/presentacion/flujo.js`, `css/presentacion/*`, bloque PRESENTACIÓN de `islands.html` |
| `mundo-liquidez` | Liquidez y fondo de emergencia | `js/mundos/liquidez.js`, `css/mundos/liquidez.css`, bloque MUNDO: LIQUIDEZ |
| `mundo-ahorro` | Ahorro y flujo de caja | `js/mundos/ahorro/*`, `css/mundos/ahorro-1.css`, `css/mundos/ahorro-2.css`, bloque MUNDO: AHORRO |
| `mundo-deuda` | Deuda | `js/mundos/deuda.js`, `css/mundos/deuda.css`, bloque MUNDO: DEUDA |
| `mundo-inversiones` | Inversiones | `js/mundos/inversiones.js`, `css/mundos/inversiones.css`, bloque MUNDO: INVERSIONES |
| `mundo-proteccion` | Protección y seguros | `js/mundos/proteccion.js`, `css/mundos/proteccion.css`, bloque MUNDO: PROTECCIÓN |

- Archivos compartidos: `js/core/estado.js` y `js/core/dom.js`. Si hay que cambiarlos, avisa antes al equipo.
- Cada archivo empieza con un comentario que explica qué hace cada función.
- En `islands.html`, edita solo dentro de tu bloque `MUNDO: … INICIO / FIN`.
- **No cambies el orden de los `<link>` ni de los `<script>` en `islands.html`**: es el orden del código original y el resultado depende de él.

## Conectar un mundo nuevo (liquidez, deuda o inversiones)

1. Crea tu `<section id="...">` dentro de tu bloque en `islands.html`.
2. Escribe su código en tu `.js` y sus estilos en tu `.css`.
3. Para que se abra al llegar a la isla hay que añadir unas líneas en `js/presentacion/flujo.js`. Los tres puntos exactos están en la cabecera de ese archivo. Avisa a quien lleva la rama `presentacion` para que no editéis las mismas líneas a la vez.

## Día a día

```bash
git fetch origin
git switch mundo-deuda            # tu rama
git pull origin main              # antes de cada sesión: trae lo último de main
uvicorn app:app --reload          # probar en http://localhost:8000
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
