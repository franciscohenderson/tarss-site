/* Tars 2.0 · entorno y utilidades compartidas
   Constantes, preferencias del sistema y el resorte que usan varios módulos. */

export const WHATSAPP_NUMBER = '5492617459362';
export const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function formatUSD(amount) {
  return `USD ${amount.toLocaleString('es-AR')}`;
}

/* Resorte amortiguado «a mano»: cada cuadro acerca `value` a `target` con una
   fuerza proporcional a la distancia (stiffness) y frena con la velocidad
   (damping). Con damping < 2·√stiffness rebota un poco antes de asentarse. */
export function createSpring({ stiffness = 170, damping = 18 } = {}) {
  return { value: 0, velocity: 0, target: 0, stiffness, damping };
}

export function stepSpring(spring, dt) {
  const force = (spring.target - spring.value) * spring.stiffness;
  spring.velocity += (force - spring.velocity * spring.damping) * dt;
  spring.value += spring.velocity * dt;
  return Math.abs(spring.velocity) > 0.01 || Math.abs(spring.target - spring.value) > 0.01;
}
