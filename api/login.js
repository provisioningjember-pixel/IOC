import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const { nik, password } = req.body;

    if (!nik || !password) {
      return res.status(400).json({ success: false, error: 'NIK dan Password wajib diisi' });
    }

    const result = await db.execute({
      sql: 'SELECT id, nik, nama, username, segmen, status, id_telegram FROM users_hd WHERE nik = ? AND password = ?',
      args: [nik, password]
    });

    if (result.rows.length > 0) {
      const user = result.rows[0];
      return res.status(200).json({
        success: true,
        user: {
          id: user.id,
          nik: user.nik,
          nama: user.nama,
          username: user.username,
          segmen: user.segmen,
          status: user.status,
          id_telegram: user.id_telegram
        }
      });
    } else {
      return res.status(401).json({ success: false, error: 'NIK atau Password tidak ditemukan / salah' });
    }
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, error: 'Terjadi kesalahan pada server: ' + error.message });
  }
}
