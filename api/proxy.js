export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).send("Falta el parámetro url");
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        "User-Agent": "Magma Player/10",
        "X-App": "ps",
        "X-Version": "10/1.0.9",
        "X-Did": "0fc0e59075491624",
        "X-Hash": "BaAkbp2gMkm6RUDNszvcxepmW-wC8E9yZv1hSNRc7NRZirMyZUFDCSF_6bTaRbl0THEG2Z1kNJOkP2ro9-i_DYN2-8czZp_pciAsOMtDrlFQ5gaEq3LwrrvdXrgzz26uJBou2hgLMMJAJ8k68dVbwzF-I2GzNMjoFFnJS1ZsKjFW8l9AVGL0udSfqXQbm4AYdJAy4zKNhEXpWL1jIHoQ_lM7bVu-PHUkJ_ubphLXlPn_cz54ai-ORRe5K0ij8PFiCael6prFvJmAMPyXytWclzO49-BIMNcL5o7TUHEytq0sFnEBCi5PwiO-wZGaP73bHhbTqeKXFXsV9dcXLqjkNPnqNoI1aY9Y7bW4xbBi8afEyyW_fdOnLZ_HM4w1voWzm4FcirjXthE_AKDPccx4FtsIK0CM_sO5dXXNZZKBFA7wYYOmONyEo9evzRUTLNJTGNUBAWJFBz01fQuV1uKJR-1waxXX3eXIJNJNIxTETsM3hy4ujm9UvRr5oTtud3WWQYP5fLkj3Rny02_f2LYf67PY1tBoJv46En8vNEMiDv8FxH5hWR6o27VVb886zfv4GXnG4lwxHcjCujqjHMcQqRszf8dqsAX4a79EHc0vHAE"
      }
    });

    // Copiar headers importantes
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/vnd.apple.mpegurl');

    const buffer = await response.arrayBuffer();
    res.status(response.status).send(Buffer.from(buffer));

  } catch (error) {
    console.error(error);
    res.status(502).send("Error al conectar con el stream");
  }
}
