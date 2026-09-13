# Versioning

Satu angka untuk seluruh kotak, di [`package.json`](../package.json). Sekarang `0.3.0`.

Ikut [SemVer](https://semver.org/). Di **0.x**, minor boleh breaking. Major `1.0.0` = janji stabil + (mungkin) npm.

## Apa yang dihitung

| Perubahan | 0.x | ≥ 1.0 |
|---|---|---|
| Bugfix, docs, tes, detector yang tidak menambah kind baru | patch | patch |
| Tool baru, flag baru, kind detector baru | minor | minor |
| Ubah arti exit code, hapus flag, ubah format output yang di-parse | minor | **major** |
| Terbit npm pertama kali | — | `1.0.0` (atau tetap 0.x + `private: false`, keputusan rilis) |

Detector baru = minor, bukan patch: CI yang kemarin hijau bisa jadi `bukan sip`.

`jejak` dan `han.sip` naik versi **bersama**. Tidak ada versi per-tool.

## Tag

Tag git = `v` + angka `package.json`.

```text
package.json  0.3.0
git tag       v0.3.0
GitHub Release v0.3.0
```

Jangan tag kalau angka di `package.json` belum diganti.

## Changelog

User-facing masuk [CHANGELOG.md](../CHANGELOG.md) di `[Unreleased]`, pindah ke versi saat rilis. Docs-only boleh patch. Lihat [RELEASE.md](RELEASE.md).
