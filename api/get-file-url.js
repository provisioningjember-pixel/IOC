export default async function handler(req, res) {
  const { file_id } = req.query;
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

  if (!file_id || !BOT_TOKEN) {
    return res.status(400).send('Parameter file_id dan BOT_TOKEN diperlukan');
  }

  try {
    // 1. Minta file_path dari Telegram API
    const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${file_id}`);
    const fileData = await fileRes.json();

    if (!fileData.ok || !fileData.result.file_path) {
      return res.status(404).send('Gambar tidak ditemukan di Telegram');
    }

    const filePath = fileData.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;

    // 2. Fetch binary gambar dan stream langsung ke browser
    const imgRes = await fetch(downloadUrl);
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    const buffer = await imgRes.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache 1 hari
    return res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('Get file error:', err);
    return res.status(500).send('Gagal memuat gambar');
  }
}
