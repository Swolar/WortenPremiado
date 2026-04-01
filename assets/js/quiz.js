// ========== QUIZ DATA ==========
// Banners: 1.png (principal), 2.png (armazem), 3.png (entrega), 4.png (unboxing)
const Q = [
  {
    banner: "assets/images/1.png",
    q: "Com que frequência fazes compras online?",
    o: ["Sempre", "Às vezes", "Ocasionalmente", "Raramente"]
  },
  {
    banner: "assets/images/6.png",
    q: "Qual é a tua opinião sobre a variedade de produtos disponíveis na Internet?",
    o: ["Excelente", "Boa", "Aceitável", "Insatisfatória"]
  },
  {
    banner: "assets/images/3.png",
    q: "Como classificarias a eficiência da entrega dos produtos comprados na Internet?",
    o: ["Rápida", "Aceitável", "Lenta", "Só compro em loja"]
  },
  {
    banner: "assets/images/2.png",
    q: "Em relação ao atendimento ao cliente da Worten, como o descreverias?",
    o: ["Excelente", "Bom", "Regular", "Insatisfatório"]
  },
  {
    banner: "assets/images/5.png",
    q: "Por onde conheceste a Worten?",
    o: ["Pelo Instagram", "Pelo TikTok", "Pelo Facebook", "Na minha cidade"]
  },
  {
    banner: "assets/images/4.png",
    q: "Recomendarias a Worten a um amigo ou familiar?",
    o: ["Com certeza", "Provavelmente", "Talvez", "Não"]
  }
];

// ========== ROULETTE SEGMENTS ==========
// Index 0 = top (pointer lands here at 0deg)
const SEG = [
  { label: "5%",   sub: "DE DESCONTO", color: "#424242" },
  { label: "75%",  sub: "DE DESCONTO", color: "#00BFA5" },
  { label: "50%",  sub: "DE DESCONTO", color: "#00897B" },
  { label: "",     sub: "Tente\noutra vez", color: "#616161", retry: true },
  { label: "5%",   sub: "DE DESCONTO", color: "#37474F" },
  { label: "25%",  sub: "DE DESCONTO", color: "#333" },
  { label: "90%",  sub: "DE DESCONTO", color: "#C62828" },
  { label: "10%",  sub: "DE DESCONTO", color: "#D84315" }
];

// Controlled results: spin 1 = retry (index 3), spin 2 = 90% (index 6)
const FORCED_RESULTS = [3, 6];

// ========== STATE ==========
let step = 0, sel = null, spins = 2, spinning = false, rot = 0, spinCount = 0;
const root = document.getElementById('root');

// ========== RENDER QUIZ STEP ==========
function render() {
  sel = null;
  const d = Q[step];
  const pct = Math.round(((step + 1) / Q.length) * 100);
  const pts = (step + 1) * 50;

  root.innerHTML = `<div class="slide-in">
    <div class="game-bar">
      <div class="step-counter">PERGUNTA <strong>${step + 1}</strong> DE ${Q.length}</div>
      <div class="xp-badge">${pct} %</div>
    </div>
    <div class="progress-track"><div class="progress-fill" id="pf"></div></div>
    <div class="quiz-card">
      <div class="banner">
        <img src="${d.banner}" alt="Banner Worten">
      </div>
      <div class="question-area">
        <p class="question-text">${d.q}</p>
      </div>
      <div class="options">
        ${d.o.map((o, i) => `<button class="opt" onclick="pick(this,${i})"><span>${o}</span></button>`).join('')}
      </div>
    </div>
    <div class="action-area">
      <button class="btn-next" id="nb" disabled onclick="next()">Próximo <span class="arrow">&rarr;</span></button>
    </div>
  </div>`;

  requestAnimationFrame(() => {
    document.getElementById('pf').style.width = pct + '%';
  });
}

// ========== SELECT OPTION ==========
function pick(el, i) {
  sel = i;
  document.querySelectorAll('.opt').forEach(b => b.classList.remove('sel'));
  el.classList.add('sel');
  document.getElementById('nb').disabled = false;
}

// ========== NEXT STEP ==========
function next() {
  if (sel === null) return;
  step++;
  if (step < Q.length) render();
  else showRoulette();
}

// ========== ROULETTE PAGE ==========
function showRoulette() {
  // Generate decorative light dots
  const numLights = 24;
  let lightsHTML = '';
  for (let i = 0; i < numLights; i++) {
    const angle = (i / numLights) * 360;
    const rad = angle * Math.PI / 180;
    const radius = 156;
    const x = Math.cos(rad) * radius;
    const y = Math.sin(rad) * radius;
    const colors = ['#fff', '#CC0033', '#fff', '#CC0033'];
    const color = colors[i % colors.length];
    lightsHTML += `<div class="light-dot" style="transform:translate(calc(-50% + ${x}px), calc(-50% + ${y}px));color:${color};background:${color};"></div>`;
  }

  root.innerHTML = `<div class="roulette-page slide-in">

    <svg class="rp-logo" viewBox="0 0 122 25" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="m17.113 13.843-7.015 10.732L.58 9.79a2.981 2.981 0 0 1 .883-4.111 2.951 2.951 0 0 1 4.092.885l4.548 7.087 4.52-7.074.02-.028c.043-.064.087-.122.126-.174l.058-.077a1.96 1.96 0 0 1 .107-.12l.046-.052.046-.05c.018-.018.038-.036.064-.059l.065-.06c.035-.032.065-.06.095-.084l.081-.06c.059-.045.11-.084.173-.125l.026-.017.05-.03c.055-.032.108-.065.165-.095l.065-.032.056-.026c.045-.021.09-.042.134-.06.046-.02.091-.035.152-.057.048-.016.08-.028.113-.037a2.961 2.961 0 0 1 2.097.148l.051.025c.085.038.166.083.244.134l.05.028.025.016c.065.043.115.08.178.128l.077.058c.037.03.07.06.11.097l.067.061.048.045.055.06.052.058c.038.04.068.073.094.106l.062.082c.045.06.083.111.126.175l.012.017 4.53 7.08 4.542-7.088a2.952 2.952 0 0 1 4.092-.885 2.982 2.982 0 0 1 .883 4.11l-9.517 14.787-7.031-10.733h.001Zm27.14-8.849c-5.678 0-10.297 4.453-10.297 9.926 0 5.475 4.62 9.93 10.297 9.93 5.678 0 10.297-4.455 10.297-9.93 0-5.473-4.619-9.926-10.297-9.926m0 14.807c-2.52 0-4.572-2.19-4.572-4.88s2.051-4.88 4.572-4.88c2.523 0 4.575 2.19 4.575 4.88s-2.052 4.88-4.575 4.88M56.24 12.28v12.166h5.967v-12.55c0-.51.376-1.319 1.386-1.319l1.907-.003 1.967-.003V5.394h-4.214c-3.387 0-7.013 2.767-7.013 6.885m21.404-1.675a2.617 2.617 0 0 0 2.613-2.61 2.61 2.61 0 0 0-2.613-2.6h-2.778l-.001-2.582a2.795 2.795 0 0 0-2.8-2.785 2.795 2.795 0 0 0-2.798 2.785v15.255l.009.407h.007c.24 3.921 3.477 5.97 6.606 5.97h4.213v-5.17l-.406-.006c-.191-.002-3.279-.007-3.466-.007-1.038 0-1.387-1.03-1.387-1.499v-7.155c.78-.003 1.778-.003 2.801-.003m41.98-2.056c-1.288-1.62-3.659-3.55-7.635-3.55-3.974 0-6.343 1.93-7.631 3.55-1.68 2.111-2.278 4.6-2.278 6.224v9.673h5.974v-9.477c0-2.164 1.352-4.358 3.934-4.363 2.588.005 3.942 2.199 3.942 4.363v9.477h5.972v-9.673c0-1.625-.598-4.113-2.277-6.224M90.617 4.994c-5.529 0-10.027 4.453-10.027 9.926 0 5.475 4.498 9.93 10.027 9.93 3.868 0 7.432-2.247 9.08-5.723l.278-.584H94.29l-.122.135c-.777.861-2.171 1.418-3.552 1.418-2.116 0-3.713-1.262-4.317-3.39h14.186l.052-.35c.07-.474.106-.957.106-1.436 0-5.473-4.498-9.926-10.027-9.926h.001Zm-4.165 7.517c.5-1.664 2.138-2.764 4.165-2.764 2.009 0 3.68 1.124 4.164 2.764h-8.329Z" fill="#CC0033" fill-rule="nonzero"/>
    </svg>

    <p class="promo-title">Passatempo Worten!</p>
    <p class="promo-sub">Gira a <strong>Roleta</strong> para ganhar o teu <strong>Mega Desconto</strong>!</p>

    <div class="roulette-stage">
      <div class="lights-ring lights-animated">${lightsHTML}</div>
      <div class="wheel-bg">
        <div class="wheel-pointer">
          <svg width="30" height="36" viewBox="0 0 30 36">
            <defs><filter id="ps"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/></filter></defs>
            <polygon points="15,36 0,0 30,0" fill="#1a1a1a" filter="url(#ps)"/>
            <polygon points="15,30 4,3 26,3" fill="#333"/>
          </svg>
        </div>
        <div class="wheel-clip">
          <canvas id="rc" width="600" height="600"></canvas>
        </div>
        <div class="wheel-center" onclick="spin()">
          <span class="c-text">GIRE</span>
          <span class="c-arrow">&#10148;</span>
        </div>
      </div>
    </div>

    <button class="btn-spin" id="sb" onclick="spin()">GIRE PARA GANHAR</button>

    <p class="spins-left" id="sl"></p>
  </div>`;

  drawWheel();
  startSocialProof();
}

// ========== DRAW ROULETTE ==========
function drawWheel() {
  const c = document.getElementById('rc');
  if (!c) return;
  const ctx = c.getContext('2d');
  const s = 600, cx = s / 2, cy = s / 2, r = s / 2 - 12;
  const n = SEG.length;
  const a = (2 * Math.PI) / n;

  ctx.clearRect(0, 0, s, s);

  // Draw segments
  SEG.forEach((sg, i) => {
    const sa = i * a - Math.PI / 2;
    const ea = sa + a;

    // Segment fill
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, sa, ea);
    ctx.closePath();
    ctx.fillStyle = sg.color;
    ctx.fill();

    // Subtle inner shadow per segment
    const grad = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.05)');
    grad.addColorStop(1, 'rgba(0,0,0,0.15)');
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, sa, ea);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Segment divider lines
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + r * Math.cos(sa), cy + r * Math.sin(sa));
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Text
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sa + a / 2);
    ctx.fillStyle = '#fff';

    if (sg.retry) {
      ctx.font = '900 30px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('\u21BB', r * 0.52, -10);
      ctx.font = '700 14px Inter, sans-serif';
      sg.sub.split('\n').forEach((l, li) => {
        ctx.fillText(l, r * 0.52, 10 + li * 17);
      });
    } else {
      // Big percentage
      ctx.font = '900 44px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
      ctx.fillText(sg.label, r * 0.52, 4);
      ctx.shadowColor = 'transparent';
      // Sub label
      ctx.font = '700 11px Inter, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(sg.sub, r * 0.52, 20);
    }
    ctx.restore();
  });

  // Outer ring highlight
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 3;
  ctx.stroke();
}

// ========== CALCULATE ANGLE FOR TARGET SEGMENT ==========
function getAngleForSegment(targetIdx) {
  const segAngle = 360 / SEG.length;
  // The pointer is at top (0deg = -90deg in canvas).
  // Segment i center is at i * segAngle.
  // We need to rotate so that segment targetIdx lands under pointer.
  // Add some randomness within the segment so it doesn't always land dead center.
  const jitter = (Math.random() - 0.5) * (segAngle * 0.6);
  const segCenter = targetIdx * segAngle + segAngle / 2;
  // We rotate clockwise; pointer is at top (360 - segCenter) to align
  const baseAngle = 360 - segCenter + jitter;
  return baseAngle;
}

// ========== SPIN ==========
function spin() {
  if (spinning || spins <= 0) return;
  spinning = true;
  spins--;

  const btn = document.getElementById('sb');
  btn.disabled = true;
  btn.textContent = 'A girar...';

  const label = document.getElementById('sl');
  label.textContent = '';

  // Determine forced result
  const forcedIdx = FORCED_RESULTS[spinCount];
  spinCount++;

  // Calculate target angle to land on forced segment
  const fullSpins = (6 + Math.floor(Math.random() * 3)) * 360;
  const landAngle = getAngleForSegment(forcedIdx);
  const target = rot + fullSpins + landAngle - (rot % 360);

  const canvas = document.getElementById('rc');
  canvas.style.transition = 'transform 5.5s cubic-bezier(0.12, 0.75, 0.1, 1)';
  canvas.style.transform = `rotate(${target}deg)`;
  rot = target;

  setTimeout(() => {
    spinning = false;
    const won = SEG[forcedIdx];

    if (won.retry) {
      // Show retry modal
      showRetryModal();
      label.innerHTML = `Não foi desta vez! <strong>${spins} tentativa</strong> restante`;
    } else {
      // Show win modal with confetti
      launchConfetti();
      showWinModal(won.label);
    }

    if (spins > 0) {
      btn.disabled = false;
      btn.textContent = 'TENTAR NOVAMENTE';
    } else {
      btn.disabled = true;
      btn.textContent = 'SEM MAIS TENTATIVAS';
    }
  }, 6000);
}

// ========== MODALS ==========
function showRetryModal() {
  const modal = document.getElementById('modal');
  const inner = modal.querySelector('.modal');
  inner.className = 'modal retry-modal';
  document.getElementById('mTitle').textContent = 'Poxa!';
  document.getElementById('mIcon').textContent = '😔';
  document.getElementById('mPrize').textContent = 'Não foi desta vez!';
  document.getElementById('mPrizeSub').textContent = 'Tenta novamente, ainda tens 1 tentativa!';
  document.getElementById('mBtn').textContent = 'Tentar novamente';
  modal.classList.add('open');
}

function showWinModal(prize) {
  const modal = document.getElementById('modal');
  const inner = modal.querySelector('.modal');
  inner.className = 'modal';
  document.getElementById('mTitle').textContent = 'Parabéns!';
  document.getElementById('mIcon').textContent = '🎉';
  document.getElementById('mPrize').textContent = prize + ' de desconto!';
  document.getElementById('mPrizeSub').textContent = 'Desconto aplicado automaticamente na tua compra!';
  document.getElementById('mBtn').textContent = 'Resgatar prémio';
  document.getElementById('mBtn').onclick = function() { window.location.href = 'loja.html'; };
  modal.classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
}

// ========== CONFETTI ==========
function launchConfetti() {
  const colors = ['#CC0033', '#FFD600', '#00BFA5', '#FF4444', '#fff', '#E53935'];
  for (let i = 0; i < 50; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.left = Math.random() * 100 + 'vw';
    el.style.top = '-10px';
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.width = (4 + Math.random() * 8) + 'px';
    el.style.height = (4 + Math.random() * 8) + 'px';
    el.style.animationDuration = (2 + Math.random() * 2) + 's';
    el.style.animationDelay = (Math.random() * 0.8) + 's';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }
}

// ========== SOCIAL PROOF TOAST ==========
const FAKE_NAMES = [
  'Maria', 'João', 'Ana', 'Pedro', 'Sofia', 'Miguel', 'Inês', 'Tiago',
  'Beatriz', 'Diogo', 'Catarina', 'Rafael', 'Mariana', 'André', 'Rita',
  'Bruno', 'Carolina', 'Luís', 'Francisca', 'Hugo'
];
const FAKE_PRIZES = ['75%', '50%', '90%', '25%', '95%', '50%', '75%'];

let toastInterval = null;
function startSocialProof() {
  showToast();
  toastInterval = setInterval(showToast, 8000);
}

function showToast() {
  const toast = document.getElementById('toast');
  if (!toast) return;
  const name = FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];
  const prize = FAKE_PRIZES[Math.floor(Math.random() * FAKE_PRIZES.length)];
  const initials = name.charAt(0);

  toast.querySelector('.toast-avatar').textContent = initials;
  toast.querySelector('.toast-text').innerHTML = `<strong>${name}</strong> acabou de ganhar <strong>${prize} de desconto</strong>!`;
  toast.classList.add('show');

  setTimeout(() => toast.classList.remove('show'), 4000);
}

// ========== INIT ==========
render();
