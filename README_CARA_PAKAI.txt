PANDUAN UPDATE - PORTAL UJIAN PMB STIPI MAGHFIRAH 2026
Versi: Lightweight + Reset per Mata Pelajaran

PERUBAHAN UTAMA
1. Password akses sekarang hanya dibaca dari config.js.
   - Password sengaja dikosongkan pada paket unduhan ini agar sistem fail-closed.
   - Isi password baru sebelum upload. Password lama dari app.js atau database/users.js tidak lagi ikut aktif.
   - Jangan mengubah password di app.js.
2. Admin dapat melakukan dua jenis reset:
   - Reset Mata Pelajaran: membuka ulang satu ujian saja, misalnya Bahasa Arab.
     Paket tetap terkunci dan hasil Matematika tidak terhapus.
   - Reset Seluruh Peserta: menghapus semua progres dan membuka kembali pilihan paket.
3. Tombol Submit Ujian hanya muncul ketika peserta berada pada soal terakhir.
4. Jawaban disimpan sebagai draft secara berkala di perangkat peserta.
5. Jika koneksi bermasalah saat submit, hasil dimasukkan ke antrean lokal dan dicoba dikirim kembali ketika koneksi stabil.
6. Monitoring dibuat ringan: tanpa permintaan kamera, tanpa mic, dan tanpa upload media.
7. File banner dikompres agar halaman lebih cepat dibuka di HP.
8. Backend tidak lagi membaca seluruh tabel hasil setiap kali peserta login. Ini mengurangi beban Google Sheets ketika banyak peserta masuk bersamaan.

STRUKTUR FILE YANG DIUPLOAD KE GITHUB
- index.html
- styles.css
- app.js
- config.js
- google-apps-script.gs
- database/users.js
- assets/logo-stipi-maghfirah.png
- assets/banner-kampus-pemimpin.webp
- assets/banner-pendidikan-5-tahun.webp
- assets/banner-ujian-tulis-2026.webp

FILE LAMA YANG HARUS DIHAPUS DARI GITHUB
- database/accounts.csv
- assets/banner-kampus-pemimpin.png
- assets/banner-pendidikan-5-tahun.png
- assets/banner-ujian-tulis-2026.png

CARA MENGGANTI PASSWORD
1. Buka config.js.
2. Isi bagian berikut:
   adminPassword: "PASSWORD_ADMIN_BARU",
   candidatePassword: "PASSWORD_PESERTA_BARU",
3. Untuk password admin, buka Google Apps Script > Project Settings > Script Properties.
4. Ubah Property ADMIN_PASSWORD menjadi password admin baru yang sama persis.
5. Deploy ulang Apps Script sebagai versi baru.

CATATAN PENTING PASSWORD
- Jangan mengganti password hanya di app.js karena app.js bukan sumber password lagi.
- Password peserta tidak perlu ditulis satu per satu pada database/users.js.
- File database/users.js sekarang hanya menyimpan nama tampilan admin.

CARA MEMASANG BACKEND GOOGLE APPS SCRIPT TERBARU
1. Buka Google Sheet rekap PMB.
2. Klik Extensions > Apps Script.
3. Hapus script lama.
4. Tempel seluruh isi google-apps-script.gs versi terbaru.
5. Pastikan Script Property ADMIN_PASSWORD sudah sesuai dengan config.js.
6. Klik Deploy > Manage deployments.
7. Pilih deployment aktif > Edit.
8. Pilih New version > Deploy.
9. URL Web App dapat tetap sama. Pastikan URL tersebut masih tersimpan pada sheetsWebAppUrl di config.js.

CARA RESET SATU MATA PELAJARAN
Contoh kasus: peserta sudah memilih Pilihan 1, lalu Bahasa Arab terkirim otomatis karena kendala teknis.
1. Login sebagai admin.
2. Pada Kontrol Reset Peserta, isi nomor ujian.
3. Pilih Bahasa Arab.
4. Klik Reset Mata Pelajaran.
5. Minta peserta refresh halaman lalu login ulang.
6. Peserta dapat mengerjakan Bahasa Arab kembali, tetapi paket tetap Pilihan 1 dan hasil Matematika tetap aman.

CARA RESET SELURUH PESERTA
Gunakan hanya untuk kasus khusus ketika peserta memang harus memulai dari awal.
1. Login sebagai admin.
2. Isi nomor ujian.
3. Klik Reset Seluruh Peserta.
4. Konfirmasi tindakan.
5. Minta peserta refresh halaman lalu login ulang.

CHECKLIST UJI COBA SEBELUM UJIAN RESMI
1. Ganti password pada config.js dan samakan Script Property ADMIN_PASSWORD.
2. Deploy ulang Apps Script sebagai versi baru.
3. Hapus file lama yang tercantum di atas dari GitHub.
4. Tes login menggunakan password lama. Password lama harus ditolak.
5. Tes peserta PMB001 memilih Pilihan 1.
6. Submit Bahasa Arab.
7. Reset Bahasa Arab dari dashboard admin.
8. Login ulang sebagai PMB001. Bahasa Arab harus terbuka, sedangkan paket tetap Pilihan 1.
9. Tes tombol Submit: pada nomor 1-49 harus tidak tampil; pada nomor 50 harus tampil.
10. Tes dari mode incognito dan minimal dua HP berbeda.

CATATAN KEAMANAN
Website ini tetap berupa website statis di GitHub Pages. Penguncian progres dan reset lintas perangkat diperkuat melalui Google Apps Script dan Google Sheets. Namun password serta bank soal yang dikirim ke browser masih dapat dibaca oleh orang yang sangat memahami inspect/source code. Untuk keamanan tingkat tinggi, autentikasi dan bank soal idealnya dipindahkan ke backend khusus.


PEMBARUAN WAKTU DAN URUTAN HASIL
--------------------------------
- Seluruh waktu ujian, aktivitas, submit, reset, dan status peserta disimpan dalam zona Asia/Jakarta (WIB / UTC+07:00).
- Tabel dashboard admin menampilkan label WIB secara eksplisit.
- Sheet "Hasil PMB" otomatis dirapikan berdasarkan urutan alami Nomor Ujian ketika backend versi ini pertama kali dipakai.
- Setelah itu, hasil submit baru langsung disisipkan pada posisi Nomor Ujian yang sesuai agar proses lebih ringan.
- Contoh urutan yang benar: PMB1, PMB2, PMB9, PMB10, bukan PMB1, PMB10, PMB2.
- Jika admin pernah memindahkan baris secara manual di Google Sheets, jalankan fungsi rapikanUrutanHasilPMB() satu kali dari Apps Script.
