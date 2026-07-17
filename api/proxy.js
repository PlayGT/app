// api/proxy.js
// Uso: /api/proxy?url=https://host.com/video.m3u8&ref=https://streamwish.com/
// Reescribe las rutas .ts dentro del m3u8 para que también pasen por este proxy.

export default async function handler(req, res) {
  const { url, ref } = req.query;
  if (!url) return res.status(400).send('Falta ?url=');

  const target = decodeURIComponent(url);
  const referer = ref ? decodeURIComponent(ref) : new URL(target).origin + '/';

  const upstream = await fetch(target, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Referer: referer,
      Origin: new URL(referer).origin,
    },
  });

  if (!upstream.ok) {
    return res.status(upstream.status).send('Error al obtener el recurso');
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  const isM3u8 = target.includes('.m3u8');

  if (isM3u8) {
    let text = await upstream.text();
    const base = target.substring(0, target.lastIndexOf('/') + 1);

    // Reescribe cada línea que sea una URL relativa o absoluta de segmento/subplaylist
    text = text
      .split('\n')
      .map((line) => {
        if (line.startsWith('#') || line.trim() === '') return line;
        const absolute = line.startsWith('http') ? line : base + line;
        return `/api/proxy?url=${encodeURIComponent(absolute)}&ref=${encodeURIComponent(referer)}`;
      })
      .join('\n');

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    return res.status(200).send(text);
  }

  // Segmentos .ts u otros binarios: stream directo
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'video/mp2t');
  const buffer = Buffer.from(await upstream.arrayBuffer());
  return res.status(200).send(buffer);
}
