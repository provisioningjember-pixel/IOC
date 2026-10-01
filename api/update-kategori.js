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
    const { id_permintaan, kategori_pekerjaan } = req.body;

    if (!id_permintaan) {
      return res.status(400).json({ success: false, error: 'id_permintaan wajib diisi' });
    }

    await db.execute({
      sql: `UPDATE permintaan SET kategori_pekerjaan = ? WHERE id_permintaan = ?`,
      args: [kategori_pekerjaan || null, id_permintaan]
    });

    return res.status(200).json({
      success: true,
      message: 'Kategori pekerjaan berhasil diperbarui'
    });
  } catch (error) {
    console.error('Update kategori error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
