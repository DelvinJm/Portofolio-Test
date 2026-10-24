/*
 * Isi URL media asli di sini. Biarkan string kosong jika media belum tersedia.
 * Gunakan URL HTTPS atau lokasi relatif, misalnya "assets/images/profil.jpg".
 * Video highlight menggunakan file video langsung (MP4), bukan URL halaman YouTube.
 * Foto magang: tambahkan objek { src: "URL-foto", alt: "Deskripsi foto" }.
 * Slider berjalan setiap 5 detik jika setidaknya dua foto berhasil dimuat.
 */
window.PORTFOLIO_CONTENT = {
  images: {
    profile: '',
    'journey-sd': '',
    'journey-smp': '',
    'journey-smk': '',
    'journey-s1': '',
    'cert-aws': '',
    'cert-dbs': '',
  },
  highlightVideo: '',
  videoPoster: '',
  internships: {
    wahana: [],
    triCentrum: [],
  },
  contacts: {
    // Isi tautan lengkap, misalnya https://wa.me/62xxxxxxxxxxx.
    whatsapp: 'https://wa.me/6285888334984',
    // Isi URL halaman Saweria Anda, bukan nama pengguna saja.
    saweria: 'https://saweria.co/satooo',
  },
  certificates: {
    // Tautan verifikasi atau file sertifikat asli.
    aws: '',
    dbs: '',
  },
};
