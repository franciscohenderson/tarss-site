/* ==========================================================================
   Tars · documentos PDF (presupuesto y remito)
   --------------------------------------------------------------------------
   Dos partes:
   - documentModel(): PURA. Arma qué dice el documento (título, renglones,
     totales, notas). Se prueba en Node sin navegador.
   - renderDocument(jsPDF, model): dibuja el modelo con jsPDF (riso: banda
     rosa con el azul corrido abajo, como una impresión desregistrada).
   - downloadDocument(): carga jsPDF SOLO al pedir un PDF (419 KB que nadie
     baja si no lo usa) y dispara la descarga.
   jsPDF usa las fuentes estándar (Helvetica): cubren el español (á, ñ, ¿)
   pero no todo Unicode, por eso los textos evitan guiones largos y viñetas.
   ========================================================================== */

import { priceLabel, formatUSD } from './quote.js';

const BUSINESS = {
  name: 'TARS',
  tagline: 'Imprenta digital · Mendoza',
  whatsapp: '+54 9 261 240-8064',
  email: 'contacto@tars.com.ar',
  web: 'tars.com.ar',
};

const TYPES = {
  presupuesto: { title: 'PRESUPUESTO', prefix: 'P', file: 'presupuesto' },
  remito: { title: 'REMITO', prefix: 'R', file: 'remito' },
};

/* Referencia legible y única para el documento: P-20261001-7K3Q. No es una
   numeración fiscal; sirve para identificar el documento en la conversación. */
export function createReference(type, date = new Date(), random = randomCode) {
  const { prefix } = TYPES[type] ?? TYPES.presupuesto;
  const ymd = [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((n) => String(n).padStart(2, '0')).join('');
  return `${prefix}-${ymd}-${random()}`;
}

function randomCode() {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin 0/O ni 1/I
  const bytes = new Uint8Array(4);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

const formatDate = (date) => date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

/* Modelo del documento (PURO): todo lo que se va a imprimir, ya resuelto. */
export function documentModel(type, quote, { date = new Date(), reference } = {}) {
  if (!TYPES[type]) throw new Error(`Tipo de documento desconocido: ${type}`);
  if (!quote || quote.isEmpty) throw new Error('El documento necesita al menos un servicio.');
  const meta = TYPES[type];
  const ref = reference ?? createReference(type, date);

  const base = {
    type,
    title: meta.title,
    reference: ref,
    date: formatDate(date),
    filename: `${meta.file}-tars-${ref}.pdf`,
    business: BUSINESS,
  };

  if (type === 'presupuesto') {
    return {
      ...base,
      columns: ['Servicio', 'Modalidad', 'Importe'],
      rows: quote.items.map((item) => [item.name, item.billing === 'monthly' ? 'Mensual' : 'Pago único', priceLabel(item)]),
      totals: [
        ['Pago único', formatUSD(quote.oneTime)],
        ['Por mes', `${formatUSD(quote.monthly)}/mes`],
      ],
      notes: [
        'Importes en dólares estadounidenses (USD). Presupuesto estimado: la propuesta',
        'final se confirma por WhatsApp o email antes de empezar.',
      ],
      signature: null,
    };
  }

  // Remito: qué se entrega, sin importes, con firma de conformidad.
  return {
    ...base,
    columns: ['Cant.', 'Descripción', 'Modalidad'],
    rows: quote.items.map((item) => ['1', item.name, item.billing === 'monthly' ? 'Mensual' : 'Única vez']),
    totals: [['Ítems entregados', String(quote.count)]],
    notes: ['Documento no válido como factura.'],
    signature: ['Recibí conforme (firma)', 'Aclaración', 'Fecha'],
  };
}

/* --- Dibujo --------------------------------------------------------------- */
const INK = [20, 20, 20];
const PINK = [255, 72, 176];
const BLUE = [0, 120, 191];
const YELLOW = [255, 232, 0];
const MUTED = [74, 69, 61];

export function renderDocument(JsPDF, model) {
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 18; // margen
  doc.setProperties({ title: `${model.title} ${model.reference}`, author: 'Tars', subject: model.title });

  // Banda superior: azul corrido 3mm debajo del rosa (desregistro riso).
  doc.setFillColor(...BLUE);
  doc.rect(3, 3, W, 44, 'F');
  doc.setFillColor(...PINK);
  doc.rect(0, 0, W, 44, 'F');

  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(34);
  doc.text(model.business.name, M, 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(model.business.tagline, M, 32);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(model.title, W - M, 22, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Ref. ${model.reference}`, W - M, 30, { align: 'right' });
  doc.text(`Fecha ${model.date}`, W - M, 36, { align: 'right' });

  // Tabla
  // x de cada columna (la última alineada a la derecha). En el remito la
  // primera es «Cant.», angosta: la descripción va pegada.
  const cols = [M, M + (model.type === 'remito' ? 20 : 92), W - M];
  let y = 66;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(model.columns[0].toUpperCase(), cols[0], y);
  doc.text(model.columns[1].toUpperCase(), cols[1], y);
  doc.text(model.columns[2].toUpperCase(), cols[2], y, { align: 'right' });
  y += 3;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.6);
  doc.line(M, y, W - M, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  model.rows.forEach((row) => {
    y += 9;
    doc.text(row[0], cols[0], y);
    doc.text(row[1], cols[1], y);
    doc.text(row[2], cols[2], y, { align: 'right' });
    doc.setLineDashPattern([1, 1], 0);
    doc.setLineWidth(0.2);
    doc.line(M, y + 3.5, W - M, y + 3.5);
    doc.setLineDashPattern([], 0);
  });

  // Totales sobre amarillo (tinta encima, como el ticket del sitio)
  y += 14;
  const boxH = 8 + model.totals.length * 8;
  doc.setFillColor(...YELLOW);
  doc.rect(W - M - 82, y, 82, boxH, 'F');
  doc.setTextColor(...INK);
  model.totals.forEach(([label, value], i) => {
    const ty = y + 9 + i * 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(label.toUpperCase(), W - M - 78, ty);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(value, W - M - 4, ty, { align: 'right' });
  });
  y += boxH + 16;

  // Firma (remito)
  if (model.signature) {
    const slot = (W - 2 * M - 16) / 3;
    model.signature.forEach((label, i) => {
      const x = M + i * (slot + 8);
      doc.setLineWidth(0.4);
      doc.line(x, y + 14, x + slot, y + 14);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(label, x, y + 19);
    });
    y += 30;
  }

  // Notas
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  model.notes.forEach((line, i) => doc.text(line, M, y + i * 5));

  // Pie con los datos de contacto
  const H = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.6);
  doc.line(M, H - 22, W - M, H - 22);
  doc.setTextColor(...INK);
  doc.setFontSize(9);
  doc.text(`WhatsApp ${model.business.whatsapp}   ·   ${model.business.email}   ·   ${model.business.web}`, M, H - 15);

  return doc;
}

/* --- Carga diferida de jsPDF y descarga ----------------------------------- */
let jsPDFPromise = null;

export function loadJsPDF() {
  if (globalThis.jspdf?.jsPDF) return Promise.resolve(globalThis.jspdf.jsPDF);
  if (!jsPDFPromise) {
    jsPDFPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      // Ruta relativa a ESTE módulo (sirve también en la 404, que usa rutas absolutas).
      script.src = new URL('../../vendor/jspdf/jspdf.umd.min.js', import.meta.url).href;
      script.async = true;
      script.onload = () => (globalThis.jspdf?.jsPDF ? resolve(globalThis.jspdf.jsPDF) : reject(new Error('jsPDF no se inicializó')));
      script.onerror = () => { jsPDFPromise = null; reject(new Error('No se pudo descargar jsPDF')); };
      document.head.appendChild(script);
    });
  }
  return jsPDFPromise;
}

export async function downloadDocument(type, quote, options) {
  const model = documentModel(type, quote, options);
  const JsPDF = await loadJsPDF();
  renderDocument(JsPDF, model).save(model.filename);
  return model;
}
