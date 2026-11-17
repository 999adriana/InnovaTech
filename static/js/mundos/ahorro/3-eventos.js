// MUNDO AHORRO · eventos. Copia exacta del original; el orden de carga importa.
// Rama: mundo-ahorro
// Eventos del mundo: cerrar detalle, control deslizante, plan mensual/meta y pestañas.
$('closeDetail').onclick=()=>{$('branchDetail').hidden=true;selectedBranch=null;$('savBranches').querySelectorAll('.sav-node').forEach(b=>b.classList.remove('selected'));};
$('branchSlider').addEventListener('input',e=>{const c=SAVINGS_DATA.categories.find(x=>x.id===selectedBranch);if(!c)return;c.amount=Number(e.target.value);updateFreeCash();});
$('planMonthly').addEventListener('input',updatePlan);$('goalAmount').addEventListener('input',updatePlan);
document.querySelectorAll('.sav-tabs button').forEach(b=>b.addEventListener('click',()=>setSavingsScreen(b.dataset.screen)));
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>setSavingsScreen(b.dataset.go)));
