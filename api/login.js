import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  // Tambahkan Header CORS jika diperlukan
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { nik, password } = req.body;

    if (!nik || !password) {
      return res.status(400).json({ success: false, error: 'NIK dan Password wajib diisi' });
    }

    // Query cek user di database
    const result = await db.execute({
      sql: 'SELECT * FROM users_hd WHERE nik = ? AND password = ?',
      args: [nik, password]
    });

    if (result.rows.length > 0) {
      const user = result.rows[0];
      return res.status(200).json({
        success: true,
        user: {
          nik: user.nik,
          nama: user.nama,
          segmen: user.segmen,
          id_telegram: user.id_telegram
        }
      });
    } else {
      return res.status(401).json({ success: false, error: 'NIK atau Password salah' });
    }
  } catch (error) {
    console.error('Error saat login:', error);
    return res.status(500).json({ success: false, error: 'Terjadi kesalahan pada server: ' + error.message });
  }
}
