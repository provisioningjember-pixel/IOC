import { createClient } from '@libsql/client';
import { Telegraf } from 'telegraf';

// Inisialisasi Turso Client
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Helper untuk mendeteksi segmen dan hashtag dari pesan
function detectSegmen(text = '') {
  const lower = text.toLowerCase();
  if (lower.includes('#moban')) return { code: 'B2C', tag: '#moban' };
  if (lower.includes('#helprekan')) return { code: 'B2B', tag: '#helprekan' };
  if (lower.includes('#tolong')) return { code: 'PROVI', tag: '#tolong' };
  return null;
}

// Helper untuk mengambil file_id dari foto/video/dokumen
function extractFileIds(message) {
  const fileIds = [];
  if (message.photo && message.photo.length > 0) {
    fileIds.push(message.photo[message.photo.length - 1].file_id);
  }
  if (message.video) {
    fileIds.push(message.video.file_id);
  }
  if (message.document) {
    fileIds.push(message.document.file_id);
  }
  return fileIds.length > 0 ? fileIds.join(',') : null;
}

// Helper untuk mendapatkan ISO String Waktu Indonesia (WIB UTC+7)
function getWibIsoString() {
  const now = new Date();
  const wibTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  return wibTime.toISOString().replace('Z', '+07:00');
}

export default async function handler(req, res) {
  // Hanya terima method POST dari Telegram
  if (req.method !== 'POST') {
    return res.status(200).send('Telegram Bot Webhook Active');
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!BOT_TOKEN) {
    console.error('ERROR: TELEGRAM_BOT_TOKEN belum dikonfigurasi.');
    return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN missing' });
  }

  try {
    const bot = new Telegraf(BOT_TOKEN);

    bot.on(['text', 'photo', 'video', 'document'], async (ctx) => {
      try {
        const message = ctx.message;
        if (!message) return;

        // 1. Cek jika chat bersifat private / japri
        if (message.chat.type === 'private') {
          await ctx.reply('⚠️ Maaf, bot ini hanya dapat digunakan di dalam Grup Telegram teknisi/HD, tidak melayani chat pribadi (japri).');
          return;
        }

        const text = message.text || message.caption || '';
        const segmenInfo = detectSegmen(text);
        const currentFileId = extractFileIds(message);
        const mediaGroupId = message.media_group_id || null;

        // 2. Penanganan Media Group / Album Foto
        if (mediaGroupId && currentFileId) {
          const groupQuery = await db.execute({
            sql: `SELECT id_permintaan, file_id FROM permintaan 
                  WHERE chat_id = ? AND media_group_id = ? LIMIT 1`,
            args: [message.chat.id, mediaGroupId],
          });

          if (groupQuery.rows.length > 0) {
            const existingDoc = groupQuery.rows[0];
            const oldFileIds = existingDoc.file_id ? existingDoc.file_id.split(',') : [];

            if (!oldFileIds.includes(currentFileId)) {
              oldFileIds.push(currentFileId);
              const updatedFileIds = oldFileIds.join(',');

              await db.execute({
                sql: `UPDATE permintaan SET file_id = ? WHERE id_permintaan = ?`,
                args: [updatedFileIds, existingDoc.id_permintaan],
              });
            }
            return;
          }
        }

        // 3. Pembuatan Tiket Utama (Pesan Baru dengan Hashtag)
        if (segmenInfo) {
          //const generatedId = 'req_' + Date.now() + Math.random().toString(36).substring(2, 6);
          //const currentTimestamp = new Date().toISOString();
          // ✅ SESUDAH
          const generatedId = 'req_' + Date.now() + Math.random().toString(36).substring(2, 6);
          const currentTimestamp = getWibIsoString();
          const namaTeknisi = [message.from.first_name, message.from.last_name].filter(Boolean).join(' ');

          await db.execute({
            sql: `INSERT INTO permintaan (
                    id_permintaan, tiket_id, msg_type, sender_type, chat_id, thread_id, 
                    message_id, reply_to_message_id, media_group_id, segmen, kategori_pekerjaan, 
                    pesan, file_id, id_telegram_teknisi, nama_teknisi, username_teknisi, 
                    id_telegram_hd, status, keterangan, timestamp_created, timestamp_taken, timestamp_close
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              generatedId,
              generatedId,
              'UTAMA',
              'TELEGRAM',
              message.chat.id,
              message.message_thread_id || null,
              message.message_id,
              null,
              mediaGroupId,
              segmenInfo.code,
              null,
              text,
              currentFileId,
              message.from.id,
              namaTeknisi,
              message.from.username || null,
              null,
              'OPEN',
              null,
              currentTimestamp,
              null,
              null,
            ],
          });

          try { await ctx.react('👍'); } catch (e) {}

          await ctx.reply(`✅ Tiket Berhasil Dibuat!\n📌 ID Tiket: ${generatedId}\n🏷️ Segmen: ${segmenInfo.code}`, {
            reply_to_message_id: message.message_id,
          });
          return;
        }

        // 4. Pesan Balasan / Reply
        if (message.reply_to_message) {
          const parentMessageId = message.reply_to_message.message_id;

          const parentQuery = await db.execute({
            sql: `SELECT tiket_id, segmen, kategori_pekerjaan FROM permintaan 
                  WHERE chat_id = ? AND message_id = ? LIMIT 1`,
            args: [message.chat.id, parentMessageId],
          });

          if (parentQuery.rows.length > 0) {
            const parentData = parentQuery.rows[0];
            const parentTiketId = parentData.tiket_id;
            //const replyGeneratedId = 'rpl_' + Date.now() + Math.random().toString(36).substring(2, 6);
            //const currentTimestamp = new Date().toISOString();
            // ✅ SESUDAH
            const replyGeneratedId = 'rpl_' + Date.now() + Math.random().toString(36).substring(2, 6);
            const currentTimestamp = getWibIsoString();
            const namaTeknisi = [message.from.first_name, message.from.last_name].filter(Boolean).join(' ');

            await db.execute({
              sql: `INSERT INTO permintaan (
                      id_permintaan, tiket_id, msg_type, sender_type, chat_id, thread_id, 
                      message_id, reply_to_message_id, media_group_id, segmen, kategori_pekerjaan, 
                      pesan, file_id, id_telegram_teknisi, nama_teknisi, username_teknisi, 
                      id_telegram_hd, status, keterangan, timestamp_created, timestamp_taken, timestamp_close
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [
                replyGeneratedId,
                parentTiketId,
                'BALASAN',
                'TELEGRAM',
                message.chat.id,
                message.message_thread_id || null,
                message.message_id,
                parentMessageId,
                mediaGroupId,
                parentData.segmen,
                parentData.kategori_pekerjaan,
                text,
                currentFileId,
                message.from.id,
                namaTeknisi,
                message.from.username || null,
                null,
                null,
                null,
                currentTimestamp,
                null,
                null,
              ],
            });

            await db.execute({
              sql: `UPDATE permintaan SET status = 'OPEN', timestamp_close = NULL 
                    WHERE tiket_id = ? AND msg_type = 'UTAMA'`,
              args: [parentTiketId],
            });

            try { await ctx.react('👀'); } catch (e) {}
            return;
          }
        }
      } catch (err) {
        console.error('Error Inside Bot Handler:', err);
      }
    });

    // Pastikan req.body di-parse jika dikirim sebagai string
    const update = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    
    // Proses update dari Telegram
    await bot.handleUpdate(update);

    // Kirim respon OK 200 ke Telegram
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook Top-Level Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
