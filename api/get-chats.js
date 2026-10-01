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
    const { id_permintaan } = req.query;

    if (!id_permintaan) {
      return res.status(400).json({ success: false, error: 'id_permintaan wajib diisi' });
    }

    // 1. Ambil tiket_id induk
    const ticketRes = await db.execute({
      sql: `SELECT tiket_id FROM permintaan WHERE id_permintaan = ? OR tiket_id = ? LIMIT 1`,
      args: [id_permintaan, id_permintaan]
    });

    const tiketId = ticketRes.rows[0]?.tiket_id || id_permintaan;

    // 2. Ambil semua pesan
    const result = await db.execute({
      sql: `SELECT * FROM permintaan 
            WHERE tiket_id = ? OR id_permintaan = ?`,
      args: [tiketId, tiketId]
    });

    // 3. SORTING DI JAVASCRIPT (Jauh lebih akurat mengonversi berbagai format Date/Timestamp)
    const sortedMessages = result.rows.sort((a, b) => {
      const timeA = new Date(a.timestamp_created || 0).getTime();
      const timeB = new Date(b.timestamp_created || 0).getTime();
      return timeA - timeB; // Dari paling lama (atas) ke paling baru (bawah)
    });

    return res.status(200).json({
      success: true,
      messages: sortedMessages
    });
  } catch (error) {
    console.error('Get chat error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
