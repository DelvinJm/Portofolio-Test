# Delvin Junior Moto — Portfolio

Single-page portfolio berbahasa Indonesia menggunakan **HTML5, Tailwind CSS via CDN, FontAwesome, dan JavaScript murni**. Buka `index.html` di browser; tidak perlu React, npm, atau build. Akses internet diperlukan untuk stylesheet ikon dan Tailwind CDN.

## Isi halaman

1. Navbar fixed-top dengan menu seluler.
2. About Me: nama dengan gradasi, slot foto, biografi, dan fokus Full-Stack, DevOps, serta Linux.
3. Journey: SD, SMP, SMK Teknik Komputer dan Jaringan, serta S1 Teknik Informatika di Institut Teknologi Sains Bandung.
4. Tech Arsenal: setup ROG Strix, periferal Pressplay/Ajazz, audio Equalizer APO, dan homelab Debian, Ollama, Zabbix, serta MikroTik.
5. Certificates: AWS/Dicoding, DBS Foundation, serta internship PT Wahana Internet Nusantara dan PT Tri Centrum Fortuna.
6. Contact: GitHub, Instagram, TikTok, WhatsApp, email, dan Saweria.

## Struktur

```text
index.html                # HTML, konfigurasi tema Tailwind, dan CSS tambahan
assets/content.js         # URL gambar, video, sertifikat, slider, dan kontak
assets/main.js            # Menu, pemuatan media, dan slider
assets/favicon.svg
assets/favicon.png        # Fallback favicon DM, 48×48
assets/apple-touch-icon.png # Ikon DM untuk perangkat Apple, 180×180
assets/og-image.png       # Thumbnail berbagi tautan, 1200×630
assets/placeholder.svg
tests/slider.cjs          # Pemeriksaan perilaku slider tanpa dependensi
```

## Slider

Foto pertama yang valid dimuat di awal. Foto berikutnya diberi `loading="lazy"` dan URL `src` baru dipasang ketika foto dipilih melalui kontrol atau autoplay, sehingga seluruh galeri tidak diunduh sekaligus. Foto yang sedang tampil tetap terlihat selama foto berikutnya dimuat.

Autoplay mencoba foto berikutnya setiap **5 detik** selama ada minimal dua URL foto yang belum dinyatakan gagal. Foto rusak atau melewati batas waktu pemuatan dilewati; indikator dan kontrol menyesuaikan jumlah foto yang tersisa. Tersedia kontrol sebelumnya/berikutnya, indikator foto, dan jeda. Autoplay berhenti saat tab tidak aktif, pointer atau fokus berada pada slider, dan saat pengguna mengaktifkan preferensi reduced motion.

Jalankan pemeriksaan perilaku slider dengan `node tests/slider.cjs` dari direktori repo.

## Preview tautan & favicon

Metadata OpenGraph dan Twitter Card berada langsung di `<head>` agar judul, deskripsi, dan thumbnail bisa dibaca crawler tanpa JavaScript. Thumbnail PNG 1200×630 tersedia di `assets/og-image.png`; favicon memakai inisial **DM** dengan versi SVG, PNG, dan Apple touch icon. Tautan tab baru, termasuk kontak dan sertifikat yang diisi melalui JavaScript, memakai `rel="noopener noreferrer"`.

URL publik yang dipakai adalah `https://delvinjm.github.io/Portofolio-Test/`. Jika pindah domain, perbarui `canonical`, `og:url`, `og:image`, `og:image:secure_url`, dan `twitter:image` di `index.html`. Preview WhatsApp/Discord dapat menyimpan cache versi lama setelah pembaruan.

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
