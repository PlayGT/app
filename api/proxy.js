// api/proxy.js
// Proxy de streaming para Vercel: agrega headers custom en el servidor
// y reescribe las URLs relativas dentro del m3u8 para que también pasen por el proxy.

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) {
    res.status(400).send('Falta el parámetro url');
    return;
  }

  const target = decodeURIComponent(url);

  // Headers que exige el origen del stream
  const headers = {
    'User-Agent': 'Magma Player/10',
    'X-App': 'ps',
    'X-Version': '10/1.0.9',
    'X-Hash': '15xiRIZWJA1Zdy9eze-sT3gTpC5WMXM-iIrpnzu4f6wr0s-pefLycIn-u-jMKSfGdaerrUF-qEqC9Yyh7PmuLMKQLJeazQc6a90UXHSVKTWTmg25220Iy3gX-uGvoyIR7rOUwVN7vicq59gzvqEeNHpTn_6GTk1XXe9TyOFXHNfoRGEyPYKtZSbysNTl07HPwOh9XLM9P5GzVpP-zEy0jolaee3yut_au2QwpZFjYX8s1ajIuasMAbMIEZSn9Zf2pcLeicLSYquKrOj1aC7wj0FQLKtp469gV3xmzmO4pEt1pFITIgBITQ9n6dCsWsjar7nAKsp6nQJNuCjuzmW78cIx-2jIlmm52RbaosTdIlrHLR6Khlyv1VWVZqkbBssSeAl_nrOzEpPIqZTtjbbWNkC0MPm3kIJBXOmGNbAWLLWghWRK1nvhglvRjzD_mN30mKvelZz4H158V8zKmfn9Yf45Qh6-JI-Rmg8F28iyTL8w4OxVxMyTtd1T-wqyeEnud3Wqa5_fp0GsKNwjZFUHr-nCpE96Gca94HKghCNIs6V4H__DvdIDPI-1fZXqbi2xhe2aXVTNBd547BfEMtaxJVHAUKsWEPpgXq5Ozq6AwBs',
    'X-Did': '0fc0e59075491624',
  };

  try {
    const upstream = await fetch(target, { headers });

    if (!upstream.ok) {
      res.status(upstream.status).send(`Error upstream: ${upstream.status}`);
      return;
    }

    const contentType = upstream.headers.get('content-type') || '';
    res.setHeader('Access-Control-Allow-Origin', '*');

    const isPlaylist =
      target.toLowerCase().endsWith('.m3u8') ||
      contentType.includes('mpegurl') ||
      contentType.includes('vnd.apple');

    if (isPlaylist) {
      const text = await upstream.text();
      const base = target.substring(0, target.lastIndexOf('/') + 1);
      const proxyBase = `https://${req.headers.host}/api/proxy?url=`;

      const rewritten = text
        .split('\n')
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return line;

          // Reescribe líneas de metadata que traen URI="..." (ej. #EXT-X-KEY, #EXT-X-MAP)
          if (trimmed.startsWith('#')) {
            const uriMatch = trimmed.match(/URI="([^"]+)"/);
            if (uriMatch) {
              const abs = uriMatch[1].startsWith('http') ? uriMatch[1] : base + uriMatch[1];
              return trimmed.replace(uriMatch[1], proxyBase + encodeURIComponent(abs));
            }
            return line;
          }

          // Líneas normales: URI de segmento o sub-playlist
          const absolute = trimmed.startsWith('http') ? trimmed : base + trimmed;
          return proxyBase + encodeURIComponent(absolute);
        })
        .join('\n');

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.status(200).send(rewritten);
    } else {
      // Segmentos .ts / .m4s / claves, etc.
      res.setHeader('Content-Type', contentType || 'video/mp2t');
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.status(200).send(buffer);
    }
  } catch (err) {
    res.status(500).send('Error de proxy: ' + err.message);
  }
}
