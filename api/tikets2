import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { 
      segmen = 'B2C', 
      status = 'open', 
      id_telegram_hd = '',
      start_date,
      end_date
    } = req.query;

    let query = '';
    let args = [];

    // Kondisi Wajib: Hanya ambil yang bertipe UTAMA (bukan BALASAN)
    const filterPesanUtama = `AND (UPPER(msg_type) = 'UTAMA' OR msg_type IS NULL)`;

    // 1. TAB OPEN: Filter segmen HD, tampilkan semua tiket utama yang statusnya open
    if (status === 'open') {
      query = `
        SELECT * FROM permintaan 
        WHERE LOWER(segmen) = LOWER(?) 
          AND LOWER(status) IN ('open', 'pesan open')
          ${filterPesanUtama}
        ORDER BY timestamp_created DESC
      `;
      args = [segmen];

    // 2. TAB DIKERJAKAN: Filter segmen HD, status dikerjakan, DAN id_telegram_hd sesuai HD
    } else if (status === 'taken' || status === 'dikerjakan') {
      query = `
        SELECT * FROM permintaan 
        WHERE LOWER(segmen) = LOWER(?) 
          AND LOWER(status) IN ('taken', 'dikerjakan', 'proses')
          AND id_telegram_hd = ?
          ${filterPesanUtama}
        ORDER BY timestamp_taken DESC
      `;
      args = [segmen, id_telegram_hd];

    // 3. TAB CLOSED: Filter segmen HD, status close, id_telegram_hd sesuai HD, DAN range tanggal
    } else if (status === 'close' || status === 'closed') {
      // Default ke tanggal hari ini jika parameter tanggal tidak dikirim dari frontend
      const today = new Date().toISOString().split('T')[0];
      const startDate = start_date || today;
      const endDate = end_date || today;

      // Menggunakan SUBSTR(..., 1, 10) untuk memotong string 'YYYY-MM-DD' dari ISO timestamp
      query = `
        SELECT * FROM permintaan 
        WHERE LOWER(segmen) = LOWER(?) 
          AND LOWER(status) IN ('close', 'closed', 'selesai')
          AND id_telegram_hd = ?
          AND SUBSTR(COALESCE(timestamp_close, timestamp_created), 1, 10) BETWEEN ? AND ?
          ${filterPesanUtama}
        ORDER BY timestamp_created DESC
      `;
      args = [segmen, id_telegram_hd, startDate, endDate];

    } else {
      return res.status(400).json({ success: false, error: 'Status filter tidak valid' });
    }

    const result = await db.execute({ sql: query, args });

    // HITUNG BADGE COUNTER (Menggunakan COUNT(DISTINCT tiket_id) & Filter Pesan Utama)
    const countOpenRes = await db.execute({
      sql: `
        SELECT COUNT(DISTINCT tiket_id) as total 
        FROM permintaan 
        WHERE LOWER(segmen) = LOWER(?) 
          AND LOWER(status) IN ('open', 'pesan open')
          ${filterPesanUtama}
      `,
      args: [segmen]
    });

    const countTakenRes = await db.execute({
      sql: `
        SELECT COUNT(DISTINCT tiket_id) as total 
        FROM permintaan 
        WHERE LOWER(segmen) = LOWER(?) 
          AND LOWER(status) IN ('taken', 'dikerjakan', 'proses') 
          AND id_telegram_hd = ?
          ${filterPesanUtama}
      `,
      args: [segmen, id_telegram_hd]
    });

    return res.status(200).json({
      success: true,
      data: result.rows,
      counts: {
        open: countOpenRes.rows[0]?.total || 0,
        taken: countTakenRes.rows[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('Fetch tickets error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
