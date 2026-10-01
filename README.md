# Transdata NMS — ISP Network Management System & GIS FTTH

Enterprise Network Management System (NMS) dan GIS Pemetaan Jaringan Fiber Optik FTTH untuk operasional ISP Transdata.

Aplikasi ini dibangun untuk operasional nyata penyedia jasa internet (ISP) dengan arsitektur **Zero Mock / Pure Real Data**:
- **Bukan simulasi, bukan mockup, dan tanpa data dummy.**
- Membaca data perangkat nyata melalui **Net-SNMP CLI** (`snmpget`, `snmpwalk`).
- Menjalankan **ICMP Ping nyata** dari backend server dengan pelaporan latensi aktual (*min/avg/max/mdev*) dan *packet loss*.
- Menguji koneksi soket TCP **MikroTik RouterOS API** (Port 8728 / 8729 SSL) dan manajemen isolir pelanggan.
- Integrasi **GenieACS NBI REST API** untuk inventaris CPE/ONT, pembacaan *optical power* (RX/TX dBm), serta eksekusi task *refresh/reboot*.
- Modul **GIS FTTH Interaktif** berbasis Leaflet dengan penyimpanan ke MariaDB, rute kabel *multi-vertex*, perhitungan panjang geodesik nyata (*Haversine formula*), dan *Analisis Dampak Gangguan (Impact Analysis)* ke pelanggan *downstream*.

---

## Daftar Isi

1. [Arsitektur Sistem](#1-arsitektur-sistem)
2. [Struktur Direktori Proyek](#2-struktur-direktori-proyek)
3. [Fitur Utama](#3-fitur-utama)
4. [Persyaratan Sistem (Server Prerequisites)](#4-persyaratan-sistem-server-prerequisites)
5. [Tutorial Instalasi Lengkap pada Ubuntu Server 22.04 / 24.04 LTS](#5-tutorial-instalasi-lengkap-pada-ubuntu-server-2204--2404-lts)
   - [Langkah 1: Update Sistem & Instalasi Dependensi Dasar](#langkah-1-update-sistem--instalasi-dependensi-dasar)
   - [Langkah 2: Instalasi PHP 8.3 & Ekstensi yang Dibutuhkan](#langkah-2-instalasi-php-83--ekstensi-yang-dibutuhkan)
   - [Langkah 3: Konfigurasi Database MariaDB](#langkah-3-konfigurasi-database-mariadb)
   - [Langkah 4: Deploy Backend PHP API](#langkah-4-deploy-backend-php-api)
   - [Langkah 5: Build & Deploy Frontend React](#langkah-5-build--deploy-frontend-react)
   - [Langkah 6: Konfigurasi Nginx Web Server](#langkah-6-konfigurasi-nginx-web-server)
   - [Langkah 7: Konfigurasi SSL Let's Encrypt (Opsional tapi Direkomendasikan)](#langkah-7-konfigurasi-ssl-lets-encrypt-opsional-tapi-direkomendasikan)
   - [Langkah 8: Setup Background Poller Daemon (systemd)](#langkah-8-setup-background-poller-daemon-systemd)
   - [Langkah 9: Verifikasi Net-SNMP, Ping & Hak Akses CLI](#langkah-9-verifikasi-net-snmp-ping--hak-akses-cli)
   - [Langkah 10: Inisialisasi Akun Superadmin Pertama](#langkah-10-inisialisasi-akun-superadmin-pertama)
6. [Panduan Integrasi Perangkat Jaringan](#6-panduan-integrasi-perangkat-jaringan)
   - [A. Konfigurasi SNMP pada MikroTik RouterOS](#a-konfigurasi-snmp-pada-mikrotik-routeros)
   - [B. Konfigurasi SNMP pada OLT ZTE / Huawei / VSOL](#b-konfigurasi-snmp-pada-olt-zte--huawei--vsol)
   - [C. Integrasi GenieACS NBI](#c-integrasi-genieacs-nbi)
7. [Panduan Modul GIS FTTH](#7-panduan-modul-gis-ftth)
8. [Pemeliharaan & Troubleshooting](#8-pemeliharaan--troubleshooting)

---

## 1. Arsitektur Sistem

```
[ Browser Desktop / Tablet / HP Android ]
                    │
                    ▼ HTTP/HTTPS (Port 80/443)
       ┌─────────────────────────┐
       │   Nginx Reverse Proxy   │
       └────────────┬────────────┘
                    │
       ┌────────────┴───────────────────────────┐
       │                                        │
       ▼ (File Statis)                          ▼ (API Request /api/*)
[ Frontend SPA (dist/) ]                [ PHP-FPM 8.3 / REST API ]
  - React 19 + TypeScript                 - Transdata\Nms\Auth
  - Tailwind CSS + Lucide Icons           - Transdata\Nms\PingService
  - Leaflet GIS FTTH Map                  - Transdata\Nms\SnmpService
                                          - Transdata\Nms\MikrotikService
                                          - Transdata\Nms\GenieAcsService
                                          - Transdata\Nms\GisService
                                                │
       ┌────────────────┬───────────────────────┼─────────────────────────┐
       ▼                ▼                       ▼                         ▼
 [ MariaDB Database ] [ Net-SNMP CLI ] [ MikroTik RouterOS API ] [ GenieACS NBI ]
  - devices / users    - snmpget/walk    - Port 8728 TCP Socket   - Port 7557 REST
  - ftth_objects/cable - OID Traffic     - IP Address-List        - TR-069 CPE/ONT
  - traffic_samples    - Uptime/Descr    - Resource Print         - Optical RX/TX
```

---

## 2. Struktur Direktori Proyek

```
transdata-nms/
├── database/
│   ├── schema.sql              # DDL MariaDB untuk perangkat, user, alarm, audit
│   ├── ftth_gis_schema.sql     # DDL MariaDB untuk node FTTH, kabel, splitter, port
│   └── seed_initial.sql        # Data role standar ISP dan pengaturan awal
├── backend/
│   ├── config/
│   │   ├── config.example.php  # Template konfigurasi tanpa kredensial
│   │   └── config.php          # Konfigurasi aktif server produksi
│   ├── src/
│   │   ├── Database.php        # MariaDB PDO singleton & prepared statements
│   │   ├── Auth.php            # Autentikasi JWT, password_hash, dan RBAC
│   │   ├── PingService.php     # Eksekutor ICMP ping nyata & parser latensi
│   │   ├── SnmpService.php     # Net-SNMP CLI wrapper & kalkulator laju bps
│   │   ├── MikrotikService.php # Klien RouterOS API TCP socket
│   │   ├── GenieAcsService.php # Klien REST GenieACS NBI & optical power
│   │   ├── GisService.php      # CRUD FTTH, Haversine geodesic, impact trace
│   │   └── AuditLogger.php     # Pencatatan audit trail operasional
│   ├── public/
│   │   └── index.php           # Front controller & REST API router
│   ├── cli/
│   │   └── poller.php          # Poller background worker berkala
│   ├── nginx-transdata.conf    # Konfigurasi virtual host Nginx produksi
│   ├── php-fpm-transdata.conf  # Konfigurasi pool PHP-FPM
│   └── transdata-poller.service# Systemd service unit untuk background poller
├── src/                        # Sumber kode Frontend React + TypeScript
│   ├── components/             # Navbar, Sidebar, StatusBadge, Modal, EmptyState
│   ├── pages/                  # Dashboard, Devices, Detail, MikroTik, GenieACS, GIS
│   ├── services/api.ts         # REST API Client ke backend
│   └── types/                  # Definisi antarmuka TypeScript (NMS & GIS)
├── docs/
│   └── INSTALLATION_UBUNTU.md  # Panduan deployment Ubuntu server ringkas
├── server.ts                   # Full-stack runner untuk development dev server
├── package.json
└── vite.config.ts
```

---

## 3. Fitur Utama

- **Zero Mock / Actual Hardware Monitoring**: Seluruh data yang tampil adalah hasil pembacaan perangkat sesungguhnya. Jika perangkat belum ditambahkan, aplikasi menampilkan *empty state* yang informatif.
- **Pemisahan Status Ping vs SNMP**: Perangkat dapat berstatus Ping `ONLINE` namun SNMP `ERROR` jika *community string* salah atau port 161 terblokir.
- **Kalkulasi Laju Trafik Presisi**:
  $$\text{rate bps} = \frac{\Delta \text{ octets} \times 8}{\Delta t \text{ (detik)}}$$
  Memperhitungkan *reboot*, *counter wrap 64-bit*, dan memastikan sampel pertama hanya mencatat counter fisik tanpa mengarang laju bps.
- **Pemetaan GIS FTTH Lengkap**:
  - Tipe Node: OLT, ODC, ODP, FAT, Tiang, Handhole, Pelanggan, Joint Closure, POP.
  - Tambah node dengan klik peta, pindahkan posisi dengan *drag-and-drop* langsung tersimpan ke MariaDB.
  - Gambar jalur kabel *multi-vertex* dengan perhitungan panjang geodesik nyata (*Haversine*).
  - *Analisis Dampak Gangguan (Impact Analysis)*: Menelusuri seluruh pelanggan terdampak jika suatu ODC/ODP/Kabel mengalami gangguan.
- **Keamanan Enterprise**: Proteksi *command injection* saat pemanggilan CLI, *password hashing* bcrypt/sha256, *rate limiting*, *token session*, dan *audit log* komprehensif.

---

## 4. Persyaratan Sistem (Server Prerequisites)

| Komponen | Spesifikasi Minimum | Rekomendasi Produksi |
|---|---|---|
| **Sistem Operasi** | Ubuntu 22.04 LTS / 24.04 LTS (x86_64) | Ubuntu 22.04 LTS / Debian 12 |
| **CPU** | 2 vCPU | 4 vCPU |
| **RAM** | 2 GB | 4 GB - 8 GB |
| **Penyimpanan** | 20 GB SSD | 50 GB NVMe SSD |
| **Jaringan** | 1 Gbps NIC terhubung ke Management VLAN | Dual NIC (Management + Public WAN) |

---

## 5. Tutorial Instalasi Lengkap pada Ubuntu Server 22.04 / 24.04 LTS

Jalankan perintah berikut dengan hak akses `root` atau `sudo`.

### Langkah 1: Update Sistem & Instalasi Dependensi Dasar

```bash
sudo apt update && sudo apt upgrade -y

# Instal Web Server, Database, Net-SNMP CLI, dan Network Tools
sudo apt install -y nginx mariadb-server snmp snmp-mibs-downloader iputils-ping \
                    curl git ufw software-properties-common ca-certificates lsb-release
```

Download dan aktifkan MIB standar Net-SNMP (opsional untuk resolusi nama OID):
```bash
sudo download-mibs
# Nonaktifkan baris 'mibs :' pada konfigurasi snmp jika ada:
sudo sed -i 's/^mibs :/# mibs :/g' /etc/snmp/snmp.conf
```

### Langkah 2: Instalasi PHP 8.3 & Ekstensi yang Dibutuhkan

Tambahkan repositori resmi PHP Ondřej Surý:
```bash
sudo add-apt-repository ppa:ondrej/php -y
sudo apt update

# Instal PHP 8.3 FPM, CLI, dan ekstensi pendukung
sudo apt install -y php8.3-fpm php8.3-cli php8.3-mysql php8.3-curl \
                    php8.3-mbstring php8.3-xml php8.3-zip php8.3-opcache
```

Verifikasi instalasi PHP dan Net-SNMP:
```bash
php -v
# Output harus: PHP 8.3.x

snmpget -V
# Output harus: NET-SNMP version: 5.9.x

ping -c 1 127.0.0.1
# Output: 0% packet loss
```

Pastikan service PHP-FPM aktif:
```bash
sudo systemctl enable --now php8.3-fpm
sudo systemctl status php8.3-fpm
```

### Langkah 3: Konfigurasi Database MariaDB

Amankan instalasi database:
```bash
sudo mysql_secure_installation
```
*(Ikuti instruksi, pilih opsi untuk mengatur password root, hapus anonymous user, dan larang remote root login).*

Masuk ke MariaDB untuk membuat database dan pengguna khusus Transdata NMS:
```bash
sudo mysql -u root -p
```

Eksekusi perintah SQL berikut:
```sql
CREATE DATABASE transdata_nms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'transdata_user'@'localhost' IDENTIFIED BY 'GantiDenganPasswordSangatKuat_2026!';
GRANT ALL PRIVILEGES ON transdata_nms.* TO 'transdata_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Clone atau salin repository project ke server:
```bash
sudo mkdir -p /var/www/transdata-nms
cd /var/www/transdata-nms
# Salin file proyek Anda ke direktori ini (misal via git atau scp)
# sudo git clone https://github.com/transdata/transdata-nms.git .
```

Impor seluruh skema database:
```bash
cd /var/www/transdata-nms
mysql -u transdata_user -p transdata_nms < database/schema.sql
mysql -u transdata_user -p transdata_nms < database/ftth_gis_schema.sql
mysql -u transdata_user -p transdata_nms < database/seed_initial.sql
```

*Catatan: Tidak ada akun administrator default (seperti admin/admin) yang dibuat otomatis. Akun Superadmin dibuat secara aman saat pertama kali web dibuka di browser.*

### Langkah 4: Deploy Backend PHP API

Buat file konfigurasi aktif `backend/config/config.php`:
```bash
sudo cp /var/www/transdata-nms/backend/config/config.example.php /var/www/transdata-nms/backend/config/config.php
sudo nano /var/www/transdata-nms/backend/config/config.php
```

Sesuaikan nilai koneksi database dan kredensial:
```php
<?php
return [
    'db' => [
        'host'     => '127.0.0.1',
        'port'     => 3306,
        'database' => 'transdata_nms',
        'username' => 'transdata_user',
        'password' => 'GantiDenganPasswordSangatKuat_2026!', // sesuaikan dengan password di Langkah 3
        'charset'  => 'utf8mb4'
    ],
    'app' => [
        'name'            => 'Transdata NMS',
        'env'             => 'production',
        'url'             => 'http://IP_SERVER_ANDA',
        'jwt_secret'      => bin2hex(random_bytes(32)), // buat random string aman
        'session_lifetime'=> 86400,
        'encryption_key'  => bin2hex(random_bytes(16))
    ],
    'snmp' => [
        'binary_path'       => '/usr/bin/snmpget',
        'walk_binary'       => '/usr/bin/snmpwalk',
        'default_community' => 'public',
        'default_version'   => 'v2c',
        'timeout_sec'       => 3,
        'retries'           => 2
    ],
    'ping' => [
        'binary_path'   => '/bin/ping',
        'default_count' => 4,
        'timeout_sec'   => 5
    ],
    'genieacs' => [
        'nbi_url'     => 'http://127.0.0.1:7557', // sesuaikan jika GenieACS berada di server lain
        'timeout_sec' => 5
    ]
];
```

Uji sintaks seluruh script PHP:
```bash
for f in /var/www/transdata-nms/backend/src/*.php /var/www/transdata-nms/backend/public/*.php; do
    php -l "$f"
done
# Seluruh file harus menghasilkan: No syntax errors detected
```

### Langkah 5: Build & Deploy Frontend React

Instal Node.js LTS (v20 atau v22) pada mesin build atau langsung di server:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Masuk ke folder proyek, instal paket npm, dan jalankan build statis:
```bash
cd /var/www/transdata-nms
npm install
npm run build
```

Pastikan folder `/var/www/transdata-nms/dist` telah terbuat dan berisi `index.html` serta aset statis.

Atur kepemilikan file web ke pengguna web server `www-data`:
```bash
sudo chown -R www-data:www-data /var/www/transdata-nms
sudo chmod -R 755 /var/www/transdata-nms
```

### Langkah 6: Konfigurasi Nginx Web Server

Salin konfigurasi virtual host Nginx:
```bash
sudo cp /var/www/transdata-nms/backend/nginx-transdata.conf /etc/nginx/sites-available/transdata-nms
```

Buka dan sesuaikan `server_name`:
```bash
sudo nano /etc/nginx/sites-available/transdata-nms
```

Pastikan blok socket PHP-FPM mengarah ke versi PHP yang terinstal:
```nginx
fastcgi_pass unix:/var/run/php/php8.3-fpm.sock;
```

Aktifkan konfigurasi Nginx dan nonaktifkan default site:
```bash
sudo ln -sf /etc/nginx/sites-available/transdata-nms /etc/nginx/sites-enabled/transdata-nms
sudo rm -f /etc/nginx/sites-enabled/default

# Uji konfigurasi Nginx
sudo nginx -t
# Output harus: syntax is ok, test is successful

# Restart Nginx
sudo systemctl restart nginx
```

### Langkah 7: Konfigurasi SSL Let's Encrypt (Opsional tapi Direkomendasikan)

Jika server menggunakan domain publik (misal `nms.transdata.net.id`):
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d nms.transdata.net.id
```
Certbot akan otomatis memperbarui file konfigurasi Nginx untuk menggunakan protokol HTTPS (port 443).

### Langkah 8: Setup Background Poller Daemon (systemd)

Agar monitoring ICMP ping dan SNMP polling berjalan otomatis setiap menit di latar belakang:
```bash
sudo cp /var/www/transdata-nms/backend/transdata-poller.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now transdata-poller.service
sudo systemctl status transdata-poller.service
```

Untuk melihat log poller secara *real-time*:
```bash
journalctl -u transdata-poller.service -f
```

### Langkah 9: Verifikasi Net-SNMP, Ping & Hak Akses CLI

Pastikan user `www-data` dapat mengeksekusi `/bin/ping` dan `/usr/bin/snmpget`:
```bash
sudo -u www-data /bin/ping -c 1 127.0.0.1
sudo -u www-data /usr/bin/snmpget --version
```
Jika `ping` memerlukan permission setuid pada distro tertentu:
```bash
sudo chmod u+s /bin/ping
```

### Langkah 10: Inisialisasi Akun Superadmin Pertama

1. Buka browser Anda: `http://IP_SERVER_ANDA` atau `https://nms.transdata.net.id`
2. Sistem akan mendeteksi database bersih tanpa administrator dan langsung menampilkan layar:
   **"Inisialisasi Keamanan Pertama — Superadmin Transdata NMS"**
3. Masukkan:
   - Nama Lengkap (cth: *Administrator NOC Transdata*)
   - Username (cth: *nocadmin*)
   - Email NOC (cth: *noc@transdata.net.id*)
   - Password (minimal 8 karakter)
4. Klik **Aktifkan Superadmin Transdata**.
5. Sistem membuat akun Superadmin dan Anda langsung dapat masuk ke Dashboard operasional.

---

## 6. Panduan Integrasi Perangkat Jaringan

### A. Konfigurasi SNMP pada MikroTik RouterOS

Buka Terminal RouterOS (Winbox / SSH):
```routeros
# Aktifkan service SNMP
/snmp set enabled=yes contact="NOC Transdata" location="Data Center Transdata"

# Tambah SNMP Community Read-Only
/snmp community add name=public addresses=192.168.100.0/24 read-access=yes
```
*Ganti `192.168.100.0/24` dengan IP server NMS Anda untuk keamanan.*

### B. Konfigurasi SNMP pada OLT ZTE / Huawei / VSOL

#### ZTE C300 / C320:
```text
ZTE(config)# snmp-server enable
ZTE(config)# snmp-server community public view DefaultView ro
ZTE(config)# snmp-server host 192.168.100.50 version 2c public
```

#### Huawei MA5608T / MA5800:
```text
MA5608T(config)# snmp-agent
MA5608T(config)# snmp-agent sys-info version v2c
MA5608T(config)# snmp-agent community read public
MA5608T(config)# snmp-agent target-host host-name NMS address 192.168.100.50 udp-port 161 params securityname public v2c
```

### C. Integrasi GenieACS NBI

Jika GenieACS terinstal di server yang sama atau terpisah, pastikan file konfigurasi GenieACS mengizinkan request dari server NMS:
- Default URL GenieACS NBI: `http://127.0.0.1:7557`
- Uji endpoint dari terminal server NMS:
  ```bash
  curl -s http://127.0.0.1:7557/devices/ | head -n 20
  ```
- Masukkan URL ini di menu **Pengaturan Sistem (Settings)** pada dashboard Transdata NMS.

---

## 7. Panduan Modul GIS FTTH

1. **Navigasi Peta**:
   - Gunakan mouse untuk menggeser (*pan*) dan roda mouse untuk *zoom*.
   - Posisi koordinat Latitude dan Longitude kursor ditampilkan secara presisi di pojok kiri bawah.
2. **Menambah Node Jaringan (ODC, ODP, Tiang, Pelanggan)**:
   - Klik tombol toolbar **"Tambah Objek (Klik Peta)"**.
   - Klik pada titik lokasi yang diinginkan di peta.
   - Isi tipe objek, kode identitas (cth: `ODP-TDA-01`), nama, kapasitas port, dan node induk.
   - Klik **Simpan Objek**. Objek akan langsung tersimpan di database MariaDB.
3. **Mengubah Posisi Objek (Drag and Drop)**:
   - Cukup klik dan tahan *marker* objek di peta, geser ke titik koordinat baru, lalu lepas.
   - Posisi koordinat latitude/longitude baru langsung diupdate secara atomik ke backend API.
4. **Menggambar Rute Kabel**:
   - Klik tombol **"Gambar Kabel"**.
   - Klik beberapa titik di peta mengikuti jalur tiang atau jalan untuk membuat *polyline* rute.
   - Klik **Simpan Rute Kabel**.
   - Sistem secara otomatis menghitung panjang rute kabel dalam satuan meter menggunakan **Formula Geodesik Haversine** berdasarkan titik-titik koordinat nyata.
5. **Analisis Dampak Gangguan (Impact Analysis)**:
   - Klik pada salah satu node (misal ODC atau ODP).
   - Pada panel inspektur di sebelah kanan, klik **"Analisis Dampak Gangguan"**.
   - Sistem akan menelusuri seluruh hierarki *downstream* dan menampilkan daftar pelanggan yang terdampak beserta paket layanannya.

---

## 8. Pemeliharaan & Troubleshooting

### Memeriksa Status Layanan Utama
```bash
sudo systemctl status nginx
sudo systemctl status php8.3-fpm
sudo systemctl status mariadb
sudo systemctl status transdata-poller.service
```

### Memeriksa Log Error Nginx & PHP
```bash
# Nginx Error Log
sudo tail -f /var/log/nginx/error.log

# PHP-FPM Error Log
sudo tail -f /var/log/php8.3-fpm.log
```

### Troubleshooting: Status Perangkat Tertulis Offline / Unreachable
1. Uji ping manual dari command line server:
   ```bash
   ping -c 4 <IP_PERANGKAT>
   ```
2. Pastikan firewall di perangkat target mengizinkan paket ICMP echo request dari IP server NMS.
3. Jika status Ping Online tetapi SNMP Error:
   ```bash
   snmpget -v 2c -c public <IP_PERANGKAT> 1.3.6.1.2.1.1.1.0
   ```
   Jika muncul *Timeout: No Response*, periksa apakah port UDP 161 diizinkan dan *community string* sesuai.

### Backup Database MariaDB
Buat backup rutin secara berkala menggunakan `cron`:
```bash
sudo mysqldump -u transdata_user -p'PASSWORD_ANDA' transdata_nms > /backup/transdata_nms_$(date +%Y%m%d).sql
```

---

## Lisensi & Hak Cipta
Hak Cipta © 2026 ISP Transdata. Dikembangkan secara profesional untuk keandalan dan operasional jaringan fiber optik enterprise.
