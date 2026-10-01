import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { id_permintaan, id_telegram_hd, pesan, image_base64 } = body;

    if (!id_permintaan) {
      return res.status(400).json({ success: false, error: 'id_permintaan wajib diisi' });
    }

    // 1. Ambil data tiket & Telegram ID Teknisi
    const ticketRes = await db.execute({
      sql: `SELECT chat_id, id_telegram_teknisi, tiket_id, thread_id FROM permintaan WHERE id_permintaan = ?`,
      args: [id_permintaan]
    });

    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tiket tidak ditemukan di database' });
    }

    const ticket = ticketRes.rows[0];
    const targetChatId = ticket.chat_id || ticket.id_telegram_teknisi;
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

    let savedFileId = null;

    // 2. Jika ada kiriman gambar Base64, kirim foto ke Telegram via sendPhoto API
    if (image_base64 && BOT_TOKEN && targetChatId) {
      try {
        // Konversi Base64 ke Blob/Buffer
        const base64Data = image_base64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        const formData = new FormData();
        formData.append('chat_id', targetChatId);
        formData.append('photo', new Blob([buffer], { type: 'image/jpeg' }), 'photo.jpg');
        
        if (pesan) formData.append('caption', `💬 *Balasan HD (Tiket #${ticket.tiket_id || id_permintaan})*:\n\n${pesan}`);
        if (ticket.thread_id) formData.append('message_thread_id', ticket.thread_id);

        const tgPhotoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
          method: 'POST',
          body: formData
        });

        const tgPhotoResult = await tgPhotoRes.json();
        if (tgPhotoResult.ok && tgPhotoResult.result?.photo) {
          // Ambil file_id gambar resolusi tertinggi
          const photos = tgPhotoResult.result.photo;
          savedFileId = photos[photos.length - 1].file_id;
        }
      } catch (imgErr) {
        console.error('Gagal kirim foto ke Telegram:', imgErr);
      }
    } 
    // 3. Jika hanya teks tanpa gambar
    else if (BOT_TOKEN && targetChatId && pesan) {
      const textTelegram = `💬 *Balasan HD (Tiket #${ticket.tiket_id || id_permintaan})*:\n\n${pesan}`;
      const payload = {
        chat_id: targetChatId,
        text: textTelegram,
        parse_mode: 'Markdown'
      };
      if (ticket.thread_id) payload.message_thread_id = ticket.thread_id;

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    // 4. Simpan record balasan HD ke tabel permintaan DB Turso
    await db.execute({
      sql: `INSERT INTO permintaan (tiket_id, sender_type, chat_id, id_telegram_hd, pesan, file_id, status) 
            VALUES (?, 'HD', ?, ?, ?, ?, 'dikerjakan')`,
      args: [
        ticket.tiket_id || id_permintaan, 
        targetChatId || null, 
        id_telegram_hd || null, 
        pesan || '',
        savedFileId || null
      ]
    });

    return res.status(200).json({ success: true, message: 'Pesan/Gambar berhasil dikirim ke DB & Telegram' });

  } catch (error) {
    console.error('Send chat error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
