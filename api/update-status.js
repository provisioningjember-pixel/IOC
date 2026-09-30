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
    const { id_permintaan, status_baru, id_telegram_hd, keterangan } = req.body;

    if (!id_permintaan || !status_baru) {
      return res.status(400).json({ success: false, error: 'id_permintaan dan status_baru wajib diisi' });
    }

    let query = '';
    let args = [];

    if (status_baru === 'taken' || status_baru === 'dikerjakan') {
      query = `UPDATE permintaan 
               SET status = ?, id_telegram_hd = ?, keterangan = ?, timestamp_taken = CURRENT_TIMESTAMP 
               WHERE id_permintaan = ?`;
      args = [status_baru, id_telegram_hd || null, keterangan || null, id_permintaan];
    } else if (status_baru === 'close' || status_baru === 'closed') {
      query = `UPDATE permintaan 
               SET status = ?, id_telegram_hd = ?, keterangan = ?, timestamp_close = CURRENT_TIMESTAMP 
               WHERE id_permintaan = ?`;
      args = [status_baru, id_telegram_hd || null, keterangan || null, id_permintaan];
    } else {
      query = `UPDATE permintaan 
               SET status = ?, id_telegram_hd = ?, keterangan = ? 
               WHERE id_permintaan = ?`;
      args = [status_baru, id_telegram_hd || null, keterangan || null, id_permintaan];
    }

    await db.execute({ sql: query, args });

    return res.status(200).json({
      success: true,
      message: `Status tiket berhasil diubah ke ${status_baru}`
    });
  } catch (error) {
    console.error('Update status error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
