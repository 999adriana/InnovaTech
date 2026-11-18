// MUNDO PROTECCIÓN · datos, funciones y eventos. Copia exacta del original; el orden de carga importa.
// Rama: mundo-proteccion
// PROTECTION_SECTIONS  las 3 capas del escudo: fondo de emergencia, seguro de vida y responsabilidad civil
// PROT_ART ........... iconos SVG de cada capa
// selectProtection(id,open)  rellena el detalle de una capa con los datos del caso y lo abre
// Al final: eventos de los anillos, cerrar detalle y botón de acciones.
const PROTECTION_SECTIONS={
 emergency:{pillarId:'liq',title:'Fondo de emergencia',narrativeKey:'emergency',icon:'emergency'},
 life:{pillarId:'prot',title:'Seguro de vida',narrativeKey:'life',icon:'life'},
 umbrella:{pillarId:'prot',title:'Responsabilidad civil',narrativeKey:'umbrella',icon:'umbrella'}
};
const PROT_ART={
 emergency:`<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M24 5 41 12v12c0 9-7 15-17 19C14 39 7 33 7 24V12L24 5Z"/><path d="M15 25h18M24 16v18"/><circle cx="24" cy="25" r="7" stroke="#f2d7a2"/></svg>`,
 life:`<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M24 41S7 31 7 18a9 9 0 0 1 17-4 9 9 0 0 1 17 4c0 13-17 23-17 23Z"/><path d="M24 17v14m-7-7h14" stroke="#f2d7a2"/></svg>`,
 umbrella:`<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 24a19 19 0 0 1 38 0c-5-5-10-5-14 0-5-5-10-5-14 0-4-5-7-5-10 0Z"/><path d="M24 5v27a6 6 0 0 0 12 0"/><path d="M24 5v-2" stroke="#f2d7a2"/></svg>`
};
function selectProtection(id,open=true){
 const section=PROTECTION_SECTIONS[id];
 const pillar=currentCaseData&&currentCaseData.pillars.find(p=>p.id===section?.pillarId);
 if(!section||!pillar){
  $('data-status').textContent='No hay datos cargados para esta capa.';
  return;
 }
 const details=currentCaseData.protection_details?.[section.narrativeKey]||'';
 const matchingMove={life:/life|insurance|cover/i,umbrella:/umbrella|liability/i,emergency:/emergency|reserve|cash|liquidity/i}[id];
 const move=currentCaseData.top_moves?.find(item=>matchingMove.test(item.title||'')||matchingMove.test(item.action||''));
 const next=move?.action||(currentCaseData.islands||[]).find(island=>island.icon_type==='proteccion')?.first_step||'Consultad las observaciones del informe para este caso.';
 document.querySelectorAll('.prot-orbit').forEach(b=>b.classList.toggle('active',b.dataset.prot===id));
 $('protIcon').innerHTML=PROT_ART[section.icon];$('protKicker').textContent=`PILAR · ${pillar.name}`;$('protName').textContent=section.title;$('protStatus').textContent=`${pillar.score}/100`;$('protStatus').classList.toggle('alert',pillar.score<50);
 $('protCurrent').textContent=`${pillar.score}/100`;$('protCurrentNote').textContent='Puntuación del informe';
 $('protRecommended').textContent='100/100';$('protRecNote').textContent='Máximo de la escala';
 $('protMeterLabel').textContent='Puntuación del pilar';$('protMeterValue').textContent=`${pillar.score}/100`;$('protMeterFill').style.width=`${pillar.score}%`;$('protMeter').classList.toggle('critical',pillar.score<50);
 $('protCopy').textContent=details||currentCaseData.score_message;$('protNext').textContent=next;
 if(open)$('protDetail').classList.add('open');
}
document.querySelectorAll('.prot-orbit').forEach(b=>b.addEventListener('click',()=>selectProtection(b.dataset.prot)));
$('protDetail').classList.remove('open');
$('protClose').addEventListener('click',()=> $('protDetail').classList.remove('open'));
$('protActionToggle').addEventListener('click',()=>{const panel=$('protActions');panel.classList.toggle('show');$('protActionToggle').textContent=panel.classList.contains('show')?'Ocultar próximos pasos ↑':'Ver próximos pasos →'});
