import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { id_permintaan } = req.query;

  if (!id_permintaan) {
    return res.status(400).json({ success: false, error: 'id_permintaan wajib diisi' });
  }

  try {
    const result = await db.execute({
      sql: `
        SELECT p.id_telegram_hd, u.nama 
        FROM permintaan p
        LEFT JOIN users_hd u ON p.id_telegram_hd = u.id_telegram
        WHERE p.id_permintaan = ? OR p.tiket_id = ?
        LIMIT 1
      `,
      args: [id_permintaan, id_permintaan]
    });

    const ticket = result.rows[0];

    return res.status(200).json({
      success: true,
      id_telegram_hd: ticket?.id_telegram_hd || null,
      nama_hd: ticket?.nama || null
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
