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

## 10. Solusi: Login Berhasil Tapi Terlempar Kembali ke Halaman Login

Jika login berhasil (username dan password benar) namun browser langsung mengembalikan Anda ke halaman login:

### Penyebab Teknis:
1. **Nginx Header Authorization Stripping**: Secara default, Nginx tidak meneruskan HTTP Header `Authorization` (yang memuat token JWT) ke PHP-FPM jika directive `fastcgi_param HTTP_AUTHORIZATION $http_authorization;` belum ditambahkan di file konfigurasi Nginx. Akibatnya, request validasi `/api/auth/me` mengembalikan status `401 Unauthorized` sehingga frontend membersihkan token dan kembali ke portal login.
2. **Duplikasi Validasi Session**: Pada kode frontend sebelumnya, pemanggilan `checkStatus()` sesaat setelah login memicu validasi ulang yang terputus jika header terpotong.

### Solusi:
1. Pastikan baris `fastcgi_param HTTP_AUTHORIZATION $http_authorization;` telah ada di blok `/api` Nginx Anda:
   ```nginx
   location ^~ /api {
       fastcgi_pass unix:/var/run/php/php8.3-fpm.sock;
       fastcgi_index index.php;
       fastcgi_param SCRIPT_FILENAME /var/www/transdata-nms/backend/public/index.php;
       fastcgi_param HTTP_AUTHORIZATION $http_authorization;
       include fastcgi_params;
       fastcgi_read_timeout 60s;
   }
   ```
2. Salin pembaruan backend dan build frontend:
   ```bash
   sudo cp backend/nginx-transdata.conf /etc/nginx/sites-available/transdata-nms
   sudo cp backend/public/index.php /var/www/transdata-nms/backend/public/index.php
   sudo cp backend/src/Auth.php /var/www/transdata-nms/backend/src/Auth.php
   sudo cp -r dist/* /var/www/transdata-nms/dist/
   sudo nginx -t && sudo systemctl restart nginx php8.3-fpm
   ```


