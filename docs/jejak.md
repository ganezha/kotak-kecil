# jejak — desain

Satu tugas: hitung commit per hari di repo ini, gambar kotak. Graph baru **berarti** di hari ke-2.

Satu file: [jejak/cli.mjs](../jejak/cli.mjs).

## Data

```bash
git log --all --pretty=format:%as --since='YYYY-MM-DD 00:00'
```

`%as` = author date, `YYYY-MM-DD`, zona waktu lokal. Bukan GitHub contribution graph (itu UTC + email filter + default branch).

`--all`: semua ref. Commit di branch lain tetap kelihatan.

Repo tanpa commit, atau `git log` gagal: daftar kosong, graph tetap digambar, `0 commit · 0 hari hidup`. Bukan git repo / git tidak di PATH: exit 2.

## Jendela

Default 14. Argumen 1–366. Hari ini termasuk. Commit lebih lama dari jendela dibuang — tes `hari di luar jendela tidak dihitung`.

Midnight lokal: `setHours(0,0,0,0)`.

## Grid

Minggu mulai **Senin**. `senIndex = (getDay() + 6) % 7`. Padding kiri di minggu pertama supaya kolom `sen … min` lurus.

Sel:

- ` ` padding (bukan hari)
- `·` nol
- `1`–`9` jumlah
- `#` sepuluh atau lebih

Header selalu `sen sel rab kam jum sab min`.

Ringkasan: `N hari · C commit · H hari hidup`. Hidup = hari dengan ≥ 1 commit, bukan jumlah commit.

## Kenapa hari ke-2

Satu titik bukan pola. Dua hari berurutan baru kelihatan sebagai jejak. Itu kontrak tes, bukan slogan.

## Bukan

Bukan heatmap GitHub. Bukan streak coach. Tidak nulis commit, tidak `--amend`, tidak filter author. Tidak warna: terminal biasa.
