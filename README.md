# Katalog Olive Tree

Website katalog produk dengan halaman admin untuk kelola item.

- **Halaman utama** (`/`) — langsung menampilkan katalog produk (nav kategori + hamburger menu di mobile, kartu produk bisa diklik untuk lihat detail & galeri foto).
- **Admin** (`/admin`) — login password, lalu bisa tambah/edit/hapus produk (nama, SKU, kategori, deskripsi, stok, harga, dan multi-foto) di `/admin/dashboard`.
- **Backup & Restore** — di dashboard admin, ada tombol "Download Backup" (export semua data + foto jadi 1 file zip, simpan sendiri ke Google Drive) dan "Import Backup" (upload file backup itu buat mengembalikan data, misal setelah server di-reset).

Dibangun dengan Node.js + Express, database SQLite (file lokal), EJS untuk tampilan.

## 1. Jalankan di komputer sendiri

```bash
npm install
cp .env.example .env
```

Buka file `.env`, ganti:
- `ADMIN_PASSWORD` — password untuk login ke halaman admin.
- `SESSION_SECRET` — kalimat acak bebas, buat mengamankan sesi login.

Lalu jalankan:

```bash
npm start
```

Buka `http://localhost:3000`. Halaman admin ada di `http://localhost:3000/admin`.

Edit file `.ejs`/`.css` tidak perlu restart server — tinggal refresh browser. Tapi kalau edit `server.js`/`db.js`, perlu stop (Ctrl+C) lalu `npm start` lagi.

## 2. Push ke GitHub

```bash
git init
git add .
git commit -m "Initial commit: katalog app"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```

File `.env`, `node_modules/`, `data.sqlite`, dan isi folder `public/uploads/` sudah otomatis diabaikan lewat `.gitignore`.

## 3. Deploy (Railway / Render)

1. Buat project baru, "Deploy from GitHub repo", pilih repo ini.
2. Di tab Variables/Environment, tambahkan `ADMIN_PASSWORD` dan `SESSION_SECRET` — **isi tanpa tanda kutip**, langsung value-nya saja.
3. Build otomatis jalan (`npm install` lalu `npm start`).

### ⚠️ Catatan penyimpanan

Di paket gratis Railway/Render, disk bisa ter-reset tiap redeploy — artinya data produk & gambar upload bisa hilang. **Solusinya: rutin klik "Download Backup" di dashboard admin setelah nambah/ubah produk, simpan file zip-nya ke Google Drive.** Kalau data di server ternyata hilang, tinggal "Import Backup" pakai file terakhir yang kamu simpan.

## Struktur folder

```
catalog-app/
├── server.js             # Server & semua routes
├── db.js                 # Setup database SQLite (items + item_images)
├── views/
│   ├── katalog.ejs         # Halaman utama: katalog + modal detail produk
│   ├── admin-login.ejs
│   └── admin-dashboard.ejs
├── public/
│   ├── css/style.css
│   ├── images/logo.png     # Logo Olive Tree
│   └── uploads/            # Foto produk yang di-upload
└── .env.example
```

## Field produk

nama, SKU, kategori (ketik bebas — otomatis jadi tombol filter di katalog), deskripsi, jumlah stok, harga (opsional), dan foto (boleh lebih dari 1, maksimal 6 per produk).
