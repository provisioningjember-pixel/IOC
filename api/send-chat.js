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
    const { id_permintaan, id_telegram_hd, pesan, image_base64, hd_nama } = body;

    if (!id_permintaan) {
      return res.status(400).json({ success: false, error: 'id_permintaan wajib diisi' });
    }

    // 1. Ambil data tiket utama daripada Turso
    const ticketRes = await db.execute({
      sql: `SELECT chat_id, id_telegram_teknisi, tiket_id, thread_id, message_id, segmen 
            FROM permintaan 
            WHERE id_permintaan = ? OR tiket_id = ? 
            LIMIT 1`,
      args: [id_permintaan, id_permintaan]
    });

    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tiket tidak ditemukan di database' });
    }

    const ticket = ticketRes.rows[0];
    const targetChatId = ticket.chat_id || ticket.id_telegram_teknisi;
    const parentMessageId = ticket.message_id; // ID mesej Telegram yang dibalas
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

    let savedFileId = null;
    let sentMessageId = null;

    const namaPengirim = hd_nama || 'HD';
    const textWithHeader = `💬 *Balasan HD (${namaPengirim}):*\n\n${pesan || ''}`;

    // 2. Jika ada penghantaran gambar Base64
    if (image_base64 && BOT_TOKEN && targetChatId) {
      try {
        const base64Data = image_base64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        const formData = new FormData();
        formData.append('chat_id', targetChatId);
        formData.append('photo', new Blob([buffer], { type: 'image/jpeg' }), 'photo.jpg');
        
        if (parentMessageId) formData.append('reply_to_message_id', parentMessageId);
        if (ticket.thread_id) formData.append('message_thread_id', ticket.thread_id);
        if (pesan) formData.append('caption', textWithHeader);
        formData.append('parse_mode', 'Markdown');

        const tgPhotoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
          method: 'POST',
          body: formData
        });

        const tgPhotoResult = await tgPhotoRes.json();
        if (tgPhotoResult.ok) {
          sentMessageId = tgPhotoResult.result?.message_id;
          const photos = tgPhotoResult.result?.photo;
          if (photos && photos.length > 0) {
            savedFileId = photos[photos.length - 1].file_id; // Simpan file_id resolusi tertinggi
          }
        }
      } catch (imgErr) {
        console.error('Gagal kirim foto ke Telegram:', imgErr);
      }
    } 
    // 3. Jika hanya mesej teks sahaja
    else if (BOT_TOKEN && targetChatId && pesan) {
      const payload = {
        chat_id: targetChatId,
        text: textWithHeader,
        parse_mode: 'Markdown',
        reply_to_message_id: parentMessageId || undefined
      };
      if (ticket.thread_id) payload.message_thread_id = ticket.thread_id;

      const tgTextRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const tgTextResult = await tgTextRes.json();
      if (tgTextResult.ok) {
        sentMessageId = tgTextResult.result?.message_id;
      }
    }

    // 4. Simpan Rekod Balasan ke Database (Menyesuaikan dengan kolom yang wujud)
    await db.execute({
      sql: `INSERT INTO permintaan (
              tiket_id, 
              msg_type, 
              sender_type, 
              chat_id, 
              thread_id, 
              message_id, 
              reply_to_message_id, 
              segmen, 
              id_telegram_hd, 
              pesan, 
              file_id, 
              status, 
              timestamp_created
            ) VALUES (?, 'BALASAN', 'HD', ?, ?, ?, ?, ?, ?, ?, ?, 'dikerjakan', CURRENT_TIMESTAMP)`,
      args: [
        ticket.tiket_id || id_permintaan,
        targetChatId || null,
        ticket.thread_id || null,
        sentMessageId || null,
        parentMessageId || null,
        ticket.segmen || null,
        id_telegram_hd || null,
        pesan || '',
        savedFileId || null
      ]
    });

    // 5. Kemas kini status Tiket Utama kepada 'dikerjakan' & atur timestamp_taken
    await db.execute({
      sql: `UPDATE permintaan 
            SET status = 'dikerjakan', 
                id_telegram_hd = ?, 
                timestamp_taken = COALESCE(timestamp_taken, CURRENT_TIMESTAMP)
            WHERE (id_permintaan = ? OR tiket_id = ?) 
              AND (msg_type = 'UTAMA' OR msg_type IS NULL)`,
      args: [id_telegram_hd || null, id_permintaan, ticket.tiket_id || id_permintaan]
    });

    return res.status(200).json({ success: true, message: 'Balasan berhasil dikirim & disimpan' });

  } catch (error) {
    console.error('Send chat error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
