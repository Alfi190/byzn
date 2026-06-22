# Ensiklopedia Interaktif Sejarah Kekaisaran Bizantium

Ensiklopedia digital interaktif ini menyajikan informasi komprehensif mengenai sejarah Kekaisaran Romawi Timur (Bizantium) dari tahun 330 M hingga kejatuhannya pada tahun 1453 M. Situs web ini dirancang dengan estetika premium bergaya kekaisaran Romawi Timur, menggunakan kombinasi warna ungu istana (imperial purple) dan emas metalik.
LIVE PREVIEW: https://alfi190.github.io/byzn/

## Fitur Utama

### 1. Peta Perubahan Wilayah Interaktif
* Representasi visual garis pantai Mediterania yang realistis menggunakan kurva Bezier SVG.
* Kontrol interaktif berdasarkan abad (dari abad ke-4 hingga abad ke-15) yang menampilkan pasang surut wilayah kekuasaan Bizantium secara dinamis.
* Titik kota bersejarah (seperti Konstantinopel, Roma, Ravenna, Kartago, Thessaloniki, Efesus, dan Syracuse) yang bersinar dengan efek denyut (pulsing glow).
* Ornamen kartografi klasik seperti kompas mata angin (Compass Rose) dan legenda peta adaptif.

### 2. Database Lengkap Kaisar Bizantium
* Tabel komprehensif seluruh kaisar yang memerintah dari tahun 306 M hingga 1453 M menggunakan pustaka DataTables.
* Fitur pencarian instan, penyaringan berdasarkan dinasti, dan pengurutan dinamis berdasarkan kolom.
* Halaman profil detail kaisar yang mencakup biografi lengkap, pencapaian militer, kebijakan ekonomi, silsilah keluarga, serta fakta menarik.

### 3. Bagan Silsilah Dinasti
* Visualisasi pohon keluarga dinasti yang menggambarkan hubungan kronologis suksesi kekuasaan antardinasti utama.
* Integrasi tautan navigasi langsung ke profil dinasti tertentu.

### 4. Linimasa Peristiwa (Milestones)
* Garis waktu interaktif yang memetakan sepuluh titik balik paling menentukan dalam sejarah 1.000 tahun kekaisaran.
* Desain kartu linimasa premium dengan batas emas gradasi dan efek hover melayang.

### 5. Dasbor Statistik & Diagram
* Visualisasi data statistik status akhir kaisar (turun takhta, wafat alami, dibunuh, dll.) menggunakan Doughnut Chart (Chart.js).
* Diagram batang horizontal yang menunjukkan distribusi jumlah kaisar per dinasti (Chart.js).

### 6. Desain Adaptif & Premium
* **Mode Terang & Gelap**: Dukungan transisi tema global yang mulus, termasuk adaptasi otomatis warna tabel, bagan, dan peta.
* **Bendera Byzantine**: Penggunaan bendera kekaisaran Bizantium (tetrabasileion) bergradasi emas metalik dalam bentuk SVG murni pada logo navigasi, footer, dan lencana utama di halaman beranda.
* **Estetika Akademis Formal**: Desain bersih bebas emoji, digantikan dengan ikon FontAwesome dan visualisasi SVG berkualitas tinggi untuk menjaga suasana edukasi yang formal.

## Teknologi yang Digunakan

* **Kerangka Dasar**: HTML5 (Struktur Semantik) & CSS3 (Gaya & Animasi Kustom).
* **Gaya Antarmuka**: Bootstrap 5.3 (Tata Letak Responsif & Utilitas).
* **Pemrosesan Logika**: Vanilla JavaScript (ES6+).
* **Visualisasi Data**: Chart.js (Grafik & Bagan).
* **Penyajian Tabel**: DataTables (Tabel Data Interaktif).
* **Ikon**: FontAwesome 6 (Ikon Vektor).

## Cara Menjalankan Proyek Secara Lokal

1. Unduh atau klon repositori ini.
2. Jalankan server lokal di dalam direktori proyek (misalnya menggunakan ekstensi Live Server di VS Code).

## Struktur Berkas

* `index.html` - Halaman utama dan struktur navigasi.
* `css/style.css` - Desain sistem, variabel warna tema, tata letak glassmorphism, dan animasi.
* `js/app.js` - Logika perutean halaman (routing), inisialisasi tema, penanganan pencarian, dan pembuatan grafik.
* `js/data.js` - Basis data statis kaisar, dinasti, peta, dan referensi akademik.
* `js/utils.js` - Fungsi pembantu untuk manipulasi data kronologi kaisar.
