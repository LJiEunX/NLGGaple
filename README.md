# Gaple / Domino Multiplayer Online & Core Engine

Platform game Gaple / Domino online multipemain tradisional Indonesia dengan validasi *server-authoritative*, real-time WebSocket (Socket.io), sistem multi-room, antarmuka web interaktif modern (React 19 + Tailwind CSS), serta **Mode Khusus: "Ala NLGG"**.

---

## Mode Khusus: "Ala NLGG"

Mode variasi kompetitif-psikologis dengan elemen *blind pick*, *blind trade*, dan *double deck*:

1. **Konfigurasi:** 2 set domino standar (**56 kartu**), disebar tertutup di meja. 1 sampai 4 pemain.
2. **Fase 1 (Blind Pick):** Pemain memilih sendiri 7 kartu tertutup dari sebaran meja.
3. **Fase 2 (Blind Trade):** Setiap pemain memiliki kuota 1x untuk mengajak barter 1 kartu tertutup dengan pemain lain (bisa Accept/Reject).
4. **Fase 3 (Reveal Phase):** Seluruh pemain membuka isi kartu di tangan. Sisa kartu meja menjadi *Draw Pool* (tumpukan cangkul). Balak tertinggi jalan pertama.
5. **Fase 4 (Turn & Cangkul Wajib):**
   - Jika tidak punya kartu yang cocok, pemain **wajib mencangkul 1 kartu**.
   - Jika kartu cangkulan cocok: **wajib langsung dimainkan ke meja**.
   - Jika tidak cocok: kartu masuk ke tangan dan pemain dinyatakan Pass.
6. **Kondisi Akhir:** Menang normal saat kartu habis (0 kartu). Kondisi Buntu (*Deadlock*) jika cangkul habis dan semua pemain pass berturut-turut; pemenang ditentukan oleh jumlah titik (*pips*) terkecil.

### Menjalankan Mode Ala NLGG:
- **Unit Test (13 test cases):** `npm test`
- **Simulasi Pertandingan CLI:** `npm run demo:nlgg`

---

## Fitur Utama Game Reguler
- **Homepage Arcade Modern:** Profil avatar emoji, quick join, dan mode card.
- **Gameplay Real-Time:** 28 kartu standar, balak vertikal, meja felt hijau kasino.
- **Multiplayer Multi-Room:** Socket.io dengan room code 6 digit dan link share instan.
- **Audio Sintetis & Quick Chat:** Efek domino clack dan balon pesan melayang.

---

## Cara Menjalankan Server & Web
```bash
cd /Users/farandanargya/.gemini/antigravity/scratch/gaple-engine

# Jalankan WebSocket backend
npm run server

# Jalankan frontend web dev
npm run dev
```
Buka peramban di: **[http://localhost:5173](http://localhost:5173)**
