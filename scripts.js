document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

const navToggle = document.querySelector('.nav-toggle');
const navBar = navToggle?.closest('.topbar');
const navLinks = document.querySelectorAll('.nav-links a');

if (navToggle) {
  navToggle.setAttribute('aria-expanded', 'false');

  navToggle.addEventListener('click', () => {
    const isOpen = navBar?.classList.toggle('nav-open');
    navToggle.setAttribute('aria-expanded', String(!!isOpen));
  });
}

navLinks.forEach((link) => {
  link.addEventListener('click', () => {
    if (navBar?.classList.contains('nav-open')) {
      navBar.classList.remove('nav-open');
      navToggle?.setAttribute('aria-expanded', 'false');
    }
  });
});

const revealTargets = document.querySelectorAll('section, .card, .case-card, .cta-box, .hero h1, .hero-text, .hero-actions, label');
revealTargets.forEach((el) => el.classList.add('reveal'));

if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal-active');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.18 });

  revealTargets.forEach((el) => revealObserver.observe(el));
} else {
  revealTargets.forEach((el) => el.classList.add('reveal-active'));
}

const topbar = document.querySelector('.topbar');
const topbarScrollThreshold = 28;
const contactForm = document.querySelector('#contact-form');
const contactStatus = document.querySelector('#contact-status');

if (topbar) {
  window.addEventListener('scroll', () => {
    if (window.scrollY > topbarScrollThreshold) {
      topbar.classList.add('scrolled');
    } else {
      topbar.classList.remove('scrolled');
    }
  });
}

if (contactForm && contactStatus) {
  const submitButton = contactForm.querySelector('button[type="submit"]');

  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitButton) submitButton.disabled = true;
    contactStatus.textContent = 'Enviando mensaje...';

    const formData = new FormData(contactForm);
    try {
      const response = await fetch(contactForm.action, {
        method: 'POST',
        body: formData,
        headers: {
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        contactStatus.textContent = 'Gracias. Tu mensaje fue enviado correctamente. Te redirijo a la página de confirmación...';
        contactForm.reset();
        setTimeout(() => {
          window.location.href = 'https://tarss-site.pages.dev/gracias';
        }, 1200);
      } else {
        const data = await response.json();
        contactStatus.textContent = data?.error || 'Hubo un problema. Intenta de nuevo.';
        if (submitButton) submitButton.disabled = false;
      }
    } catch (error) {
      contactStatus.textContent = 'Error al enviar. Verifica tu conexión o intenta más tarde.';
      if (submitButton) submitButton.disabled = false;
    }
  });
}

