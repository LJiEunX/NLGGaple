# NLGGaple - Domino Multiplayer Online & Core Engine

Platform game NLGGaple / Domino online multipemain tradisional Indonesia dengan validasi *server-authoritative*, real-time WebSocket (Socket.io), sistem multi-room, antarmuka web interaktif modern (React 19 + Tailwind CSS), serta **Mode Khusus: "Ala NLGG"**.

---

## Fitur Utama

- **Real-Time Multiplayer:** Bermain bersama teman menggunakan kode ruangan 6 karakter via WebSocket (Socket.io).
- **Anti-Cheat Server-Authoritative:** Logika kartu dijalankan sepenuhnya di server. Lawan tidak dapat mengintip kartu di memori atau Network browser.
- **Dukungan Mobile Responsif:** Optimal dimainkan di ponsel (portrait & landscape) maupun laptop tanpa perlu instalasi aplikasi (Zero-Install).
- **Mode Klasik & Mode Ala NLGG:** Pilihan 2 hingga 4 pemain serta target skor kustom (50, 100, 150, atau skor bebas hingga 999 poin).
- **Audio Sintetis & Quick Chat:** Sensasi suara domino benturan kayu sintetis (Web Audio API) dan pesan singkat melayang.

---

## Mode Khusus: "Ala NLGG"

Mode variasi kompetitif dengan elemen strategi dan gertakan:

1. **Konfigurasi:** 2 set domino standar (**56 kartu**), disebar tertutup di meja. 2 sampai 4 pemain.
2. **Fase 1 (Blind Pick):** Pemain memilih sendiri 7 kartu tertutup dari sebaran meja.
3. **Fase 2 (Blind Trade):** Setiap pemain memiliki kuota 1x untuk menukar seluruh 7 kartu tertutup di tangannya dengan lawan pilihan sebelum kartu dibuka.
4. **Fase 3 (Reveal Phase):** Seluruh pemain membuka kartu di tangan. Sisa kartu meja menjadi *Draw Pool* (tumpukan cangkul). Balak tertinggi jalan pertama.
5. **Fase 4 (Turn & Cangkul Wajib):**
   - Jika tidak memiliki kartu cocok di ujung meja, pemain **wajib mencangkul 1 kartu**.
   - Jika kartu cangkulan cocok: **wajib langsung dimainkan ke meja**.
   - Jika tidak cocok: kartu masuk ke tangan dan giliran berpindah (Pass).
6. **Kondisi Akhir:** Menang normal saat kartu habis (0 kartu). Kondisi Buntu (*Deadlock*) jika cangkul habis dan semua pemain pass berturut-turut; pemenang ditentukan oleh jumlah titik (*pips*) terkecil.

---

## Menjalankan Secara Lokal

### Prasyarat
- [Node.js](https://nodejs.org/) versi 20+

### Instalasi & Menjalankan
```bash
# 1. Clone repository
git clone https://github.com/USERNAME/nlggaple.git
cd nlggaple

# 2. Install dependensi
npm install

# 3. Jalankan development server
# Terminal 1: Backend WebSocket Server
npm run server

# Terminal 2: Frontend Web App
npm run dev
```

Buka peramban di: **http://localhost:5173**

---

## Menjalankan Unit Test

Pengujian otomatis mencakup logika dek, susunan rantai balak ular, validasi langkah kartu, server multiplayer, anti-cheat, dan keamanan:

```bash
npm test
```

---

## Deployment ke Cloud (Vercel & Render)

- **Backend (Render / Railway):**
  - Build Command: `npm install`
  - Start Command: `npm run server`
- **Frontend (Vercel):**
  - Framework Preset: `Vite`
  - Environment Variable: `VITE_SERVER_URL=https://nama-backend-anda.onrender.com`

---

## Lisensi
MIT License - Dibuat untuk pecinta permainan domino Indonesia.
