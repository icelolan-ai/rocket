// Tabs
document.querySelectorAll('.tabs .pill').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.tabs .pill').forEach(x => x.classList.toggle('active', x === b));
}));
// Reveal on scroll
const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add('in')), { threshold: .15 });
document.querySelectorAll('.screen').forEach(s => io.observe(s));

// Form (front-end only)
const form = document.getElementById('form');
form.addEventListener('submit', e => {
  e.preventDefault();
  const s = form.querySelector('.status');
  if (!form.name.value.trim() || !form.email.validity.valid || !form.email.value) {
    s.textContent = 'Please enter your name and a valid e-mail.';
    return;
  }
  s.textContent = 'Thank you — message received.';
  form.reset();
});

// Rocket parts: select, recolor, disassemble (placeholder for the future 3D model)
const PARTS = { nose:'Nose cone', payload:'Payload bay', tank1:'Fuel tank A', tank2:'Fuel tank B', fins:'Stabilizer fins', engine:'Main engine' };
const COLORS = ['#6f7075','#e6f23a','#e2674a','#3b82c4','#2f9e6b','#f2f2ee','#16171a'];
const stage = document.getElementById('stage');
const partsList = document.getElementById('parts');
const swatches = document.getElementById('swatches');
const partEls = Object.fromEntries(Object.keys(PARTS).map(k => [k, stage.querySelector(`.part[data-part="${k}"]`)]));
let selected = 'nose';

function select(k) {
  selected = k;
  Object.entries(partEls).forEach(([id, el]) => el.classList.toggle('sel', id === k));
  partsList.querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.part === k));
  const cur = partEls[k].style.getPropertyValue('--c') || COLORS[0];
  swatches.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.c === cur));
}
function paint(k, c) { partEls[k].style.setProperty('--c', c); partsList.querySelector(`[data-part="${k}"] .dot2`).style.setProperty('--c', c); }

Object.entries(PARTS).forEach(([k, name]) => {
  const li = document.createElement('li');
  li.innerHTML = `<button data-part="${k}"><span class="dot2" style="--c:${COLORS[0]}"></span>${name}</button>`;
  li.firstChild.addEventListener('click', () => select(k));
  partsList.append(li);
  partEls[k].addEventListener('click', () => select(k));
});
COLORS.forEach(c => {
  const b = document.createElement('button');
  b.dataset.c = c; b.style.setProperty('--sw', c); b.setAttribute('aria-label', 'Color ' + c);
  b.addEventListener('click', () => { paint(selected, c); select(selected); });
  swatches.append(b);
});
const explode = document.getElementById('explode');
explode.addEventListener('click', () => {
  const on = stage.classList.toggle('exploded');
  explode.textContent = on ? 'Assemble' : 'Disassemble';
  explode.setAttribute('aria-pressed', on);
});
document.getElementById('reset').addEventListener('click', () => { Object.keys(PARTS).forEach(k => paint(k, COLORS[0])); select(selected); });
Object.keys(PARTS).forEach(k => paint(k, COLORS[0]));
select(selected);
