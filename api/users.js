import { db } from "./db.js";
import { crypto } from "crypto";

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // 1. GET ALL USERS (READ)
    if (req.method === "GET") {
      const result = await db.execute(
        "SELECT id, nik, nama, username, segmen, status, id_telegram, created_at FROM users_hd ORDER BY created_at DESC"
      );
      return res.status(200).json({ success: true, data: result.rows });
    }

    // 2. CREATE USER (POST)
    if (req.method === "POST") {
      const { nik, nama, username, password, segmen, status, id_telegram } = req.body;

      if (!nik || !nama || !username || !password || !segmen) {
        return res.status(400).json({ success: false, message: "Field wajib harus diisi!" });
      }

      const id = "usr_" + Date.now() + Math.random().toString(36).substring(2, 7);

      await db.execute({
        sql: `INSERT INTO users_hd (id, nik, nama, username, password, segmen, status, id_telegram) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          nik,
          nama,
          username,
          password,
          segmen,
          status || "ACTIVE",
          id_telegram || null,
        ],
      });

      return res.status(201).json({ success: true, message: "User berhasil ditambahkan" });
    }

    // 3. UPDATE USER (PUT)
    if (req.method === "PUT") {
      const { id, nik, nama, username, password, segmen, status, id_telegram } = req.body;

      if (!id) {
        return res.status(400).json({ success: false, message: "ID User wajib disertakan" });
      }

      let sql = `UPDATE users_hd SET nik = ?, nama = ?, username = ?, segmen = ?, status = ?, id_telegram = ?`;
      let args = [nik, nama, username, segmen, status, id_telegram || null];

      // Update password jika diisi
      if (password && password.trim() !== "") {
        sql += `, password = ?`;
        args.push(password);
      }

      sql += ` WHERE id = ?`;
      args.push(id);

      await db.execute({ sql, args });

      return res.status(200).json({ success: true, message: "User berhasil diperbarui" });
    }

    // 4. DELETE USER (DELETE)
    if (req.method === "DELETE") {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ success: false, message: "ID User wajib disertakan" });
      }

      await db.execute({
        sql: "DELETE FROM users_hd WHERE id = ?",
        args: [id],
      });

      return res.status(200).json({ success: true, message: "User berhasil dihapus" });
    }

    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  } catch (error) {
    console.error("API Error:", error);
    
    // Tangkap error jika NIK sudah terpakai
    if (error.message && error.message.includes("UNIQUE constraint failed: users_hd.nik")) {
      return res.status(400).json({
        success: false,
        message: "NIK sudah terdaftar! Silakan gunakan NIK yang lain.",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Terjadi kesalahan server",
    });
  }
}
