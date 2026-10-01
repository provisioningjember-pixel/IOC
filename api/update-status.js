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
    const { id_permintaan, status_baru, id_telegram_hd, keterangan } = body;

    if (!id_permintaan || !status_baru) {
      return res.status(400).json({ success: false, error: 'id_permintaan dan status_baru wajib diisi' });
    }

    // 1. Ambil tiket_id induk terlebih dahulu agar semua pesan terkait ikut ter-update
    const ticketRes = await db.execute({
      sql: `SELECT tiket_id FROM permintaan WHERE id_permintaan = ? OR tiket_id = ? LIMIT 1`,
      args: [id_permintaan, id_permintaan]
    });

    const tiketIdInduk = ticketRes.rows[0]?.tiket_id || id_permintaan;
    const nowIso = new Date().toISOString();

    let query = '';
    let args = [];

    // 2. Tentukan query UPDATE berdasarkan status baru
    if (status_baru === 'taken' || status_baru === 'dikerjakan') {
      query = `UPDATE permintaan 
               SET status = ?, 
                   id_telegram_hd = COALESCE(id_telegram_hd, ?), 
                   keterangan = COALESCE(?, keterangan), 
                   timestamp_taken = COALESCE(timestamp_taken, ?) 
               WHERE id_permintaan = ? OR tiket_id = ?`;
      args = [
        status_baru, 
        id_telegram_hd || null, 
        keterangan || null, 
        nowIso, 
        id_permintaan, 
        tiketIdInduk
      ];
    } else if (status_baru === 'close' || status_baru === 'closed') {
      query = `UPDATE permintaan 
               SET status = ?, 
                   id_telegram_hd = COALESCE(id_telegram_hd, ?), 
                   keterangan = COALESCE(?, keterangan), 
                   timestamp_close = COALESCE(timestamp_close, ?) 
               WHERE id_permintaan = ? OR tiket_id = ?`;
      args = [
        status_baru, 
        id_telegram_hd || null, 
        keterangan || null, 
        nowIso, 
        id_permintaan, 
        tiketIdInduk
      ];
    } else {
      query = `UPDATE permintaan 
               SET status = ?, 
                   id_telegram_hd = COALESCE(id_telegram_hd, ?), 
                   keterangan = COALESCE(?, keterangan) 
               WHERE id_permintaan = ? OR tiket_id = ?`;
      args = [
        status_baru, 
        id_telegram_hd || null, 
        keterangan || null, 
        id_permintaan, 
        tiketIdInduk
      ];
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
