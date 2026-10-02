/* ==========================================================================
   Tars · relevo de contacto@tars.com.ar a Gmail
   --------------------------------------------------------------------------
   Por qué existe: con el reenvío directo de Email Routing, Cloudflare marca
   los mails como «Reenviado» pero Gmail descarta en silencio los que salieron
   de otra cuenta de Gmail (probado el 2026-10-02: dos pruebas, ninguna llegó;
   sin filtros, bloqueos ni reenvíos del lado de Gmail).

   Qué hace: en vez de reenviar el mensaje original, lo lee y le manda a Gmail
   un mail NUEVO, enviado y firmado por tars.com.ar, con el mismo asunto, el
   texto, el HTML y los adjuntos. «Responder» va al remitente original
   (Reply-To), así que para Francisco es igual que un mail normal.

   Si armar o enviar el mail nuevo falla por cualquier motivo, se cae al
   reenvío directo de siempre: nunca se pierde un mensaje por culpa de esto.
   ========================================================================== */
import PostalMime from 'postal-mime';

const MAX_ADJUNTOS = 4 * 1024 * 1024; // el envío acepta hasta 5 MiB en total

export function armarRelevo(mail, sobre, env) {
  const direccion = mail.from?.address || sobre.from;
  const nombre = (mail.from?.name || direccion).replace(/["<>]/g, '').trim();
  const pie = `\n\n— Escrito por ${nombre} <${direccion}> a ${sobre.to} · llegó por tars.com.ar`;
  const adjuntos = (mail.attachments || []).filter((a) => a.content);
  const pesoAdjuntos = adjuntos.reduce((total, a) => total + (a.content.byteLength || 0), 0);

  return {
    from: { email: env.REMITENTE, name: `${nombre} vía Tars`.slice(0, 70) },
    to: env.DESTINO,
    replyTo: direccion,
    subject: mail.subject || '(sin asunto)',
    text: (mail.text || '(mensaje sin texto)') + pie,
    ...(mail.html ? { html: `${mail.html}<p style="color:#666;font-size:12px">${pie.trim().replace(/</g, '&lt;')}</p>` } : {}),
    ...(adjuntos.length && pesoAdjuntos <= MAX_ADJUNTOS
      ? {
          attachments: adjuntos.map((a) => ({
            content: a.content,
            filename: a.filename || 'adjunto',
            type: a.mimeType || 'application/octet-stream',
            disposition: a.disposition === 'inline' ? 'inline' : 'attachment',
            ...(a.contentId ? { contentId: a.contentId.replace(/[<>]/g, '') } : {}),
          })),
        }
      : {}),
    headers: { 'X-Tars-Relevo': 'contacto' },
  };
}

export default {
  async email(message, env) {
    // Un mail que ya pasó por acá (o que mandamos nosotros) no se vuelve a armar.
    if (message.headers.get('X-Tars-Relevo') || message.from === env.REMITENTE) {
      await message.forward(env.DESTINO);
      return;
    }
    try {
      const raw = await new Response(message.raw).arrayBuffer();
      const mail = await PostalMime.parse(raw);
      await env.EMAIL.send(armarRelevo(mail, { from: message.from, to: message.to }, env));
    } catch (error) {
      console.error('Relevo falló, se reenvía el original:', error?.message || error);
      await message.forward(env.DESTINO);
    }
  },
};
