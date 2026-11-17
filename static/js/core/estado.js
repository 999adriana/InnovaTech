// NÚCLEO · pilares y estado del caso. Copia exacta del original; el orden de carga importa.
// Rama: compartido (cambiar solo avisando al equipo)
// PILLARS ............ los 5 pilares: id ('liq','sav','debt','inv','prot'), nombre, color, pregunta y puntuación del caso
// weakestIndex ....... índice del pilar más débil (lo calcula refreshPillarUI en flujo.js)
// familyScore ........ puntuación global de la familia (0-100)
// currentCaseData .... datos del caso cargado desde /api/case/<id>; los mundos leen de aquí
// ---------- Pillar presentation metadata ----------
const PILLARS=[
 {id:'liq', name:'Liquidez', short:'Liquidez', score:0, color:0x4f8fc0, css:'#4f8fc0', q:'¿Y si mañana pasa algo?'},
 {id:'sav', name:'Ahorro', short:'Ahorro', score:0, color:0x6aa39a, css:'#6aa39a', q:'¿A dónde se va nuestro dinero?'},
 {id:'debt',name:'Deuda', short:'Deuda', score:0, color:0x9c8a7c, css:'#9c8a7c', q:'¿Cuándo dejaremos de deber?'},
 {id:'inv', name:'Inversiones', short:'Inversiones', score:0, color:0x7b8f4a, css:'#7b8f4a', q:'¿Estamos haciendo crecer lo que tenemos?'},
 {id:'prot',name:'Protección', short:'Protección', score:0, color:0xd9b36c, css:'#d9b36c', q:'¿Qué protección necesita vuestro hogar?'}
];
let weakestIndex=0;
let familyScore=0;
let currentCaseData=null;

