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
    // Ambil id_tiket (kode unik tiket) atau id_permintaan (ID integer DB)
    const { id_tiket, id_permintaan, kategori_pekerjaan, kategori } = req.body;
    
    const targetTiket = id_tiket || id_permintaan;
    const nilaiKategori = kategori_pekerjaan !== undefined ? kategori_pekerjaan : kategori;

    if (!targetTiket) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID tiket atau ID permintaan wajib diisi' 
      });
    }

    // Eksekusi Update ke Turso berdasarkan id_tiket atau id_permintaan
    const result = await db.execute({
      sql: `UPDATE permintaan 
            SET kategori_pekerjaan = ? 
            WHERE id_tiket = ? OR id_permintaan = ?`,
      args: [nilaiKategori || null, targetTiket, targetTiket]
    });

    if (result.rowsAffected === 0) {
      return res.status(404).json({
        success: false,
        error: 'Data tiket tidak ditemukan di database'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Kategori pekerjaan berhasil diperbarui'
    });
  } catch (error) {
    console.error('Update kategori error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
