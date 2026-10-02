import { test } from 'node:test';
import assert from 'node:assert/strict';
import PostalMime from 'postal-mime';
import worker, { armarRelevo } from '../src/index.js';

const env = { DESTINO: 'destino@gmail.com', REMITENTE: 'contacto@tars.com.ar' };
const crudo = [
  'From: Ana Pérez <ana@gmail.com>',
  'To: contacto@tars.com.ar',
  'Subject: Quiero una landing',
  'Message-ID: <abc@mail.gmail.com>',
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'Hola, ¿cuánto sale?',
].join('\r\n');

function mensaje(raw, extra = {}) {
  const enviados = { forward: [] };
  return {
    enviados,
    from: 'ana@gmail.com',
    to: 'contacto@tars.com.ar',
    headers: new Headers(extra.headers || {}),
    raw: new Response(raw).body,
    forward: async (to) => { enviados.forward.push(to); },
  };
}

test('arma un mail nuevo desde tars.com.ar con Reply-To al cliente', async () => {
  const mail = await PostalMime.parse(crudo);
  const r = armarRelevo(mail, { from: 'ana@gmail.com', to: 'contacto@tars.com.ar' }, env);
  assert.deepEqual(r.from, { email: 'contacto@tars.com.ar', name: 'Ana Pérez vía Tars' });
  assert.equal(r.to, 'destino@gmail.com');
  assert.equal(r.replyTo, 'ana@gmail.com');
  assert.equal(r.subject, 'Quiero una landing');
  assert.match(r.text, /Hola, ¿cuánto sale\?/);
  assert.match(r.text, /Escrito por Ana Pérez <ana@gmail.com> a contacto@tars.com.ar/);
});

test('envía con la binding y no reenvía', async () => {
  const sent = [];
  const m = mensaje(crudo);
  await worker.email(m, { ...env, EMAIL: { send: async (x) => { sent.push(x); return { messageId: '1' }; } } });
  assert.equal(sent.length, 1);
  assert.deepEqual(m.enviados.forward, []);
});

test('si el envío falla, reenvía el original (no se pierde)', async () => {
  const m = mensaje(crudo);
  await worker.email(m, { ...env, EMAIL: { send: async () => { throw new Error('E_SENDER_NOT_VERIFIED'); } } });
  assert.deepEqual(m.enviados.forward, ['destino@gmail.com']);
});

test('no vuelve a armar un mail que ya pasó por el relevo', async () => {
  const m = mensaje(crudo, { headers: { 'X-Tars-Relevo': 'contacto' } });
  let sent = 0;
  await worker.email(m, { ...env, EMAIL: { send: async () => { sent++; } } });
  assert.equal(sent, 0);
  assert.deepEqual(m.enviados.forward, ['destino@gmail.com']);
});
