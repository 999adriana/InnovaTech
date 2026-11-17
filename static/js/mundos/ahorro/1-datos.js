// MUNDO AHORRO · datos y funciones. Copia exacta del original; el orden de carga importa.
// Rama: mundo-ahorro
// SAVINGS_DATA ....... ingresos y categorías de gasto del simulador (importes de ejemplo)
// euro(n) ............ formatea un número como euros
// SAVING_ART ......... iconos SVG de cada categoría
// freeCash() ......... dinero libre = ingresos - suma de categorías
// renderSavings() .... pinta los caminos del dinero y el bloque de dinero libre
// updateFreeCash() ... recalcula el dinero libre y los importes al mover el control
// selectedBranch ..... categoría abierta en el detalle
// openBranch(id) ..... abre el detalle de una categoría
// setSavingsScreen(s)  cambia de pantalla: 'map' (caminos), 'plan' (objetivo), 'dream' (meta)
// updatePlan() ....... recalcula el plan de ahorro y el tiempo hasta la meta
// Simulador aislado con importes ficticios; no representa los datos del caso MCP.
const SAVINGS_DATA={income:3450,categories:[
 {id:'home',name:'Vivienda',amount:1100,color:'#d8a078',icon:'home',detail:'Alquiler / hipoteca y suministros',hint:'Un gasto esencial que conviene mantener bajo control.'},
 {id:'tax',name:'Impuestos',amount:450,color:'#e8b86a',icon:'receipt',detail:'Impuestos y cotizaciones',hint:'Pagos obligatorios: aquí normalmente hay menos margen de ajuste.'},
 {id:'debt',name:'Deuda',amount:250,color:'#d98270',icon:'wallet',detail:'Préstamos y tarjetas',hint:'Revisar intereses y condiciones puede ayudar a reducir el coste total.'},
 {id:'saving',name:'Ahorro',amount:500,color:'#79b5a4',icon:'piggy',detail:'Dinero reservado cada mes',hint:'Una aportación constante puede ayudaros a construir vuestro colchón.'},
 {id:'invest',name:'Inversiones',amount:350,color:'#a8b879',icon:'plant',detail:'Cartera y aportaciones',hint:'Ajustadlo siempre a vuestro horizonte y tolerancia al riesgo.'},
 {id:'life',name:'Estilo de vida',amount:500,color:'#9baed0',icon:'bag',detail:'Alimentación, ocio y compras',hint:'Es el camino donde a menudo podéis encontrar pequeños ajustes sin tocar lo esencial.'}
]};
const euro=n=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
const SAVING_ART={
 home:`<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22 24 7l18 15"/><path d="M11 20v21h26V20M20 41V27h9v14"/><path d="M15 25h4v5h-4zM31 25h4v5h-4z"/><path d="M4 22 24 5l20 17" stroke="#f2d7a2" stroke-width="2.4"/></svg>`,
 receipt:`<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 6h22v36l-5-3-6 3-5-3-6 3z"/><path d="M18 16h12M18 22h12M18 28h7"/><circle cx="31" cy="33" r="5" stroke="#f2d7a2"/><path d="M31 30v6m-2-4h4"/></svg>`,
 wallet:`<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="12" width="36" height="28" rx="5"/><path d="M9 12V9a3 3 0 0 1 3-3h24v6"/><path d="M31 22h11v10H31a5 5 0 0 1 0-10Z"/><circle cx="33" cy="27" r="1" fill="#f2d7a2" stroke="none"/><path d="M11 18h12" stroke="#f2d7a2"/></svg>`,
 piggy:`<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 22c0-7 7-12 16-12s15 5 15 12v7c0 5-5 9-12 9H18l-5 4v-7c-3-2-5-5-5-9 0-2 1-3 2-4Z"/><path d="M20 10V6h12v4M17 22h.1M32 22h.1" stroke-width="2.8"/><path d="M23 29c2 2 5 2 7 0"/><path d="M5 25h5M38 17l4-4" stroke="#f2d7a2"/></svg>`,
 plant:`<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M24 39V18"/><path d="M24 27c-10 0-14-6-13-14 8-1 14 4 13 14ZM24 22c0-9 6-14 15-13 0 8-5 14-15 13Z"/><path d="M14 39h20l-3 5H17z"/><path d="M24 18v-6" stroke="#f2d7a2"/></svg>`,
 bag:`<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17h30l-3 26H12z"/><path d="M17 18v-5a7 7 0 0 1 14 0v5"/><path d="M18 28h12" stroke="#f2d7a2"/><path d="M24 24v9m-3-3 3 3 3-3"/></svg>`,
 spark:`<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M24 5 28 18l13 6-13 5-4 14-5-14-13-5 13-6z"/><path d="m37 5 1.5 5L43 12l-4.5 2L37 19l-2-5-5-2 5-2z" stroke="#f2d7a2"/><circle cx="10" cy="10" r="2" fill="#f2d7a2" stroke="none"/></svg>`
};
function freeCash(){return SAVINGS_DATA.income-SAVINGS_DATA.categories.reduce((a,c)=>a+c.amount,0)}
function renderSavings(){
 $('savIncome').textContent=euro(SAVINGS_DATA.income);
 $('savBranches').innerHTML=SAVINGS_DATA.categories.map((c,i)=>`<button class="sav-node" data-cat="${c.id}" style="--node-color:${c.color}"><span class="node-icon">${SAVING_ART[c.icon]||''}</span><span class="node-copy"><small>CAMINO 0${i+1}</small><b>${c.name}</b><em>${c.detail}</em></span><strong class="node-amount">${euro(c.amount)}</strong><span class="node-arrow">↗</span></button>`).join('');
 $('savBranches').querySelectorAll('.sav-node').forEach(b=>b.addEventListener('click',()=>openBranch(b.dataset.cat)));
 updateFreeCash(); updatePlan();
}
function updateFreeCash(){
 const free=freeCash(); $('savFree').textContent=euro(free); $('savFree').classList.toggle('negative',free<0);
 $('savBranches').querySelectorAll('.sav-node').forEach(b=>{const c=SAVINGS_DATA.categories.find(x=>x.id===b.dataset.cat);if(c)b.querySelector('.node-amount').textContent=euro(c.amount)});
 const selected=SAVINGS_DATA.categories.find(c=>c.id===selectedBranch);
 if(selected){$('detailAmount').textContent=euro(selected.amount);$('detailPercent').textContent=`${(selected.amount/SAVINGS_DATA.income*100).toLocaleString('es-ES',{maximumFractionDigits:1})}% del ingreso`;}
}
let selectedBranch=null;
function openBranch(id){
 const c=SAVINGS_DATA.categories.find(x=>x.id===id);if(!c)return;selectedBranch=id;
 $('branchDetail').hidden=false;$('detailIcon').innerHTML=SAVING_ART[c.icon]||'';$('detailName').textContent=c.name;$('detailKicker').textContent=c.detail.toUpperCase();$('detailHint').textContent=c.hint;
 $('branchSlider').value=c.amount;$('branchSlider').max=Math.max(1800,c.amount);updateFreeCash();
 $('savBranches').querySelectorAll('.sav-node').forEach(b=>b.classList.toggle('selected',b.dataset.cat===id));
}
function setSavingsScreen(screen){
 document.querySelectorAll('.sav-screen').forEach(x=>x.classList.toggle('active',x.id===`screen-${screen}`));
 document.querySelectorAll('.sav-tabs button').forEach(x=>x.classList.toggle('active',x.dataset.screen===screen));
 const titles={map:'Primero, veamos cómo se mueve',plan:'Ahora, pongámosle un objetivo',dream:'El futuro que estáis construyendo'};$('savStepTitle').textContent=titles[screen]||titles.map;
}
function updatePlan(){
 const monthly=Number($('planMonthly').value),goal=Number($('goalAmount').value),saved=5000,years=Math.max(0,(goal-saved)/Math.max(1,monthly*12));
 $('planMonthlyLabel').textContent=euro(monthly);$('goalAmountLabel').textContent=euro(goal);$('planGoalText').textContent=euro(goal);
 $('planMonths').textContent=years.toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1});$('dreamYears').textContent=years.toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1})+' años';
 $('planProgress').style.width=Math.min(100,saved/goal*100)+'%';
 const current=SAVINGS_DATA.categories.find(c=>c.id==='saving').amount,extra=monthly-current,free=Math.max(0,freeCash());
 let message='';
 if(extra<=0)message=`Con esta aportación estaríais reservando ${euro(Math.abs(extra))} menos que ahora. Podéis mantener la diferencia como dinero disponible.`;
 else if(extra<=free)message=`Para llegar a ${euro(monthly)}/mes, bastaría con destinar ${euro(extra)} más de vuestro dinero libre. No haría falta tocar vuestros gastos habituales.`;
 else message=`Podríais usar los ${euro(free)} libres y buscar ${euro(extra-free)} adicionales en gastos flexibles, por ejemplo revisando ocio, compras o suscripciones.`;
 $('planSource').textContent=message;
}
