// PRESENTACIÓN · utilidades y escena 3D (cielo, nubes, plaza, islas, caminos, pila del informe). Copia exacta del original; el orden de carga importa.
// Rama: presentacion
// clamp, ss, lerp, V, rangeFade .. utilidades matemáticas (limitar, suavizar, interpolar, vector, fundido por tramo)
// canvas, renderer, scene, camera  escena Three.js
// skyU, sky .......... cielo con degradado y sol (shader)
// sun, fill .......... luces
// cloudTex(), addCloud(), clouds   textura y creación de nubes
// noiseTex(), M ...... texturas procedurales y materiales (terracota, mármol, piedra, agua...)
// PLAZA, plaza ....... plaza central de la que salen los caminos
// rockGeo() .......... roca flotante bajo cada isla
// ISL_POS, islands ... posición y grupo 3D de cada isla
// BUILD .............. decorado de cada isla: liq (aljibe), sav (acueducto), debt (bloques), inv (olivos), prot (cúpula)
// pulse, WI .......... anillo que late en la isla más débil
// ribbon(), paths .... caminos desde la plaza a cada isla
// slabs .............. pila del informe (5 discos) que se despliega y vuela a las islas
// ---------- helpers ----------
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const ss=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
const lerp=(a,b,t)=>a+(b-a)*t;
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
function rangeFade(p,a,b,f=.025){return Math.min(ss(a-f,a+f,p),1-ss(b-f,b+f,p))}

// ---------- three setup ----------
const canvas=document.getElementById('gl');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,0.5,4000);
scene.fog=new THREE.FogExp2(0xf3d9b0,0.0009);

// sky dome
const skyU={uTop:{value:new THREE.Color(0x2f5f9c)},uHor:{value:new THREE.Color(0xf2c27c)},uLow:{value:new THREE.Color(0xe9d3b0)},uSun:{value:V(0,0.08,-1).normalize()},uBelow:{value:0}};
const sky=new THREE.Mesh(new THREE.SphereGeometry(2000,48,24),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:skyU,
 vertexShader:`varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`uniform vec3 uTop,uHor,uLow,uSun;uniform float uBelow;varying vec3 vD;
 void main(){float h=vD.y;vec3 c=mix(uHor,uTop,smoothstep(0.0,0.55,h));c=mix(c,uLow,smoothstep(0.0,-0.35,h));
 float s=max(dot(vD,uSun),0.);c+=(1.-uBelow*.8)*vec3(1.,.78,.45)*pow(s,350.)*2.2+vec3(1.,.7,.4)*pow(s,12.)*.35*(1.-uBelow*.5);
 vec3 day=mix(vec3(.97,.84,.66),vec3(.30,.55,.84),smoothstep(-.05,.45,h));day=mix(day,vec3(.93,.86,.78),smoothstep(0.,-.4,h));c=mix(c,day,uBelow*.85);
 gl_FragColor=vec4(c,1.);}`}));
scene.add(sky);

scene.add(new THREE.HemisphereLight(0xcfe0f5,0xc98a5e,0.75));
const sun=new THREE.DirectionalLight(0xffd9a0,1.5);sun.position.set(-120,160,-300);scene.add(sun);
const fill=new THREE.DirectionalLight(0xffffff,.35);fill.position.set(100,60,200);scene.add(fill);

// cloud texture
function cloudTex(){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');
 for(let i=0;i<26;i++){const x=128+(Math.random()-.5)*130,y=140+(Math.random()-.5)*70,r=30+Math.random()*60;
  const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(255,255,255,.55)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,7);g.fill();}
 const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t;}
const ctex=cloudTex();
const clouds=[];
function addCloud(x,y,z,s,tint,op,asp=1,kind=0){const m=new THREE.SpriteMaterial({map:ctex,color:tint,transparent:true,opacity:op,depthWrite:false,fog:true});
 const sp=new THREE.Sprite(m);sp.position.set(x,y,z);sp.scale.set(s*1.6,s*asp,1);sp.userData.base=op;sp.userData.kind=kind;scene.add(sp);clouds.push(sp);return sp;}
const R=Math.random;
for(let i=0;i<300;i++)addCloud((R()-.5)*1100,8+R()*20,-900+R()*1000,100+R()*140,new THREE.Color().setHSL(.07,.55,.84+R()*.14),.8,.45,0);
for(let i=0;i<45;i++)addCloud((R()-.5)*90,10+R()*20,-110+R()*170,50+R()*70,0xffffff,.9,.8,1);
// mist sea below islands
for(let i=0;i<170;i++)addCloud((R()-.5)*1200,-175+R()*20,-900+R()*750,170+R()*160,new THREE.Color().setHSL(.08,.4,.93),.6,.25,2);

// sun glow sprite
(function(){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');const gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(255,240,200,1)');gr.addColorStop(.2,'rgba(255,210,140,.6)');gr.addColorStop(1,'rgba(255,180,90,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);
 const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),blending:THREE.AdditiveBlending,depthWrite:false,fog:false,transparent:true}));s.position.set(0,70,-1400);s.scale.set(700,700,1);scene.add(s);window.SUN=s;})();

// ---------- materials ----------
function noiseTex(base,var_,veins){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.fillStyle=base;g.fillRect(0,0,256,256);
 const id=g.getImageData(0,0,256,256);for(let i=0;i<id.data.length;i+=4){const n=(Math.random()-.5)*var_;id.data[i]+=n;id.data[i+1]+=n;id.data[i+2]+=n;}g.putImageData(id,0,0);
 if(veins){g.strokeStyle='rgba(200,160,90,.35)';g.lineWidth=1.2;for(let k=0;k<9;k++){g.beginPath();let x=Math.random()*256,y=0;g.moveTo(x,y);while(y<256){x+=(Math.random()-.5)*26;y+=12;g.lineTo(x,y);}g.stroke();}}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.encoding=THREE.sRGBEncoding;return t;}
const M={
 terra:new THREE.MeshStandardMaterial({map:noiseTex('#c0704a',38),roughness:.95,flatShading:true}),
 terraD:new THREE.MeshStandardMaterial({map:noiseTex('#94523a',30),roughness:1,flatShading:true}),
 marble:new THREE.MeshStandardMaterial({map:noiseTex('#efe6d3',14,true),roughness:.45}),
 stone:new THREE.MeshStandardMaterial({map:noiseTex('#a39789',30),roughness:.9,flatShading:true}),
 water:new THREE.MeshStandardMaterial({color:0x4f8fc0,roughness:.08,metalness:.35,emissive:0x153a5a,emissiveIntensity:.35}),
 leaf:new THREE.MeshStandardMaterial({color:0x7d8c4c,roughness:.85,flatShading:true}),
 bark:new THREE.MeshStandardMaterial({color:0x5c4632,roughness:1}),
 chain:new THREE.MeshStandardMaterial({color:0x3a3330,roughness:.4,metalness:.7}),
 gold:new THREE.MeshStandardMaterial({color:0xe8b86a,roughness:.3,metalness:.6,emissive:0x8a5a10,emissiveIntensity:.4})
};

// ---------- central plaza ----------
const PLAZA=V(0,-56,-140);
const plaza=new THREE.Group();plaza.position.copy(PLAZA);scene.add(plaza);
{const top=new THREE.Mesh(new THREE.CylinderGeometry(22,22,3,40),M.marble);plaza.add(top);
 const rock=new THREE.Mesh(rockGeo(22,48),M.terra);rock.position.y=-25.5;plaza.add(rock);
 for(let i=0;i<6;i++){const a=i/6*Math.PI*2+.3;const col=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.3,5,10),M.marble);col.position.set(Math.cos(a)*19,4,Math.sin(a)*19);plaza.add(col);}
}

function rockGeo(r,h){const g=new THREE.ConeGeometry(r,h,11,5);g.rotateX(Math.PI);const p=g.attributes.position;
 for(let i=0;i<p.count;i++){const y=p.getY(i);if(y>h/2-0.01)continue;p.setX(i,p.getX(i)*(0.8+Math.random()*.4));p.setZ(i,p.getZ(i)*(0.8+Math.random()*.4));p.setY(i,y+(Math.random()-.5)*3);}
 g.computeVertexNormals();return g;}

// ---------- islands ----------
const ISL_POS=[V(-118,-70,-250),V(-62,-54,-345),V(0,-64,-420),V(64,-50,-340),V(122,-72,-255)];
const islands=PILLARS.map((pl,i)=>{
 const g=new THREE.Group();g.position.copy(ISL_POS[i]);scene.add(g);
 const r=26+(i%2)*3;
 const top=new THREE.Mesh(new THREE.CylinderGeometry(r,r*.97,3,36),M.marble);g.add(top);
 const rim=new THREE.Mesh(new THREE.CylinderGeometry(r+.4,r+.4,1.2,36,1,true),new THREE.MeshStandardMaterial({color:pl.color,roughness:.6,emissive:pl.color,emissiveIntensity:.0}));rim.position.y=1.2;g.add(rim);g.userData.rim=rim;
 const rock=new THREE.Mesh(rockGeo(r,55+Math.random()*20),i%2?M.terraD:M.terra);rock.position.y=-30;g.add(rock);
 const w=new THREE.Group();w.position.y=1.5;g.add(w);
 g.userData.world=w;g.scale.setScalar(0.001);
 return g;});

const BUILD={
 liq(w,pl){ // cisterna: nivel de agua = score
  const ring=new THREE.Mesh(new THREE.CylinderGeometry(15,15,8,40,1,true),M.stone);ring.position.y=4;ring.material.side=THREE.DoubleSide;w.add(ring);
  const lip=new THREE.Mesh(new THREE.TorusGeometry(15,1,8,40),M.marble);lip.rotation.x=Math.PI/2;lip.position.y=8;w.add(lip);
  const water=new THREE.Mesh(new THREE.CircleGeometry(14.6,40),M.water);water.rotation.x=-Math.PI/2;water.position.y=.5+7*pl.score/100;w.add(water);w.userData.water=water;
  for(let k=0;k<4;k++){const a=k/4*Math.PI*2+.4;const c=new THREE.Mesh(new THREE.CylinderGeometry(.9,1,14,10),M.marble);c.position.set(Math.cos(a)*20,7,Math.sin(a)*20);w.add(c);}
 },
 sav(w,pl){ // acueducto con agua que fluye
  for(let k=0;k<5;k++){const x=-16+k*8;
   const pL=new THREE.Mesh(new THREE.BoxGeometry(2.2,12,4),M.terra);pL.position.set(x,6,0);w.add(pL);
   if(k<4){const a=new THREE.Mesh(new THREE.TorusGeometry(2.9,1.1,6,16,Math.PI),M.terra);a.position.set(x+4,12,0);a.scale.z=1.8;w.add(a);}}
  const deck=new THREE.Mesh(new THREE.BoxGeometry(36,2,5),M.marble);deck.position.y=15;w.add(deck);
  const ch=new THREE.Mesh(new THREE.BoxGeometry(36,.4,2.2),M.water);ch.position.y=16.2;w.add(ch);
  const drops=[];for(let k=0;k<26;k++){const d=new THREE.Mesh(new THREE.SphereGeometry(.45,6,6),M.water);d.userData.o=Math.random();w.add(d);drops.push(d);}w.userData.drops=drops;
 },
 debt(w,pl){ // sillares encadenados
  const pos=[[-7,3,-3],[2,3,-4],[10,3,0],[-3,9,-3],[6,9,-2],[1,15,-3]];
  pos.forEach((p,k)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(8,6,7),M.stone);b.position.set(...p);b.rotation.y=(Math.random()-.5)*.25;w.add(b);});
  const big=new THREE.Mesh(new THREE.BoxGeometry(9,7,8),new THREE.MeshStandardMaterial({color:0xb4573f,roughness:.8,flatShading:true}));big.position.set(-8,3.5,8);w.add(big);w.userData.big=big;
  for(let k=0;k<9;k++){const l=new THREE.Mesh(new THREE.TorusGeometry(1,.28,6,12),M.chain);l.position.set(-8+k*1.7,7.8,8-k*1.1);l.rotation.set(k%2?Math.PI/2:0,.6,0);w.add(l);}
 },
 inv(w,pl){ // olivar
  const spots=[[-12,-6],[-3,-11],[8,-8],[13,3],[-10,8],[2,4],[10,12]];
  w.userData.trees=[];
  spots.forEach(([x,z],k)=>{const t=new THREE.Group();t.position.set(x,0,z);
   const tr=new THREE.Mesh(new THREE.CylinderGeometry(.5,1,6,6),M.bark);tr.position.y=3;tr.rotation.z=(Math.random()-.5)*.3;t.add(tr);
   for(let j=0;j<3;j++){const c=new THREE.Mesh(new THREE.IcosahedronGeometry(2.6+Math.random()*1.4,0),M.leaf);c.position.set((Math.random()-.5)*3,6.5+Math.random()*2,(Math.random()-.5)*3);t.add(c);}
   const s=.6+.6*(pl.score/100);t.scale.setScalar(s);t.userData.s=s;w.add(t);w.userData.trees.push(t);});
 },
 prot(w,pl){ // cúpula incompleta = cobertura que falta
  const frac=Math.max(.2,pl.score/100);
  const dome=new THREE.Mesh(new THREE.SphereGeometry(16,40,20,0,Math.PI*2*frac,0,Math.PI/2),M.marble);dome.material=M.marble.clone();dome.material.side=THREE.DoubleSide;w.add(dome);w.userData.dome=dome;
  const ring=new THREE.Mesh(new THREE.TorusGeometry(16,.8,8,48),M.marble);ring.rotation.x=Math.PI/2;w.add(ring);
  const house=new THREE.Group();const hb=new THREE.Mesh(new THREE.BoxGeometry(6,5,6),M.terra);hb.position.y=2.5;house.add(hb);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(5,3.4,4),M.terraD);roof.position.y=6.7;roof.rotation.y=Math.PI/4;house.add(roof);w.add(house);
  // fragmentos de cúpula flotando (lo que falta)
  w.userData.frags=[];for(let k=0;k<7;k++){const f=new THREE.Mesh(new THREE.SphereGeometry(16,6,4,0,.35,.2+k*.15,.25),M.marble);f.material=M.marble;f.position.set(Math.cos(k)*6,4+k*1.2,Math.sin(k)*6);f.userData.o=k;w.add(f);w.userData.frags.push(f);}
 }
};
// rebuild (BUILD defined after use above)
islands.forEach((g,i)=>{const w=g.userData.world;while(w.children.length)w.remove(w.children[0]);BUILD[PILLARS[i].id](w,PILLARS[i]);});

// weak pulse ring
const pulse=new THREE.Mesh(new THREE.RingGeometry(30,31.5,64),new THREE.MeshBasicMaterial({color:0xE2674F,transparent:true,opacity:0,side:THREE.DoubleSide,fog:false}));
pulse.rotation.x=-Math.PI/2;scene.add(pulse);
let WI=0;

// ---------- paths (ribbons) ----------
function ribbon(curve,width,segs){const pos=[],idx=[];const up=V(0,1,0);
 for(let i=0;i<=segs;i++){const t=i/segs,p=curve.getPoint(t),tg=curve.getTangent(t);const side=new THREE.Vector3().crossVectors(tg,up).normalize().multiplyScalar(width/2);
  pos.push(p.x+side.x,p.y,p.z+side.z,p.x-side.x,p.y,p.z-side.z);
  if(i<segs){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;}
const paths=islands.map((g,i)=>{
 const end=g.position.clone().add(V(0,1.8,0));const dir=end.clone().sub(PLAZA).setY(0).normalize();
 const start=PLAZA.clone().add(dir.clone().multiplyScalar(21)).add(V(0,1.8,0));
 const mid=start.clone().lerp(end,.5);mid.y=Math.min(start.y,end.y)-14;mid.add(V(dir.z*18*(i%2?1:-1),0,0));
 const curve=new THREE.CatmullRomCurve3([start,start.clone().lerp(mid,.5).add(V(0,-3,0)),mid,mid.clone().lerp(end,.5).add(V(0,2,0)),end]);
 const geo=ribbon(curve,4.2,140);
 const mat=new THREE.MeshStandardMaterial({color:0xc8704a,roughness:.9,side:THREE.DoubleSide,emissive:PILLARS[i].color,emissiveIntensity:0});
 const m=new THREE.Mesh(geo,mat);scene.add(m);geo.setDrawRange(0,0);
 // steps edges (gold line)
 const lg=new THREE.BufferGeometry().setFromPoints(curve.getPoints(140).map(p=>p.add(V(0,.25,0))));
 const line=new THREE.Line(lg,new THREE.LineBasicMaterial({color:0xE8B86A,transparent:true,opacity:0}));scene.add(line);lg.setDrawRange(0,0);
 return {curve,mesh:m,geo,line,lg,total:geo.index.count};});

// ---------- the "report" stack (burger) ----------
const slabs=PILLARS.map((pl,i)=>{
 const g=new THREE.Group();
 const body=new THREE.Mesh(new THREE.CylinderGeometry(13,13,3.2,48),new THREE.MeshStandardMaterial({color:pl.color,roughness:.35,metalness:.15,emissive:pl.color,emissiveIntensity:.12}));g.add(body);
 const lid=new THREE.Mesh(new THREE.CylinderGeometry(13.2,13.2,.5,48),M.marble);lid.position.y=1.8;g.add(lid);
 // miniature hint of its world
 const mini=new THREE.Group();mini.scale.setScalar(.32);mini.position.y=2;BUILD[pl.id](mini,pl);g.add(mini);
 scene.add(g);return g;});

