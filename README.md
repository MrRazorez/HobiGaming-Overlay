# **SELAMAT DATANG DI HOBIGAMING!!!**
Di repository ini berisi kumpulan-kumpulan overlay untuk OBS Studio, PRISM Live Studio, dan aplikasi streaming lainnya beserta remote control yang bisa diakses melalui Smartphone menggunakan Browser. Overlay ini bisa dijalankan secara lokal tanpa perlu berlangganan seperti di situs-situs resmi penyedia overlay. Overlay ini tidak perlu menggunakan Stream Deck. Cukup mengakses link untuk remote control di browser, maka overlay siap dioperasikan. Sangat cocok buat streamer yang gak punya Stream Deck.

**PERINGATAN**
---
Untuk menggunakan overlay yang berjalan di jaringan lokal (tanpa perlu akses internet), dibutuhkan orang yang paham cara pake Command Prompt, Powershell, atau Terminal. Karena, instalasi ini bisa dibilang agak ribet. Tapi, jangan khawatir!! Program ini dah gua bikin simple biar orang awam bisa pake overlay ini. Kalo butuh pendampingan buat nginstal2, bisa DM gua di [Instagram](https://www.instagram.com/minggus.3gp).

SYSTEM REQUIREMENTS
---
1. ###### Sistem operasi Windows 10/11 dan Android (sistem operasi mobile lain harusnya bisa)
2. ###### Node.JS versi terbaru (disarankan ambil versi LTS)
   ###### [Link Node.JS](https://nodejs.org/en/download)
3. ###### OBS Studio, PRISM Live Studio, atau aplikasi lainnya
4. ###### Smartphone dan PC harus terhubung dalam satu jaringan Wi-Fi 

DAFTAR OVERLAY YANG TERSEDIA
---

1. ###### **Counter Overlay**, overlay penghitung yang bisa digunakan untuk sesi livestream tertentu, misal menghitung total game over setiap main Elden Rings (Death Count), menghitung total kemenangan setiap main Delta Force (Win Count), dan lain-lain.
2. ###### **Memeboard Overlay**, overlay untuk emoji dalam bentuk meme. overlay ini mendukung pemutaran Audio-Only dan Video. sangat cocok buat streamer yang suka gimmick. Buat contoh, bisa lihat [klip Reza Auditore](https://www.youtube.com/shorts/o50d4dkGy44).

TUTORIAL INSTALASI
---

1. ###### Pastikan udah nginstal Node.JS
2. ###### Kalo punya aplikasi "Terminal" di Windows, buka aplikasi tersebut melalui folder overlay
![alt text](<Screenshot 2026-11-21 083142-1.png>)

3. ###### Pilih salah satu folder yang mau dipake. Misal, counter-overlay
![alt text](<Screenshot 2026-11-21 084657.png>)

4. ###### Jalankan script wajib di bawah ini
```bash
npm install
```

4. ###### Untuk folder counter-overlay, cukup jalankan script ini
```bash
npm run build
npm start
```

5. ###### Untuk folder memeboard-overlay, cukup jalankan script ini
```bash
npm start
```

6. ###### Program ini secara gak langsung bakalan ngebuat server lokal sendiri. Nanti hasilnya bakalan kayak gini.
![alt text](<Screenshot 2026-11-21 090437-1.png>)

7. ###### **Overlay dah siap digunakan! Tinggal masukin link overlay ke Browser Overlay milik OBS Studio, terus Scan QR Code lewat Smartphone buat akses remote control, dah kelar!**

**CATATAN :** Ketika baru pertama kali gunain overlay, biasanya program minta ngatur jaringan Wi-Fi di file **.env** dulu. Ikuti aja instruksi yang diminta. Gak susah kok! **:)**