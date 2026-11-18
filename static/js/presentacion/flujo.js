// PRESENTACIÓN · datos del caso, scroll, cámara, elección de isla y bucle (se carga el último). Copia exacta del original; el orden de carga importa.
// Rama: presentacion
// hud, svgL, labs, lines, cards ... textos, líneas guía, etiquetas y tarjetas de cada isla
// getPillarId(nombre) .......... traduce el nombre del pilar del JSON a 'liq','sav','debt','inv','prot'
// updatePillarScoreVisual() .... ajusta el decorado de la isla a la puntuación
// refreshPillarUI() ............ actualiza etiquetas, tarjetas y pilar más débil
// adaptCasePillars() ........... valida los pilares que devuelve la API
// applyCaseData(data,caseId) ... vuelca el caso en la pantalla (resumen, chips, protección)
// loadCase(), initializeCaseSelector()  carga de familias desde /api
// CH, icons, dots .............. navegación lateral por capítulos
// choose(i) .................... inicia el vuelo hacia la isla i
// camAt(p), narrow() ........... posición de cámara según el scroll
// scrollP(), proj() ............ progreso del scroll y proyección 3D→pantalla
// frame() ...................... bucle principal: cámara, nubes, despliegue, caminos, tarjetas y apertura de mundos
// resize() ..................... ajusta al tamaño de ventana; la última línea arranca todo
//
// PUNTOS DE CONEXIÓN DE MUNDOS (para conectar liquidez, deuda o inversiones, avisando a presentacion):
//  1. frame(), bloque "if(flyT>1)": isSavings/isProtection deciden qué <section> se muestra.
//  2. $('back').onclick: quita las clases savings-mode/protection-mode al volver.
//  3. applyCaseData(): líneas de protection-* que rellenan el mundo con los datos del caso.
const hud={intro:$('intro'),hint:$('hint'),dive:$('divetxt'),summary:$('summary'),deploy:$('deploy'),choose:$('choose')};
const svgL=$('leaders');
const labs=PILLARS.map(()=>{const d=document.createElement('div');d.className='lab';d.innerHTML='<div class="n"></div><div class="s"><em></em><span></span></div>';document.body.appendChild(d);return d;});
const lines=PILLARS.map(()=>{const l=document.createElementNS('http://www.w3.org/2000/svg','path');l.setAttribute('stroke','#2a211b');l.setAttribute('stroke-width','1');l.setAttribute('fill','none');svgL.appendChild(l);return l;});
const cards=PILLARS.map(()=>{const d=document.createElement('div');d.className='isl';
 d.innerHTML='<div class="card glass"><div class="k"></div><div class="q"></div><span class="sc"><i></i><span></span></span><div class="hold"><svg viewBox="0 0 50 50"><circle cx="25" cy="25" r="21" stroke="rgba(255,255,255,.35)" stroke-width="2" fill="none"/><circle class="hc" cx="25" cy="25" r="21" stroke="#fff" stroke-width="2.4" fill="none" stroke-dasharray="132" stroke-dashoffset="132"/></svg><span>hold</span></div></div><div class="stem"></div>';
 document.body.appendChild(d);return d;});

function getPillarId(name){
 const normalized=name.toLowerCase();
 if(normalized.includes('liquidity')||normalized.includes('emergency'))return 'liq';
 if(normalized.includes('savings')||normalized.includes('cash flow'))return 'sav';
 if(normalized.includes('debt'))return 'debt';
 if(normalized.includes('investment'))return 'inv';
 if(normalized.includes('insurance')||normalized.includes('protection'))return 'prot';
 return null;
}
function updatePillarScoreVisual(group,pillar){
 const userData=group.userData;
 if(pillar.id==='liq'&&userData.water)userData.water.position.y=.5+7*pillar.score/100;
 if(pillar.id==='inv'&&userData.trees)userData.trees.forEach(tree=>tree.scale.setScalar(.6+.6*pillar.score/100));
 if(pillar.id==='prot'&&userData.dome){
  userData.dome.geometry.dispose();
  userData.dome.geometry=new THREE.SphereGeometry(16,40,20,0,Math.PI*2*Math.max(.2,pillar.score/100),0,Math.PI/2);
 }
}
function refreshPillarUI(){
 weakestIndex=PILLARS.reduce((weakest,pillar,index)=>pillar.score<PILLARS[weakest].score?index:weakest,0);
 WI=weakestIndex;
 PILLARS.forEach((pillar,index)=>{
  const lab=labs[index],card=cards[index];
  lab.querySelector('.n').textContent=pillar.short;
  lab.querySelector('.s em').textContent=pillar.score;
  lab.querySelector('.s span').textContent=`/100 · ${pillar.name}`;
  card.classList.toggle('weak',index===weakestIndex);
  card.querySelector('.k').textContent=`${String(index+1).padStart(2,'0')} · ${pillar.short}`;
  card.querySelector('.q').textContent=pillar.q;
  card.querySelector('.sc i').style.background=pillar.css;
  card.querySelector('.sc span').textContent=`${pillar.score}/100`;
  updatePillarScoreVisual(islands[index].userData.world,pillar);
  updatePillarScoreVisual(slabs[index].children[2],pillar);
 });
}
function adaptCasePillars(sourcePillars){
 if(!Array.isArray(sourcePillars))throw new Error('La API no devolvió la lista de pilares del caso.');
 const byId=new Map();
 sourcePillars.forEach(source=>{
  const id=getPillarId(source.pillar);
  const score=Number(source.score);
  if(!id||!Number.isFinite(score)||score<0||score>100)throw new Error(`Pilar inválido en la respuesta: ${source.pillar}`);
  if(byId.has(id))throw new Error(`Pilar duplicado en la respuesta: ${source.pillar}`);
  byId.set(id,{score});
 });
 return PILLARS.map(pillar=>{
  const data=byId.get(pillar.id);
  if(!data)throw new Error(`Falta el pilar ${pillar.id} en la respuesta de la API.`);
  return {...pillar,...data};
 });
}
function applyCaseData(data,caseId){
 const pillars=adaptCasePillars(data.pillars);
 const score=Number(data.score);
 if(!Number.isFinite(score)||score<0||score>100)throw new Error('La API devolvió una puntuación familiar inválida.');
 currentCaseData={...data,pillars};
 familyScore=score;
 pillars.forEach((pillar,index)=>Object.assign(PILLARS[index],pillar));
 currentCaseId=caseId;
 refreshPillarUI();
 const familyName=data.family_name||caseId;
 $('family-title').textContent=familyName;
 $('family-label').textContent=data.family_label||caseId.split('-').pop().toUpperCase();
 $('case-select').options[$('case-select').selectedIndex].textContent=`Familia ${data.family_label||familyName}`;
 const bandLabels={critical:'CRÍTICO',vulnerable:'VULNERABLE',stable:'ESTABLE',strong:'SÓLIDO'};
 $('score-band').textContent=bandLabels[data.score_band]||String(data.score_band||'').replace(/_/g,' ').toUpperCase();
 $('score-message').textContent=data.headline||data.score_message||'Resumen del caso disponible en el informe.';
 $('protection-family').textContent=`Vuestra red de seguridad · ${familyName}`;
 $('protection-footer').textContent=`Datos del informe de ${familyName} · puntuaciones del caso seleccionado.`;
 const protectionPillar=PILLARS.find(pillar=>pillar.id==='prot');
 $('protection-summary').textContent=`Pilar de protección · ${protectionPillar.score}/100`;
 const strongest=PILLARS.reduce((best,pillar)=>pillar.score>best.score?pillar:best);
 const weakest=PILLARS[weakestIndex];
 $('chip-strong-score').textContent=`${strongest.score}/100`;
 $('chip-strong-label').textContent=`Pilar más sólido · ${strongest.short}`;
 $('chip-focus-score').textContent=`${weakest.score}/100`;
 $('chip-focus-label').textContent=`Pilar prioritario · ${weakest.short}`;
 const firstMove=data.top_moves?.[0];
 $('chip-next-move').textContent=firstMove?.title||'—';
 $('chip-next-move').title=firstMove?.action||'';
 selectProtection('emergency',false);
}
let currentCaseId=null;
async function loadCase(caseId){
 const status=$('data-status'),selector=$('case-select');
 status.textContent='Cargando caso…';
 selector.disabled=true;
 try{
  const response=await fetch(`/api/case/${encodeURIComponent(caseId)}`);
  if(!response.ok)throw new Error(`Error al cargar el caso (${response.status}).`);
  const data=await response.json();
  applyCaseData(data,caseId);
  status.textContent=`Mapa listo · ${data.family_label||data.family_name}`;
 }catch(error){
  if(currentCaseId)selector.value=currentCaseId;
  status.textContent='No se pudieron cargar los datos del caso.';
  console.error(error);
 }finally{
  selector.disabled=false;
 }
}
async function initializeCaseSelector(){
 const selector=$('case-select');
 selector.addEventListener('change',()=>loadCase(selector.value));
 try{
  const response=await fetch('/api/cases');
  if(!response.ok)throw new Error(`Error al cargar las familias (${response.status}).`);
  const cases=await response.json();
  if(!Array.isArray(cases)||cases.length===0)throw new Error('La API no devolvió familias disponibles.');
  selector.replaceChildren(...cases.map(item=>new Option(`Familia ${item.family_label}`,item.id)));
  selector.disabled=false;
  const requestedCase=new URLSearchParams(location.search).get('case');
  const initialCase=cases.find(item=>item.id===requestedCase)?.id
   ||cases.find(item=>item.id==='timothy-melanie-weah')?.id
   ||cases[0].id;
  selector.value=initialCase;
  await loadCase(initialCase);
 }catch(error){
  selector.disabled=true;
  $('data-status').textContent='No se pudo conectar con la API de casos.';
  console.error(error);
 }
}

// chapter nav
const CH=[['Cielo',0],['Inmersión',.12],['Resumen',.27],['Despliegue',.44],['Tu camino',.64]];
const icons=['<path d="M4 14a4 4 0 0 1 4-4 5 5 0 0 1 9 1 3 3 0 0 1 0 6H6"/>','<path d="M10 3v14M5 12l5 5 5-5"/>','<circle cx="10" cy="10" r="6"/><path d="M10 4v6l4 2"/>','<rect x="4" y="3" width="12" height="3"/><rect x="4" y="8.5" width="12" height="3"/><rect x="4" y="14" width="12" height="3"/>','<path d="M3 17c4 0 4-6 7-6s3-6 7-6"/>'];
CH.forEach((c,i)=>{if(i)$('chap').insertAdjacentHTML('beforeend','<div class="ln"></div>');$('chap').insertAdjacentHTML('beforeend',`<div class="dot" data-l="${c[0]}"><svg viewBox="0 0 20 20">${icons[i]}</svg></div>`);});
const dots=[...document.querySelectorAll('#chap .dot')];

// ---------- interaction ----------
let mouse={x:-1e4,y:-1e4},hovered=-1,holding=-1,holdT=0,mode='scroll',visited=new Set(),flyT=0,flyIdx=-1;
addEventListener('pointermove',e=>{mouse.x=e.clientX;mouse.y=e.clientY;});
cards.forEach((c,i)=>{
 c.addEventListener('pointerdown',e=>{if(mode!=='scroll')return;holding=i;holdT=0;e.preventDefault();});
 c.addEventListener('pointerenter',()=>{hovered=i;});c.addEventListener('pointerleave',()=>{if(hovered===i)hovered=-1;holding=-1;});
});
addEventListener('pointerup',()=>{holding=-1;});
$('aibtn').onclick=()=>{const p=$('aipanel');p.style.display=p.style.display==='block'?'none':'block';};
$('back').onclick=()=>{$('world').style.display='none';$('world').classList.remove('savings-mode','protection-mode');mode='return';flyT=0;};

function choose(i){mode='fly';flyIdx=i;flyT=0;holding=-1;document.body.style.overflow='hidden';visited.add(i);}

// ---------- camera keyframes ----------
const camPos=V(0,70,120),camLook=V(0,55,-200),tmpP=V(0,0,0),tmpL=V(0,0,0);
function narrow(){return Math.max(1,1.35/(innerWidth/innerHeight));}
function camAt(p){
 const n=narrow(),zb=40*(n-1);
 if(p<.10){const t=ss(0,.10,p);tmpP.set(0,lerp(70,62,t),lerp(120,70,t));tmpL.set(0,lerp(64,58,t),-300);}
 else if(p<.25){const t=clamp((p-.10)/.15);const e=t*t*t;
  tmpP.set(Math.sin(t*3)*6*(1-t),lerp(62,-36,e),lerp(70,-60+zb,t));tmpL.set(lerp(0,-30,ss(.5,1,t)),lerp(58,-54,ss(0,1,t)),lerp(-300,-150,t));}
 else if(p<.43){const t=ss(.25,.43,p);tmpP.set(lerp(0,4,t),lerp(-36,-37,t),lerp(-60,-66,t)+zb);tmpL.set(-30,-54,-150);}
 else if(p<.53){const t=ss(.43,.53,p);tmpP.set(lerp(4,0,t),lerp(-37,-22,t),lerp(-66,-38,t)+zb);tmpL.set(lerp(-30,0,t),lerp(-54,-24,t),-140);}
 else if(p<.66){const t=ss(.53,.66,p);tmpP.set(0,lerp(-22,-14,t),lerp(-38,-62,t)+zb);tmpL.set(0,lerp(-24,-57,t),lerp(-140,-330,t));}
 else{const t=ss(.66,1,p);tmpP.set(Math.sin(t*1.2)*10,lerp(-14,-17,t),lerp(-62,-72,t)+zb);tmpL.set(0,-57,-330);}
}

// ---------- loop ----------
let pS=0,last=performance.now(),T=0;
function scrollP(){const m=document.documentElement.scrollHeight-innerHeight;return m>0?scrollY/m:0;}
const proj=v=>{const q=v.clone().project(camera);return {x:(q.x*.5+.5)*innerWidth,y:(-q.y*.5+.5)*innerHeight,z:q.z};};

function frame(now){
 const dt=Math.min(.05,(now-last)/1000);last=now;T+=dt;
 const p=scrollP();pS+=(p-pS)*Math.min(1,dt*6);const P=pS;

 // camera
 if(mode==='scroll'){camAt(P);camPos.lerp(tmpP,Math.min(1,dt*8));camLook.lerp(tmpL,Math.min(1,dt*8));}
 else if(mode==='fly'){flyT+=dt/2.6;const c=paths[flyIdx].curve;const t=ss(0,1,flyT);
  const pt=c.getPoint(Math.min(.999,t)).add(V(0,9-4*t,0));const ahead=c.getPoint(Math.min(1,t+.08)).add(V(0,4,0));
  camPos.lerp(pt,Math.min(1,dt*5));camLook.lerp(ahead,Math.min(1,dt*5));
  if(flyT>1){const pl=PILLARS[flyIdx];const w=$('world');w.style.display='flex';
   w.style.background=`linear-gradient(180deg,rgba(0,0,0,0) 30%,${pl.css}ee 100%),radial-gradient(circle at 70% 30%,${pl.css}99,rgba(28,23,20,.92))`;
   $('wk').textContent=`Mundo ${String(flyIdx+1).padStart(2,'0')} · ${pl.short}`;$('wt').textContent=pl.name;$('wq').textContent=pl.q;
   const isSavings=pl.id==='sav';const isProtection=pl.id==='prot';
   w.classList.toggle('savings-mode',isSavings);w.classList.toggle('protection-mode',isProtection);
   $('savingsView').style.display=isSavings?'flex':'none';$('protectionView').style.display=isProtection?'flex':'none';
   $('genericWorld').style.display=(isSavings||isProtection)?'none':'block';
   w.querySelector('.world-inner').scrollTop=0;
   $('prog').textContent=`${visited.size} de 5 mundos recorridos`+(visited.size===5?' · informe completo':'');mode='world';}}
 else if(mode==='return'){flyT+=dt/1.4;camAt(P);camPos.lerp(tmpP,Math.min(1,dt*3));camLook.lerp(tmpL,Math.min(1,dt*3));if(flyT>1){mode='scroll';document.body.style.overflow='';}}
 camera.position.copy(camPos);camera.lookAt(camLook);

 // whiteout through clouds
 const cy=camera.position.y;let wo=clamp(1-Math.abs(cy-19)/13)*.92;
 if(mode==='fly')wo=Math.max(wo,ss(.8,1,flyT));if(mode==='world')wo=0;
 $('white').style.opacity=wo;
 const below=ss(12,-12,cy);skyU.uBelow.value=below;SUN.material.opacity=1-below*.85;
 scene.fog.color.setRGB(lerp(.96,.86,below),lerp(.82,.84,below),lerp(.62,.84,below));
 scene.fog.density=lerp(.0007,.0008,below);
 // cloud fade when near camera
 clouds.forEach(c=>{const d=c.position.distanceTo(camera.position);let f=clamp((d-8)/40);if(c.userData.kind<2&&below>.3)f*=lerp(1,clamp((d-160)/260),ss(.3,1,below));c.material.opacity=c.userData.base*f;});

 // deploy background shift (warm -> cream) during explosion
 const cream=rangeFade(P,.47,.60,.03);
 skyU.uLow.value.setRGB(lerp(.91,.96,cream),lerp(.83,.93,cream),lerp(.69,.86,cream));

 // ---- report stack: stacked -> exploded -> fly to islands ----
 const appear=ss(.30,.40,P),explode=ss(.44,.52,P),fly=ss(.53,.62,P);
 slabs.forEach((s,i)=>{
  const stackY=-46+i*3.8, expY=-44+i*11;
  const base=V(PLAZA.x,lerp(stackY,expY,explode)+ (1-appear)*-30,PLAZA.z);
  const ft=clamp(fly*1.25-i*.06);const target=islands[i].position.clone().add(V(0,4,0));
  const pos=base.clone().lerp(target,ss(0,1,ft));pos.y+=Math.sin(ss(0,1,ft)*Math.PI)*28;
  s.position.copy(pos);s.rotation.y=T*.15+i*.4+explode*0.6;s.rotation.z=Math.sin(ss(0,1,ft)*Math.PI)*.4;
  const sc=appear*(1-ss(.75,1,ft));s.scale.setScalar(Math.max(.001,sc));
  // island grows on arrival
  const arrive=ss(.7,1,ft);islands[i].scale.setScalar(Math.max(.001,arrive));
  islands[i].position.y=ISL_POS[i].y+Math.sin(T*.6+i)*1.2;
 });
 // paths draw
 const draw=ss(.58,.70,P);
 paths.forEach((pa,i)=>{const d=clamp(draw*1.3-i*.06);pa.geo.setDrawRange(0,Math.floor(pa.total*d/6)*6);
  const lit=(mode==='fly'&&flyIdx===i)?1:(visited.has(i)?.45:(hovered===i?.7:0));
  pa.mesh.material.emissiveIntensity=lerp(pa.mesh.material.emissiveIntensity,lit*.8,dt*6);
  pa.lg.setDrawRange(0,Math.floor(141*d));pa.line.material.opacity=lerp(pa.line.material.opacity,lit,dt*6);});

 // island idle anims
 islands.forEach((g,i)=>{const w=g.userData.world,u=w.userData;
  const hov=(hovered===i&&mode==='scroll')?1:0;g.userData.rim.material.emissiveIntensity=lerp(g.userData.rim.material.emissiveIntensity,hov*1.2+(visited.has(i)?.4:0),dt*6);
  w.position.y=1.5+hov*1.5;w.rotation.y+=dt*.05;
  if(u.drops)u.drops.forEach(d=>{const t=(d.userData.o+T*.25)%1;d.position.set(-18+t*36,16.6+Math.sin(t*40)*.1,(d.userData.o-.5)*1.4);});
  if(u.frags)u.frags.forEach(f=>{f.position.y=18+f.userData.o*1.6+Math.sin(T+f.userData.o)*1.2;f.rotation.y=T*.2+f.userData.o;});
  if(u.big)u.big.rotation.z=Math.sin(T*2)*.03;
 });
 slabs.forEach(s=>{const u=s.children[2].userData;if(u&&u.drops)u.drops.forEach(d=>{const t=(d.userData.o+T*.25)%1;d.position.set(-18+t*36,16.6,0);});});
 // weak pulse
 pulse.position.copy(islands[WI].position).add(V(0,-1,0));const pt=(T*.6)%1;pulse.scale.setScalar(1+pt*.5);
 pulse.material.opacity=(1-pt)*.7*ss(.68,.74,P)*(mode==='scroll'?1:0);

 // ---- HUD ----
 const show=(el,o)=>{el.style.opacity=o;el.style.transform=`translateY(${(1-o)*24}px)`;};
 show(hud.intro,1-ss(.03,.08,P));hud.hint.style.opacity=1-ss(.01,.04,P);
 show(hud.dive,rangeFade(P,.13,.19,.02));
 const so=rangeFade(P,.28,.42);show(hud.summary,so);
 const sc=Math.round(familyScore*ss(.29,.36,P));$('scoreN').textContent=sc;$('arc').setAttribute('stroke-dashoffset',326.7*(1-sc/100));
 show(hud.deploy,rangeFade(P,.46,.56));
 const co=(mode==='scroll'||mode==='return')?ss(.68,.74,P):0;show(hud.choose,co);
 // leaders during explosion
 const lo=rangeFade(P,.47,.545,.02);svgL.style.opacity=lo;
 slabs.forEach((s,i)=>{const sp=proj(s.position.clone().add(V(13,0,0)));const left=i%2===1;
  const sp2=proj(s.position.clone().add(V(left?-13:13,0,0)));const lx=sp2.x+(left?-120:120),ly=sp2.y;
  lines[i].setAttribute('d',`M${sp2.x},${sp2.y} L${lx},${ly}`);
  labs[i].style.opacity=lo;labs[i].style.left=(left?lx-labs[i].offsetWidth-8:lx+8)+'px';labs[i].style.top=(ly-22)+'px';});
 // island cards
 cards.forEach((c,i)=>{const sp=proj(islands[i].position.clone().add(V(0,16,0)));
  c.style.left=sp.x+'px';c.style.top=sp.y+'px';c.style.opacity=co;c.style.pointerEvents=co>.5?'auto':'none';
  c.classList.toggle('hov',hovered===i);c.classList.toggle('done',visited.has(i));
  const hc=c.querySelector('.hc');const v=holding===i?holdT:0;hc.setAttribute('stroke-dashoffset',132*(1-v));});
 if(holding>=0&&mode==='scroll'){holdT+=dt/0.8;if(holdT>=1)choose(holding);}else holdT=0;

 // chapter nav
 let ci=0;CH.forEach((c,i)=>{if(P>=c[1]-.01)ci=i;});dots.forEach((d,i)=>d.classList.toggle('on',i===ci));

 renderer.render(scene,camera);requestAnimationFrame(frame);
}
function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();requestAnimationFrame(frame);initializeCaseSelector();
