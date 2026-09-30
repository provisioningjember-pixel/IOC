import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tiket_id, status, kategori_pekerjaan, nama_hd, nik_hd } = req.body;

    if (!tiket_id) {
      return res.status(400).json({ error: 'tiket_id wajib diisi' });
    }

    const currentTimestamp = new Date().toISOString();

    if (status === 'PROGRESS') {
      await db.execute({
        sql: `UPDATE permintaan 
              SET status = ?, 
                  timestamp_taken = COALESCE(timestamp_taken, ?), 
                  kategori_pekerjaan = COALESCE(NULLIF(?, ''), kategori_pekerjaan),
                  nama_hd = ?
              WHERE tiket_id = ? AND msg_type = 'UTAMA'`,
        args: [status, currentTimestamp, kategori_pekerjaan || '', nama_hd || null, tiket_id]
      });
    } else if (status === 'CLOSED') {
      await db.execute({
        sql: `UPDATE permintaan 
              SET status = 'CLOSED', 
                  timestamp_close = ?, 
                  kategori_pekerjaan = ? 
              WHERE tiket_id = ? AND msg_type = 'UTAMA'`,
        args: [currentTimestamp, kategori_pekerjaan, tiket_id]
      });
    } else {
      await db.execute({
        sql: `UPDATE permintaan 
              SET kategori_pekerjaan = ? 
              WHERE tiket_id = ? AND msg_type = 'UTAMA'`,
        args: [kategori_pekerjaan, tiket_id]
      });
    }

    return res.status(200).json({ success: true, message: 'Status berhasil diperbarui' });
  } catch (err) {
    console.error('Error update-status:', err);
    return res.status(500).json({ error: err.message });
  }
}
