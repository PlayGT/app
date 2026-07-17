// api/extract.js
// Uso: GET /api/extract?url=https://streamwish.com/e/xxxxx&host=streamwish
// host puede ser: streamwish | vidhide | filelions (todos usan el mismo empaquetador)

export default async function handler(req, res) {
  // CORS abierto para que tu app/reproductor pueda llamarlo
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url, host } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Falta el parámetro ?url=' });
  }

  try {
    const embedUrl = decodeURIComponent(url);
    const origin = new URL(embedUrl).origin;

    const response = await fetch(embedUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Referer: origin + '/',
        Origin: origin,
      },
    });

    if (!response.ok) {
      return res.status(502).json({ error: 'No se pudo obtener el embed', status: response.status });
    }

    const html = await response.text();

    const sources = extractSources(html);

    if (!sources.length) {
      return res.status(404).json({ error: 'No se encontró ningún m3u8/mp4 en el embed' });
    }

    return res.status(200).json({
      host: host || 'unknown',
      embed: embedUrl,
      sources, // [{file, type}]
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno', detail: err.message });
  }
}

// ---------- Helpers ----------

function extractSources(html) {
  const results = [];

  // 1) Caso directo: sources: [{file:"...m3u8"}] ya visible en el HTML
  const directRegex = /(https?:\/\/[^"'\s]+\.(?:m3u8|mp4)[^"'\s]*)/gi;
  let m;
  while ((m = directRegex.exec(html)) !== null) {
    results.push({ file: m[1], type: m[1].includes('.m3u8') ? 'hls' : 'mp4' });
  }
  if (results.length) return dedupe(results);

  // 2) Caso empaquetado (Dean Edwards packer): eval(function(p,a,c,k,e,d){...}(...))
  const packedRegex = /eval\(function\(p,a,c,k,e,[dr]\)\{.*?\}\((.*?)\)\)/s;
  const packedMatch = html.match(packedRegex);
  if (packedMatch) {
    try {
      const unpacked = unpack(packedMatch[0]);
      let m2;
      while ((m2 = directRegex.exec(unpacked)) !== null) {
        results.push({ file: m2[1], type: m2[1].includes('.m3u8') ? 'hls' : 'mp4' });
      }
    } catch (e) {
      // sigue sin resultados
    }
  }

  return dedupe(results);
}

function dedupe(arr) {
  const seen = new Set();
  return arr.filter((s) => {
    if (seen.has(s.file)) return false;
    seen.add(s.file);
    return true;
  });
}

// Implementación del unpacker de Dean Edwards (usado por StreamWish/VidHide/FileLions)
function unpack(source) {
  function baseN(num, b) {
    return num.toString(b);
  }

  const argsMatch = source.match(
    /\}\('(.*)',\s*(\d+|\[\]),\s*(\d+),\s*'(.*)'\.split\('\|'\)/s
  );
  if (!argsMatch) throw new Error('No se pudo parsear el packer');

  let [, payload, radixRaw, countRaw, keysStr] = argsMatch;
  const radix = radixRaw === '[]' ? 62 : parseInt(radixRaw, 10);
  const count = parseInt(countRaw, 10);
  const keys = keysStr.split('|');

  const decode = (c) => {
    return (
      (c < radix ? '' : decode(Math.floor(c / radix))) +
      ((c = c % radix) > 35 ? String.fromCharCode(c + 29) : baseN(c, 36))
    );
  };

  const dict = {};
  for (let i = 0; i < count; i++) {
    const key = decode(i);
    dict[key] = keys[i] || key;
  }

  const result = payload.replace(/\b\w+\b/g, (word) => dict[word] || word);
  return result;
}
