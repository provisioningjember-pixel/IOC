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
    const { segmen = 'B2C', status = 'open', id_telegram_hd = '' } = req.query;

    let query = '';
    let args = [];

    // 1. TAB OPEN: Filter segmen HD, tampilkan semua tiket yang statusnya open/pesan open
    if (status === 'open') {
      query = `
        SELECT * FROM permintaan 
        WHERE LOWER(segmen) = LOWER(?) 
          AND LOWER(status) IN ('open', 'pesan open')
        ORDER BY timestamp_created DESC
      `;
      args = [segmen];

    // 2. TAB DIKERJAKAN: Filter segmen HD, status dikerjakan, DAN id_telegram_hd sesuai HD yang login
    } else if (status === 'taken' || status === 'dikerjakan') {
      query = `
        SELECT * FROM permintaan 
        WHERE LOWER(segmen) = LOWER(?) 
          AND LOWER(status) IN ('taken', 'dikerjakan', 'proses')
          AND id_telegram_hd = ?
        ORDER BY timestamp_taken DESC
      `;
      args = [segmen, id_telegram_hd];

    // 3. TAB CLOSED: Filter segmen HD, status close, DAN id_telegram_hd sesuai HD yang login
    } else if (status === 'close' || status === 'closed') {
      query = `
        SELECT * FROM permintaan 
        WHERE LOWER(segmen) = LOWER(?) 
          AND LOWER(status) IN ('close', 'closed', 'selesai')
          AND id_telegram_hd = ?
        ORDER BY timestamp_close DESC
      `;
      args = [segmen, id_telegram_hd];
    } else {
      return res.status(400).json({ success: false, error: 'Status filter tidak valid' });
    }

    const result = await db.execute({ sql: query, args });

    return res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Fetch tickets error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
