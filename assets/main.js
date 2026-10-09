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
