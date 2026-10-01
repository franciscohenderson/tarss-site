/* Tars 2.0 · easter egg de la 404
   Se carga solo si existe .runaway-button. */

import { prefersReducedMotion } from '../lib/env.js';

/* --- 9. Easter egg de la 404 -----------------------------------------------
   Con MOUSE, «Volver al inicio» se escapa 4 veces y después se deja
   clickear. Con dedo o teclado funciona normal (un botón que se mueve al
   tocarlo sería imposible de usar). Con «reducir movimiento», no se mueve. */
export function initRunawayButton() {
  const button = document.querySelector('.runaway-button');
  if (!button) return;

  const area = button.closest('.page-hero') || document.body;
  const message = document.querySelector('.runaway-message');
  const MAX_ESCAPES = 4;
  const MIN_DISTANCE = 160;
  const EDGE = 16;
  const taunts = [
    'Uy, casi 😏',
    '¿Seguro que querés volver? 🙃',
    'Un intento más...',
    'Bueno, está bien, me rindo. Hacé clic 😅',
  ];
  let escapes = 0;
  let offsetX = 0;
  let offsetY = 0;

  button.style.transition = 'transform 450ms cubic-bezier(0.34, 1.56, 0.64, 1)';

  button.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse' || escapes >= MAX_ESCAPES || prefersReducedMotion) return;

    const areaRect = area.getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    const baseLeft = rect.left - offsetX;
    const baseTop = rect.top - offsetY;
    const minX = areaRect.left + EDGE - baseLeft;
    const maxX = areaRect.right - EDGE - rect.width - baseLeft;
    const minY = areaRect.top + EDGE - baseTop;
    const maxY = areaRect.bottom - EDGE - rect.height - baseTop;

    // Varios lugares al azar: el primero lejos del cursor (o el más lejano).
    let best = { x: offsetX, y: offsetY, distance: -1 };
    for (let i = 0; i < 20; i += 1) {
      const x = minX + Math.random() * Math.max(0, maxX - minX);
      const y = minY + Math.random() * Math.max(0, maxY - minY);
      const distance = Math.hypot(baseLeft + x + rect.width / 2 - event.clientX, baseTop + y + rect.height / 2 - event.clientY);
      if (distance > best.distance) best = { x, y, distance };
      if (distance >= MIN_DISTANCE) break;
    }

    offsetX = best.x;
    offsetY = best.y;
    button.style.transform = `translate(${offsetX}px, ${offsetY}px) rotate(${(Math.random() * 8 - 4).toFixed(1)}deg)`;
    if (message) message.textContent = taunts[escapes] || '';
    escapes += 1;
  });

  // Si cambia la ventana, los límites cambian: vuelve a su lugar.
  window.addEventListener('resize', () => {
    offsetX = 0;
    offsetY = 0;
    button.style.transform = '';
  });
}
