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
    const { id_permintaan, id_telegram_hd, pesan } = body;

    if (!id_permintaan) {
      return res.status(400).json({ success: false, error: 'id_permintaan wajib diisi' });
    }

    // 1. Ambil data tiket & Telegram ID Teknisi dari tabel permintaan
    const ticketRes = await db.execute({
      sql: `SELECT chat_id, id_telegram_teknisi, tiket_id, thread_id FROM permintaan WHERE id_permintaan = ?`,
      args: [id_permintaan]
    });

    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tiket tidak ditemukan di database' });
    }

    const ticket = ticketRes.rows[0];

    // Prioritas chat_id (ID Telegram ruang percakapan/teknisi)
    const targetChatId = ticket.chat_id || ticket.id_telegram_teknisi;

    // 2. Simpan pesan balasan HD ke tabel permintaan sebagai record pesan baru
    // atau jika kamu punya tabel khusus riwayat_chat, sesuaikan query-nya.
    await db.execute({
      sql: `INSERT INTO permintaan (tiket_id, sender_type, chat_id, id_telegram_hd, pesan, status) 
            VALUES (?, 'HD', ?, ?, ?, 'dikerjakan')`,
      args: [
        ticket.tiket_id || id_permintaan, 
        targetChatId, 
        id_telegram_hd || null, 
        pesan || ''
      ]
    });

    // 3. Kirimkan pesan balasan ke Bot Telegram Teknisi
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

    if (!BOT_TOKEN) {
      return res.status(200).json({ 
        success: true, 
        warning: 'Pesan tersimpan di DB, tetapi TELEGRAM_BOT_TOKEN di Environment Variable belum diset.' 
      });
    }

    if (!targetChatId) {
      return res.status(200).json({ 
        success: true, 
        warning: 'Pesan tersimpan di DB, tetapi chat_id / id_telegram_teknisi tidak ditemukan.' 
      });
    }

    const textTelegram = `💬 *Balasan HD (Tiket #${ticket.tiket_id || id_permintaan})*:\n\n${pesan}`;

    const payload = {
      chat_id: targetChatId,
      text: textTelegram,
      parse_mode: 'Markdown'
    };

    // Jika pesan Telegram menggunakan Forum Topic / Thread
    if (ticket.thread_id) {
      payload.message_thread_id = ticket.thread_id;
    }

    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const tgResult = await tgRes.json();

    if (!tgResult.ok) {
      console.error('Telegram Bot Error Log:', tgResult);
      // Fallback kirim tanpa Parse Mode jika pesan mengandung karakter khusus Markdown yang error
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChatId,
          text: `💬 Balasan HD (Tiket #${ticket.tiket_id || id_permintaan}):\n\n${pesan}`
        })
      });
    }

    return res.status(200).json({ success: true, message: 'Pesan berhasil dikirim ke DB & Telegram' });

  } catch (error) {
    console.error('Send chat error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
