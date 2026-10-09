import { initLangButtons, t } from '../rocket3d/i18n.js';
initLangButtons();

// Reveal on scroll
const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add('in')), { threshold: .12 });
document.querySelectorAll('.reveal').forEach(s => io.observe(s));

// Solid nav once scrolled
const nav = document.getElementById('nav');
const onScroll = () => nav.classList.toggle('solid', scrollY > 40);
addEventListener('scroll', onScroll, { passive: true }); onScroll();

// Mobile menu
const menuBtn = document.getElementById('menu-btn'), links = document.getElementById('nav-links');
menuBtn.addEventListener('click', () => {
  const open = links.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', open);
});
links.addEventListener('click', e => { if (e.target.closest('a')) { links.classList.remove('open'); menuBtn.setAttribute('aria-expanded', false); } });

// Form (front-end only)
const form = document.getElementById('form');
form.addEventListener('submit', e => {
  e.preventDefault();
  const s = form.querySelector('.status');
  if (!form.name.value.trim() || !form.email.value || !form.email.validity.valid) {
    s.textContent = t('ct.err');
    return;
  }
  s.textContent = t('ct.ok');
  form.reset();
});
