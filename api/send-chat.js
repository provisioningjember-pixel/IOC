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

    // 1. Ambil data tiket dari database
    const ticketRes = await db.execute({
      sql: `SELECT * FROM permintaan WHERE id_permintaan = ?`,
      args: [id_permintaan]
    });

    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tiket tidak ditemukan di database' });
    }

    const ticket = ticketRes.rows[0];

    // Ambil Chat ID Teknisi (sesuaikan nama kolom di DB jika beda: chat_id_teknisi / id_telegram_teknisi / chat_id)
    const chatIdTeknisi = ticket.chat_id_teknisi || ticket.id_telegram_teknisi || ticket.chat_id;

    // 2. Simpan pesan ke DB (tabel riwayat_chat)
    await db.execute({
      sql: `INSERT INTO riwayat_chat (id_permintaan, pengirim, id_telegram_hd, pesan) VALUES (?, 'HD', ?, ?)`,
      args: [id_permintaan, id_telegram_hd || null, pesan || '']
    });

    // 3. Kirimkan pesan balasan ke Bot Telegram Teknisi
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

    if (!BOT_TOKEN) {
      console.error("TELEGRAM_BOT_TOKEN belum diset di environment Variable Vercel!");
      return res.status(200).json({ success: true, warning: 'Pesan disimpan ke DB tapi TELEGRAM_BOT_TOKEN belum diset.' });
    }

    if (!chatIdTeknisi) {
      console.error(`Gagal kirim ke Telegram: chat_id_teknisi untuk id_permintaan ${id_permintaan} bernilai null/kosong.`);
      return res.status(200).json({ success: true, warning: 'Pesan tersimpan di DB, tapi chat_id teknisi tidak ditemukan.' });
    }

    const textTelegram = `💬 Balasan HD (Tiket #${ticket.tiket_id || id_permintaan}):\n\n${pesan}`;

    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatIdTeknisi,
        text: textTelegram
      })
    });

    const tgResult = await tgRes.json();

    if (!tgResult.ok) {
      console.error('Telegram API Error:', tgResult);
      return res.status(500).json({ 
        success: false, 
        error: `Telegram Error: ${tgResult.description}` 
      });
    }

    return res.status(200).json({ success: true, message: 'Pesan berhasil dikirim ke database & Telegram' });

  } catch (error) {
    console.error('Send chat error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
