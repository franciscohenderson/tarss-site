/* Tars 2.0 · avisos (toasts) y estado «imprimiendo»
   Lo usan el formulario, el cotizador, el PDF y los cobros. */

/* Arriba al centro; la región es role="status" para que los lectores de
   pantalla lean el mensaje. textContent (nunca innerHTML): un error que venga
   del servidor no puede inyectar HTML. */
const TOAST_LIMIT = 3; // más de 3 avisos a la vez es ruido: se va el más viejo

function getToastRegion() {
  let region = document.querySelector(".toast-region");
  if (!region) {
    region = document.createElement("div");
    region.className = "toast-region";
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    document.body.appendChild(region);
    // Esc cierra el aviso más reciente.
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      const last = region.querySelector(".toast.is-visible:last-child");
      last?.dispatchEvent(new CustomEvent("toast:close"));
    });
  }
  return region;
}

/* showToast(mensaje, { type: "info" | "success" | "error", duration })
   duration: 0 = no se cierra solo (para «Enviando...»). Devuelve { hide }.
   - Los errores llevan role="alert": el lector de pantalla los anuncia ya.
   - Con el mouse encima, la cuenta regresiva se pausa (da tiempo a leer).
   - Botón de cerrar dibujado con CSS (dos barras), no con un glifo. */
export function showToast(message, { type = "info", duration = 4000 } = {}) {
  const region = getToastRegion();
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  if (type === "error") toast.setAttribute("role", "alert");

  const icon = document.createElement("span");
  icon.className = "toast-icon";
  icon.setAttribute("aria-hidden", "true");
  const text = document.createElement("span");
  text.className = "toast-text";
  text.textContent = message;
  const close = document.createElement("button");
  close.type = "button";
  close.className = "toast-close";
  close.setAttribute("aria-label", "Cerrar aviso");
  toast.append(icon, text, close);

  // Límite: si ya hay TOAST_LIMIT, se cierra el más viejo.
  const visible = region.querySelectorAll(".toast");
  if (visible.length >= TOAST_LIMIT) visible[0].dispatchEvent(new CustomEvent("toast:close"));

  region.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("is-visible"));

  let hideTimer = 0;
  let remaining = duration;
  let startedAt = 0;
  const hide = () => {
    clearTimeout(hideTimer);
    toast.classList.remove("is-visible");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 600); // respaldo si no hay transición
  };
  const startTimer = () => {
    if (remaining <= 0) return;
    startedAt = performance.now();
    hideTimer = setTimeout(hide, remaining);
  };
  toast.addEventListener("pointerenter", () => {
    if (duration <= 0) return;
    clearTimeout(hideTimer);
    remaining -= performance.now() - startedAt;
  });
  toast.addEventListener("pointerleave", startTimer);
  toast.addEventListener("toast:close", hide);
  close.addEventListener("click", hide);
  startTimer();
  return { hide };
}

/* Estado «imprimiendo» para acciones que esperan algo (en vez de un spinner):
   el botón se deshabilita, avisa aria-busy y una franja de tinta lo recorre
   como un rodillo. El texto cambia para que se sepa qué está pasando. */
export function setBusy(button, busy, busyLabel) {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.textContent;
    if (busyLabel) button.textContent = busyLabel;
    button.classList.add("is-busy");
    button.setAttribute("aria-busy", "true");
    if (button.tagName === "BUTTON") button.disabled = true;
    else button.setAttribute("aria-disabled", "true");
  } else {
    if (button.dataset.label) button.textContent = button.dataset.label;
    button.classList.remove("is-busy");
    button.removeAttribute("aria-busy");
    if (button.tagName === "BUTTON") button.disabled = false;
    else button.removeAttribute("aria-disabled");
  }
}

