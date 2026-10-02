# Panduan Instalasi dan Deployment Produksi Transdata NMS

Panduan langkah demi langkah implementasi Network Management System (NMS) & GIS FTTH untuk ISP Transdata pada server **Ubuntu 22.04 LTS / 24.04 LTS** atau **Debian 12**.

---

## 1. Persyaratan Sistem
- **OS**: Ubuntu 22.04 / 24.04 LTS (x86_64)
- **CPU**: Minimal 2 vCPU
- **RAM**: Minimal 4 GB (disarankan 8 GB untuk jaringan skala besar)
- **Disk**: 40 GB SSD (disesuaikan dengan retensi histori trafik)
- **Komponen Jaringan**: Akses ke jaringan manajemen router/switch/OLT melalui interface khusus.

---

## 2. Instalasi Paket Dependensi Sistem

Perbarui repositori dan instal Nginx, MariaDB, PHP 8.3/8.2, dan Net-SNMP CLI:

```bash
sudo apt update && sudo apt upgrade -y

# Instal Web Server, Database, dan Net-SNMP tools
sudo apt install -y nginx mariadb-server snmp snmp-mibs-downloader iputils-ping curl git

# Tambahkan repositori PHP Ondrej (jika ingin versi PHP 8.3 terbaru di Ubuntu)
sudo add-apt-repository ppa:ondrej/php -y
sudo apt update
sudo apt install -y php8.3-fpm php8.3-mysql php8.3-curl php8.3-mbstring php8.3-xml php8.3-cli
```

Verifikasi instalasi Net-SNMP dan PHP:
```bash
php -v
snmpget -V
ping -c 1 127.0.0.1
```

---

## 3. Konfigurasi MariaDB Database

Amankan instalasi MariaDB:
```bash
sudo mysql_secure_installation
```

Buat database dan pengguna khusus Transdata NMS:
```sql
sudo mysql -u root -p

CREATE DATABASE transdata_nms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'transdata_user'@'localhost' IDENTIFIED BY 'GantiDenganPasswordSangatKuat!2026';
GRANT ALL PRIVILEGES ON transdata_nms.* TO 'transdata_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Impor skema database Transdata NMS dan tabel GIS FTTH:
```bash
mysql -u transdata_user -p transdata_nms < database/schema.sql
mysql -u transdata_user -p transdata_nms < database/ftth_gis_schema.sql
mysql -u transdata_user -p transdata_nms < database/seed_initial.sql
```

*Catatan: Tidak ada akun administrator default (seperti admin/admin) yang dibuat otomatis. Akun Superadmin pertama dibuat melalui wizard setup web yang aman saat pertama kali diakses.*

---

## 4. Konfigurasi Backend PHP

Salin konfigurasi contoh ke `backend/config/config.php`:
```bash
cp backend/config/config.example.php backend/config/config.php
nano backend/config/config.php
```

Sesuaikan parameter:
- `'username' => 'transdata_user'`
- `'password' => 'PasswordAnda'`
- `'jwt_secret' => 'buat_64_karakter_random_hex'`
- `'genieacs' => ['nbi_url' => 'http://127.0.0.1:7557']`

---

## 5. Build Frontend React

Aplikasi frontend dibangun menjadi file statis murni di folder `dist/` sehingga tidak memerlukan proses Node.js terus-menerus di server produksi:

```bash
# Instal dependensi dan build
npm install
npm run build

# Buat folder target web dan salin file
sudo mkdir -p /var/www/transdata-nms
sudo cp -r dist /var/www/transdata-nms/
sudo cp -r backend /var/www/transdata-nms/
sudo chown -R www-data:www-data /var/www/transdata-nms
```

---

## 6. Konfigurasi Virtual Host Nginx

Salin file konfigurasi Nginx:
```bash
sudo cp backend/nginx-transdata.conf /etc/nginx/sites-available/transdata-nms
sudo ln -s /etc/nginx/sites-available/transdata-nms /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Uji konfigurasi Nginx
sudo nginx -t
sudo systemctl restart nginx php8.3-fpm
```

---

## 7. Setup Background Polling Worker (systemd)

Agar monitoring SNMP dan ping berjalan berkala secara otomatis di latar belakang:
```bash
sudo cp backend/transdata-poller.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now transdata-poller.service
sudo systemctl status transdata-poller.service
```

---

## 8. Verifikasi Operasional
1. Buka browser: `http://<IP_SERVER>/`
2. Sistem akan menampilkan halaman **Inisialisasi Superadmin Transdata NMS** karena database masih baru dan bersih.
3. Buat kredensial Superadmin pertama Anda.
4. Masuk ke Dashboard, Tambah Perangkat MikroTik / OLT / Switch nyata Anda.
5. Lakukan uji Ping dan SNMP nyata langsung dari tombol menu perangkat.
6. Buka GIS FTTH untuk memetakan jalur kabel feeder/distribusi serta ODC dan ODP.

---

## 9. Solusi Error 'HTTP 405 Method Not Allowed' saat Aktivasi Superadmin

Jika Anda melihat pesan **`HTTP error 405`** atau **`405 Not Allowed`** saat menekan tombol "Aktifkan Superadmin Transdata":

### Penyebab Teknis:
Nginx secara default **menolak method POST ke file statis HTML**. Jika konfigurasi Nginx tidak mengoper request `/api/*` langsung ke FastCGI PHP-FPM, request `POST /api/auth/setup-admin` akan jatuh (*fallback*) ke `location / { try_files $uri $uri/ /index.html; }`. Karena `/index.html` adalah file statis, Nginx membalas dengan status **`HTTP 405 Method Not Allowed`**.

### Solusi Cepat:
Pastikan blok `location ^~ /api` di `/etc/nginx/sites-available/transdata-nms` dikonfigurasi sebagai berikut (menggunakan directive `^~` agar tidak tertimpa regex static):

```nginx
    # Pastikan request /api langsung diarahkan ke PHP-FPM
    location ^~ /api {
        fastcgi_pass unix:/var/run/php/php8.3-fpm.sock; # atau php8.2-fpm.sock
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME /var/www/transdata-nms/backend/public/index.php;
        fastcgi_param REQUEST_URI $request_uri;
        fastcgi_param QUERY_STRING $query_string;
        fastcgi_param REQUEST_METHOD $request_method;
        fastcgi_param CONTENT_TYPE $content_type;
        fastcgi_param CONTENT_LENGTH $content_length;
        include fastcgi_params;
        fastcgi_read_timeout 60s;
    }
```

Kemudian reload Nginx dan PHP-FPM:
```bash
sudo nginx -t && sudo systemctl restart nginx php8.3-fpm
```

---

## 11. Panduan Konfigurasi Data Pelanggan, Paket Layanan & MikroTik Isolir

Transdata NMS dilengkapi modul manajemen pelanggan ISP dan paket layanan billing yang terhubung langsung ke MikroTik RouterOS API:

### 1. Setting Paket Layanan:
- **Nama Paket**: Ditentukan dalam bentuk teks & angka (contoh: `HOME 20 Mbps`, `BISNIS 50 Mbps`).
- **Tagihan (Rp)**: Besaran tarif bulanan dalam format angka nominal murni (contoh: `250000`).
- **Kapasitas Bandwidth**: Alokasi bandwidth (contoh: `20 Mbps Simetris`).
- **Profile MikroTik**: Nama profil PPP secret di router MikroTik yang memiliki limitasi *rate-limit* rx/tx.

### 2. Registrasi Pelanggan Baru:
- **Nama Pelanggan** (Wajib): Nama lengkap pelanggan.
- **Nomor KTP / NIK** (Wajib): 16 digit NIK KTP format angka.
- **Alamat Pelanggan** (Wajib): Teks alamat fisik atau koordinat titik Google Maps.
- **Nomor WhatsApp/HP** (Wajib): Format nomor numerik aktif (contoh: `08123456789`).
- **Email Pelanggan** (Opsional): Alamat email pelanggan.
- **Layanan / Paket** (Wajib): Dropdown otomatis dari database *Setting Paket Layanan*.
- **Distribusi ODP** (Dropdown GIS): Terhubung langsung ke titik ODP / FAT dari Map FTTH GIS.
- **Serial Number (SN) ONT**: Format teks & angka (contoh: `ZTEGC88A1234`).
- **Model ONT**: Tipe perangkat CPE (contoh: `ZTE F609`, `Huawei HG8245H`).
- **PPPoE Username & Password**: Kredensial akun untuk autentikasi di MikroTik.

### 3. Aksi Operasional Pelanggan:
- **Isolir (MikroTik API)**:
  1. Mengubah *profile* pada `/ppp/secret` menjadi `profile=isolir`.
  2. Menambahkan catatan/komentar pada akun secret dengan format `comment="isolir/YYYY-MM-DD HH:MM:SS"`.
  3. Memutuskan koneksi aktif pada `/ppp/active` berdasarkan username PPPoE pelanggan secara instan.
- **Buka Isolir (MikroTik API)**:
  1. Mengembalikan *profile* secret ke paket layanan normal semula.
  2. Menghapus komentar isolir dari MikroTik.
- **Kirim Pengingat Tagihan (WhatsApp API)**:
  - Membuat format pesan tagihan resmi siap kirim beserta rincian nama, nomor pelanggan, paket, total tagihan, dan nomor rekening pembayaran via link `https://wa.me/`.
- **Tampilkan Lokasi di Google Maps**:
  - Melakukan navigasi otomatis (*pan & zoom*) ke titik koordinat rumah pelanggan dan menyorot tarikan kabel dropcore ke ODP terdekat.

---

## 12. Panduan Operasional Map FTTH GIS & Telemetri Realtime ONT

Modul GIS FTTH menyediakan visualisasi penempatan tiang ODP, ODC, OLT, dan tarikan kabel dropcore ke rumah pelanggan:

### 1. Lapisan Peta Google Maps Platform:
- Pilihan layer satelit beresolusi tinggi: **Google Satelit (Hybrid)**, **Google Roadmap (Jalan)**, dan **Google Kontur (Terrain)**.
- Dukungan `@vis.gl/react-google-maps` dengan penanda *Advanced Marker* dan garis vektor *Polyline* multi-segmen.

### 2. Telemetri Realtime ONT (11 Parameter Aktual):
1. **Power TX & RX (dBm)**: Dibaca langsung dari GenieACS TR-069 via NBI REST API.
2. **Model & Vendor**: Informasi pabrikan dan model ONT dari GenieACS.
3. **Suhu Operasional (°C)**: Monitoring suhu internal ONT (batas normal < 65°C).
4. **Tegangan Suplai (Volt)**: Stabilitas voltase DC modul optik ONT (normal ~3.3V).
5. **WiFi SSID**: Nama SSID nirkabel aktif di rumah pelanggan.
6. **Klien Aktif**: Jumlah perangkat gadget (laptop/HP) yang sedang terkoneksi ke WiFi ONT.
7. **Status Aktif OLT (Working / LOS / Dying Gasp)**: Di-query melalui SNMP OID pada OLT ZTE C320 (`zxAnPonOnuStatus`).
8. **Interface PON**: Port interface PON pada OLT ZTE C320 (contoh: `gpon-olt_1/1/2:4`).
9. **IP Address**: Alamat IP aktual ONT dari GenieACS.
10. **Latency ICMP Ping**: Laju latensi paket ICMP dari server ke IP ONT beserta persentase *packet loss*.
11. **MAC Address**: Alamat fisik antarmuka ONT.

### 3. Kontrol Operasional Peta:
- **Tombol Undo & Redo**: Membatalkan atau mengaplikasikan ulang perubahan posisi tiang, penambahan node, atau rute kabel (Shortcut: `Ctrl+Z` dan `Ctrl+Y`).
- **Tombol Delete**: Menghapus objek node ODP/ODC/OLT atau rute kabel dari database secara aman.
- **Tombol Search**: Mencari kode atau nama ODP, ODC, OLT, atau pelanggan dengan animasi *fly-to* langsung ke lokasi.


