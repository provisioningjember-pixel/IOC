import { createClient } from '@libsql/client';
import formidable from 'formidable';
import fs from 'fs';

// Matikan bodyParser bawaan Next.js / Vercel Serverless agar Formidable bisa membaca file/image
export const config = {
  api: {
    bodyParser: false,
  },
};

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // Parse FormData (File + Fields)
    const form = formidable({ multiples: false });
    
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    // Mengambil nilai field (formidable mengembalikan string/array tergantung versi)
    const id_permintaan = Array.isArray(fields.id_permintaan) ? fields.id_permintaan[0] : fields.id_permintaan;
    const id_telegram_hd = Array.isArray(fields.id_telegram_hd) ? fields.id_telegram_hd[0] : fields.id_telegram_hd;
    const pesan = Array.isArray(fields.pesan) ? fields.pesan[0] : (fields.pesan || '');

    if (!id_permintaan) {
      return res.status(400).json({ success: false, error: 'id_permintaan wajib diisi' });
    }

    // 1. Dapatkan info chat_id teknisi dari tabel permintaan
    const ticketRes = await db.execute({
      sql: `SELECT chat_id_teknisi, tiket_id FROM permintaan WHERE id_permintaan = ?`,
      args: [id_permintaan]
    });

    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tiket tidak ditemukan' });
    }

    const ticket = ticketRes.rows[0];

    // 2. Simpan pesan ke DB (tabel riwayat_chat / percakapan)
    await db.execute({
      sql: `INSERT INTO riwayat_chat (id_permintaan, pengirim, id_telegram_hd, pesan) VALUES (?, 'HD', ?, ?)`,
      args: [id_permintaan, id_telegram_hd || null, pesan]
    });

    // 3. Kirimkan pesan balasan ke Bot Telegram Teknisi
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (BOT_TOKEN && ticket.chat_id_teknisi) {
      const textTelegram = `💬 *Balasan HD (Tiket #${ticket.tiket_id || id_permintaan})*:\n\n${pesan}`;

      // Jika ada lampiran gambar
      const imageFile = files.gambar ? (Array.isArray(files.gambar) ? files.gambar[0] : files.gambar) : null;

      if (imageFile) {
        // Kirim Photo via Telegram API (sendPhoto)
        const formDataTG = new FormData();
        formDataTG.append('chat_id', ticket.chat_id_teknisi);
        formDataTG.append('caption', textTelegram);
        formDataTG.append('parse_mode', 'Markdown');

        const fileBuffer = fs.readFileSync(imageFile.filepath);
        const blob = new Blob([fileBuffer], { type: imageFile.mimetype });
        formDataTG.append('photo', blob, imageFile.originalFilename || 'image.jpg');

        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
          method: 'POST',
          body: formDataTG
        });
      } else {
        // Kirim Teks Biasa via Telegram API (sendMessage)
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
    }

    return res.status(200).json({ success: true, message: 'Pesan berhasil dikirim' });
  } catch (error) {
    console.error('Send chat error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
