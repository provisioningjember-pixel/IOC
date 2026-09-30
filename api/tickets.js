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
    const { segmen = 'B2C', status = 'open' } = req.query;

    const result = await db.execute({
      sql: `SELECT 
              id_permintaan,
              tiket_id,
              msg_type,
              sender_type,
              chat_id,
              thread_id,
              message_id,
              reply_to_message_id,
              media_group_id,
              segmen,
              kategori_pekerjaan,
              pesan,
              file_id,
              id_telegram_teknisi,
              nama_teknisi,
              username_teknisi,
              id_telegram_hd,
              status,
              keterangan,
              timestamp_created,
              timestamp_taken,
              timestamp_close
            FROM permintaan 
            WHERE segmen = ? AND status = ? 
            ORDER BY timestamp_created DESC`,
      args: [segmen, status]
    });

    return res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Fetch tickets error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
