// MUNDO DEUDA (rama mundo-deuda). Vacío por ahora.
// Rama: mundo-deuda. Aquí va el código del mundo.
// Función para evaluar la salud de la deuda
function renderDebtHealth(dti, housing, monthlyPayment) {
    const cardDti = document.getElementById('card-dti');
    const cardHousing = document.getElementById('card-housing');
    
    // Lógica DTI (Debt to Income): Asumimos que <= 36% es bueno (verde)
    document.getElementById('val-dti').textContent = dti + '%';
    if(dti <= 36) {
        cardDti.className = 'health-card good';
        document.getElementById('status-dti').textContent = 'Sano';
    } else {
        cardDti.className = 'health-card bad';
        document.getElementById('status-dti').textContent = 'Alerta';
    }

    // Lógica Vivienda
    document.getElementById('val-housing').textContent = housing + '%';
    if(housing <= 28) {
        cardHousing.className = 'health-card good';
        document.getElementById('status-housing').textContent = 'Sano';
    } else {
        cardHousing.className = 'health-card bad';
        document.getElementById('status-housing').textContent = 'Alerta';
    }

    document.getElementById('val-monthly').textContent = '$' + monthlyPayment.toLocaleString();
}

// Renderizar desglose con efecto 3D
function renderDebtBreakdown(debts) {
    const container = document.getElementById('debt-breakdown-container');
    container.innerHTML = debts.map(d => `
        <div class="debt-item-3d">
            <h4>${d.name}</h4>
            <div class="amount">$${d.amount.toLocaleString()}</div>
            <small style="opacity:0.6; font-size:10px;">Interés: ${d.rate}%</small>
        </div>
    `).join('');
}

// Efecto de Confeti Dorado (Elegante y no sobrecargado)
function fireGoldenConfetti() {
    const container = document.getElementById('confetti-container');
    // Generamos solo 35 partículas para que no sea agobiante
    for (let i = 0; i < 35; i++) {
        const confetti = document.createElement('div');
        confetti.classList.add('confetti');
        
        // Posición horizontal aleatoria
        confetti.style.left = Math.random() * 100 + 'vw';
        
        // Variamos sutilmente el color dorado para dar profundidad
        const isDarkGold = Math.random() > 0.5;
        confetti.style.backgroundColor = isDarkGold ? '#C8704A' : '#E8B86A';
        
        // Duración y retraso aleatorio para que no caigan todos a la vez
        const duration = Math.random() * 2 + 2; // entre 2 y 4 segundos
        const delay = Math.random() * 0.5;
        confetti.style.animationDuration = duration + 's';
        confetti.style.animationDelay = delay + 's';
        
        container.appendChild(confetti);
        
        // Limpiamos el DOM una vez terminen de caer
        setTimeout(() => confetti.remove(), (duration + delay) * 1000);
    }
}

// Evento del botón de solución
document.getElementById('btn-solve-debt').addEventListener('click', function() {
    // Cambiamos el texto de alerta a éxito
    const alertBox = document.getElementById('toxic-debt-alert');
    alertBox.classList.add('solved');
    
    alertBox.querySelector('.alert-icon').textContent = '✅';
    alertBox.querySelector('h3').textContent = 'Estrategia Aplicada: Avalancha';
    alertBox.querySelector('h3').style.color = '#39bd79';
    alertBox.querySelector('p').innerHTML = 'Utilizando el flujo de caja libre de <strong>$600/mes</strong> (visto en la isla de Ahorro) para atacar esta tarjeta, la liquidaréis en solo <strong>2 años y medio</strong>. ¡Os habéis ahorrado miles de dólares en intereses!';
    
    // Ocultar el botón
    this.style.display = 'none';
    
    // ¡Lanzar confeti!
    fireGoldenConfetti();
});

// Llamada de prueba para que veas cómo queda (puedes enlazarla con tu API luego)
// Valores del caso de la imagen que enviaste
renderDebtHealth(13, 15, 2960);
renderDebtBreakdown([
    { name: 'Hipoteca', amount: 50000, rate: 6 },
    { name: 'Préstamo Estudiantil', amount: 15000, rate: 5.5 },
    { name: 'Tarjeta Crédito (Tóxica)', amount: 18000, rate: 18 },
    { name: 'Préstamo Coche', amount: 10000, rate: 4.5 }
]);
// Para conectarlo hay que tocar 3 puntos de presentacion/flujo.js (ver su cabecera) y su <section> en islands.html.

