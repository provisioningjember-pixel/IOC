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
    // Pada Vercel/Node.js, kirimkan balasan ke database dan trigger Telegram Bot
    const { id_permintaan, id_telegram_hd, pesan } = req.body;

    // 1. Dapatkan info chat_id teknisi dari tabel permintaan
    const ticketRes = await db.execute({
      sql: `SELECT chat_id_teknisi, tiket_id FROM permintaan WHERE id_permintaan = ?`,
      args: [id_permintaan]
    });

    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tiket tidak ditemukan' });
    }

    const ticket = ticketRes.rows[0];

    // 2. Simpan pesan ke DB (Misal tabel riwayat_chat)
    await db.execute({
      sql: `INSERT INTO riwayat_chat (id_permintaan, pengirim, id_telegram_hd, pesan) VALUES (?, 'HD', ?, ?)`,
      args: [id_permintaan, id_telegram_hd, pesan || '']
    });

    // 3. Kirimkan pesan balasan ke Bot Telegram Teknisi via Telegram Bot API
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (BOT_TOKEN && ticket.chat_id_teknisi) {
      const textTelegram = `💬 *Balasan HD (Tiket #${ticket.tiket_id || id_permintaan})*:\n\n${pesan}`;
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ticket.chat_id_teknisi,
          text: textTelegram,
          parse_mode: 'Markdown'
        })
      });
    }

    return res.status(200).json({ success: true, message: 'Pesan berhasil dikirim' });
  } catch (error) {
    console.error('Send chat error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
