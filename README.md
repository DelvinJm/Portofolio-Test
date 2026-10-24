# Delvin Junior Moto — Portfolio

Single-page portfolio berbahasa Indonesia menggunakan **HTML5, Tailwind CSS via CDN, FontAwesome, dan JavaScript murni**. Buka `index.html` di browser; tidak perlu React, npm, atau build. Akses internet diperlukan untuk stylesheet ikon dan Tailwind CDN.

## Isi halaman

1. Navbar fixed-top dengan menu seluler.
2. About Me: nama dengan gradasi, slot foto, biografi, dan fokus Full-Stack, DevOps, serta Linux.
3. Journey: SD, SMP, SMK Teknik Komputer dan Jaringan, serta S1 Teknik Informatika di Institut Teknologi Sains Bandung.
4. Interests: slot video highlight dan minat teknis.
5. Certificates: AWS/Dicoding, DBS Foundation, serta internship PT Wahana Internet Nusantara dan PT Tri Centrum Fortuna.
6. Contact: GitHub, Instagram, TikTok, WhatsApp, email, dan Saweria.

## Struktur

```text
index.html                # HTML, konfigurasi tema Tailwind, dan CSS tambahan
assets/content.js         # URL gambar, video, sertifikat, slider, dan kontak
assets/main.js            # Menu, pemuatan media, dan slider
assets/favicon.svg
assets/placeholder.svg
```

## Slider

Foto berganti setiap **5 detik** saat minimal dua gambar berhasil dimuat. Tersedia kontrol sebelumnya/berikutnya, indikator foto, dan jeda. Autoplay berhenti saat tab tidak aktif, pointer atau fokus berada pada slider, dan saat pengguna mengaktifkan preferensi reduced motion. Gambar kosong/rusak tidak menjadi slide.

## Tema

| Token | Warna |
| --- | --- |
| Background | `#F0F0F0` |
| Primary | `#0179FB` |
| Secondary | `#21C7E8` |
| Accent | `#03DFFF` |
| Dark | `#1F2937` |

## GitHub Pages

Struktur file sudah memakai path relatif untuk GitHub Pages. Jika ingin menerbitkan, buka **Settings → Pages → Deploy from a branch**, pilih **main** dan **/(root)**. Penyimpanan kode ke GitHub tidak otomatis mengaktifkan GitHub Pages.

Referensi dependensi: [Tailwind Play CDN](https://tailwindcss.com/docs/installation/play-cdn), [FontAwesome di cdnjs](https://cdnjs.com/libraries/font-awesome).
