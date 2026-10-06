require('dotenv').config();
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const AdmZip = require('adm-zip');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SESSION_SECRET = process.env.SESSION_SECRET || 'ganti-secret-ini';
const MAX_GAMBAR = 6; // maksimal jumlah foto per produk

// ---------- Setup ----------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

// Upload gambar item
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const nama = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
    cb(null, nama);
  },
});
const upload = multer({ storage });

// Upload sementara buat file backup yang mau di-import
const importDir = path.join(__dirname, 'tmp-import');
if (!fs.existsSync(importDir)) fs.mkdirSync(importDir, { recursive: true });
const importUpload = multer({ dest: importDir });

// Middleware cek login admin
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/admin');
}

function getAllItems() {
  return db.get('items').orderBy('created_at', 'desc').value();
}

// ---------- Halaman Publik ----------
app.get('/', (req, res) => {
  const items = getAllItems();
  const kategoriSet = [
    ...new Set(items.map((i) => (i.kategori || '').trim()).filter(Boolean)),
  ];
  res.render('katalog', { items, kategoriList: kategoriSet });
});

app.get('/katalog', (req, res) => {
  res.redirect('/');
});

// ---------- Admin: Login ----------
app.get('/admin', (req, res) => {
  if (req.session && req.session.isAdmin) return res.redirect('/admin/dashboard');
  res.render('admin-login', { error: null });
});

app.post('/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect('/admin/dashboard');
  }
  res.render('admin-login', { error: 'Password salah, coba lagi.' });
});

app.post('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin'));
});

// ---------- Admin: Dashboard (CRUD item) ----------
app.get('/admin/dashboard', requireAdmin, (req, res) => {
  const items = getAllItems();
  res.render('admin-dashboard', { items });
});

app.post('/admin/items', requireAdmin, upload.array('gambar', MAX_GAMBAR), (req, res) => {
  const { nama, sku, kategori, deskripsi, jumlah, harga } = req.body;
  const nextId = db.get('nextId').value();

  const newItem = {
    id: nextId,
    nama,
    sku: sku || null,
    kategori: kategori || null,
    deskripsi: deskripsi || null,
    jumlah: Number(jumlah) || 0,
    harga: Number(harga) || 0,
    created_at: new Date().toISOString(),
    images: (req.files || []).map((f) => ({ path: '/uploads/' + f.filename })),
  };

  db.get('items').push(newItem).write();
  db.set('nextId', nextId + 1).write();

  res.redirect('/admin/dashboard');
});

app.post('/admin/items/:id/update', requireAdmin, upload.array('gambar', MAX_GAMBAR), (req, res) => {
  const id = Number(req.params.id);
  const { nama, sku, kategori, deskripsi, jumlah, harga } = req.body;
  const itemChain = db.get('items').find({ id });
  const existing = itemChain.value();
  if (!existing) return res.redirect('/admin/dashboard');

  itemChain
    .assign({
      nama,
      sku: sku || null,
      kategori: kategori || null,
      deskripsi: deskripsi || null,
      jumlah: Number(jumlah) || 0,
      harga: Number(harga) || 0,
    })
    .write();

  // Hapus foto yang dicentang untuk dihapus (value checkbox = path foto)
  let hapusGambar = req.body.hapus_gambar || [];
  if (!Array.isArray(hapusGambar)) hapusGambar = [hapusGambar];

  let currentImages = db.get('items').find({ id }).value().images || [];
  if (hapusGambar.length > 0) {
    hapusGambar.forEach((imgPath) => {
      const filePath = path.join(__dirname, 'public', imgPath);
      fs.unlink(filePath, () => {});
    });
    currentImages = currentImages.filter((img) => !hapusGambar.includes(img.path));
  }

  // Tambahkan foto baru (kalau ada)
  const fotoBaru = (req.files || []).map((f) => ({ path: '/uploads/' + f.filename }));
  const finalImages = [...currentImages, ...fotoBaru];

  db.get('items').find({ id }).assign({ images: finalImages }).write();

  res.redirect('/admin/dashboard');
});

app.post('/admin/items/:id/delete', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.get('items').find({ id }).value();
  if (existing && existing.images) {
    existing.images.forEach((img) => {
      const filePath = path.join(__dirname, 'public', img.path);
      fs.unlink(filePath, () => {});
    });
  }
  db.get('items').remove({ id }).write();
  res.redirect('/admin/dashboard');
});

// ---------- Admin: Export & Import Backup ----------
app.get('/admin/export', requireAdmin, (req, res) => {
  const tanggal = new Date().toISOString().slice(0, 10);
  res.attachment(`backup-katalog-olivetree-${tanggal}.zip`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => {
    console.error('Gagal bikin backup:', err);
    res.status(500).end();
  });
  archive.pipe(res);

  archive.file(path.join(__dirname, 'data.json'), { name: 'data.json' });
  const uploadsDir = path.join(__dirname, 'public', 'uploads');
  if (fs.existsSync(uploadsDir)) {
    archive.directory(uploadsDir, 'uploads');
  }

  archive.finalize();
});

app.post('/admin/import', requireAdmin, importUpload.single('backupfile'), (req, res) => {
  if (!req.file) return res.redirect('/admin/dashboard');

  try {
    const zip = new AdmZip(req.file.path);

    const dataEntry = zip.getEntry('data.json');
    if (!dataEntry) {
      throw new Error('File backup tidak valid (data.json tidak ditemukan di dalam zip)');
    }
    const newData = JSON.parse(zip.readAsText(dataEntry));

    // Bersihkan folder uploads yang sekarang
    const uploadsDir = path.join(__dirname, 'public', 'uploads');
    if (fs.existsSync(uploadsDir)) {
      fs.readdirSync(uploadsDir).forEach((f) => {
        if (f !== '.gitkeep') {
          fs.unlinkSync(path.join(uploadsDir, f));
        }
      });
    } else {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Ekstrak foto-foto dari backup
    zip.getEntries().forEach((entry) => {
      if (entry.entryName.startsWith('uploads/') && !entry.isDirectory) {
        const fileName = path.basename(entry.entryName);
        if (fileName) {
          fs.writeFileSync(path.join(uploadsDir, fileName), entry.getData());
        }
      }
    });

    // Ganti isi database dengan data dari backup
    db.setState(newData).write();

    fs.unlinkSync(req.file.path);
    res.redirect('/admin/dashboard');
  } catch (err) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.send(
      `<p>Gagal import backup: ${err.message}</p><p><a href="/admin/dashboard">&larr; Kembali ke dashboard</a></p>`
    );
  }
});

app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});
