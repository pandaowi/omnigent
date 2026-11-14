# Dokumentasi Perubahan Versi & Changelog: Origin vs. IPLabs

Dokumen ini menyajikan perbandingan komprehensif antara **versi resmi upstream (Omnigent Origin)** dan **versi kustom platform kita (IPLabs Agent Platform)**, mulai dari rilis basis `v0.21.0` hingga upgrade terbaru `v0.22.0`.

---

## 📌 1. Matriks Perbandingan Versi

| Parameter | Upstream Lama | Upstream Baru (Origin) | Versi Kustom Kita (IPLabs) |
|---|---|---|---|
| **Tag Versi** | `v0.21.0` | `v0.22.0` | **`v0.22.0-iplabs.1`** |
| **Tanggal Rilis** | 05 November 2026 | 12 November 2026 | **14 November 2026** |
| **Git Branch** | `upstream/main` | `upstream/release/v0.22.0` | `upgrade/v0.22.0-with-custom-features` |
| **Branding Identitas** | Omnigent | Omnigent | **IPLabs Agent Platform** (Imani Prima) |
| **Ekosistem Runner** | Local/Generic Sandboxes | Local/Generic Sandboxes | **Coder Workspaces Multi-Runner** (`frappe-dev`, `demo2`, dll.) |
| **Akses & Keamanan** | Admin / Non-Admin biasa | Admin / Non-Admin biasa | **3-Tier Enterprise RBAC** (Global Admin, Supervisor, Member) |
| **Isolasi Folder** | Shared Home Workspace | Shared Home Workspace | **Strict Path Jailing** (`~/workspaces/{divisi}/{username}`) |
| **Custom Agents** | List kustom standar | List kustom standar | **Multica-Style** (Live Runner Probe, Native Harness Codex/OpenCode/AGY) |
| **Kolaborasi Agen** | Eksekusi single agent | Single agent + basic nested | **Agent Teams Visual Builder** & Preset Kolaboratif |
| **Status Verifikasi** | Upstream CI | Upstream CI | **TypeScript: 0 Error \| Pytest: 100% \| Web Build: OK** |

---

## 🚀 2. Pembaruan Upstream Origin (`v0.21.0` ➔ `v0.22.0`)

Upstream menghadirkan **489 commit pembaruan** yang terbagi menjadi pembaruan besar (*Major*), pembaruan fitur (*Minor*), dan perbaikan stabilitas (*Bug Fixes & Performance*):

### A. Major Upgrades (Pembaruan Utama Arsitektur)

1. **Nested Sessions by Default (Sesi Agen Bertingkat Mandiri)**
   - **Apa ini:** Kemampuan agen untuk memecah tugas kompleks dan mendelegasikannya ke sub-agent otonom secara *native*.
   - **Keunggulan:** Sub-agent secara otomatis menggunakan checkout repositori, git branch, dan working directory yang sama (`#13579`), sehingga sub-agent tidak perlu melakukan clone ulang atau setting environment dari awal.

2. **Otonomi Agen dalam Manajemen Project & Sesi (`sys_session_update`, `sys_project_update`)**
   - **Apa ini:** Agen kini memiliki hak dan tool bawaan untuk mengorganisasi workspace kerja pengguna.
   - **Fungsi:** Agen dapat secara otomatis mengganti judul sesi agar sesuai konteks diskusi, menyematkan (*pin*) sesi penting, mengarsipkan sesi yang telah selesai, dan memindahkan sesi ke dalam folder project tertentu.

3. **AWS Lambda MicroVMs Sandbox Provider**
   - **Apa ini:** Penambahan modul provider runtime baru berbasis AWS Lambda MicroVMs (`lambda_microvm`).
   - **Fungsi:** Memungkinkan eksekusi sandbox komputasi cloud ephemeral dengan isolasi hardware tingkat tinggi tanpa membebani server lokal.

---

### B. Minor Upgrades & UX Improvements (Peningkatan Antarmuka)

1. **Interactive "Play" Action untuk Shell Snippet di Chat**
   - Setiap kali agen menampilkan kode perintah bash/shell di balon percakapan, muncul tombol interaktif **"Play"**.
   - Mengklik tombol ini akan langsung menempelkan dan mengeksekusi perintah tersebut ke terminal runner yang aktif tanpa perlu copy-paste manual.

2. **Edit Sent Message ke Composer**
   - Pengguna kini dapat mengklik tombol **Edit** pada prompt pesan yang sudah terkirim. Pesan akan ditarik kembali ke dalam kotak composer untuk disunting dan dikirim ulang.

3. **Live Status & Reconnect MCP Server di UI (`/mcp`)**
   - Halaman `/mcp` kini memantau status kesehatan koneksi setiap server MCP secara *real-time*.
   - Jika koneksi terputus, tersedia tombol **"Reconnect"** instan langsung dari halaman web tanpa perlu restart server atau runner daemon.

4. **Rendering Screenshot Workspace di Chat**
   - Tangkapan layar dari tool browser screenshot atau hasil rendering UI kini disajikan langsung dalam bentuk kartu thumbnail visual di percakapan.

5. **Navigasi Per-Commit & Review Persisten pada Pull Request**
   - Tab *Changes* kini mendukung navigasi diff commit-per-commit pada Pull Request yang aktif.
   - Status file yang sudah ditinjau (*viewed marks*) tetap tersimpan meskipun ada commit baru yang di-push ke PR.

6. **Pencarian File Lebih Cerdas**
   - Pencarian file di workspace kini mendukung opsi pencarian kata utuh (*Whole word*) dan algoritma ranking file berdasarkan bobot nama file yang relevan.

---

### C. Performance & Bug Fixes (Stabilitas Sistem)

1. **Offloading I/O Spawn Runner**: Operasi penulisan disk saat spawning proses runner kini dipisahkan dari async event loop utama, menjaga UI web tetap responsif saat agen menjalankan kompilasi program berat.
2. **Windowed Virtual Scrolling Sidebar**: Sidebar riwayat sesi menggunakan virtualisasi baris, sehingga membuka ratusan hingga ribuan riwayat chat tetap mulus tanpa lag memori.
3. **Peningkatan Memory & Budget Harness**: Perbaikan penanganan token budget dan recovery status pada Codex Native dan deduplikasi token report pada OpenCode 2.0.

---

## 🌟 3. Versi Kita Sendiri: Inovasi & Fitur Kustom IPLabs Platform

Di atas fondasi upstream, kita membangun **5 pilar inovasi kustom** yang disesuaikan khusus untuk kebutuhan enterprise Imani Prima dan integrasi Coder Workspaces:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        IPLABS AGENT PLATFORM (v0.22.0-iplabs.1)                        │
├──────────────────────────┬─────────────────────────────┬───────────────────────────────┤
│ 1. MULTICA CUSTOM AGENTS │ 2. 3-TIER ENTERPRISE RBAC   │ 3. AGENT TEAMS & KANBAN       │
│ - Runtime Host Selector  │ - Global Admin (Super)      │ - TeamCompositionCard UI      │
│ - Live Runner Model Probe│ - Supervisor (Kepala Divisi)│ - Preset Video Studio/Remotion│
│ - Native Codex/OpenCode  │ - Member (Staff Jailed)     │ - Tasks Kanban (Better-Paseo) │
│ - Antigravity AGY Engine │ - Strict Path Jailing       │ - Inline Image Zoom Preview   │
├──────────────────────────┴─────────────────────────────┴───────────────────────────────┤
│ 4. TOTAL REBRANDING IPLABS (Web UI, Theme Palette, Desktop Electron, Android)         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 5. TOOLING & CODER INFRASTRUCTURE (Auto-start Daemon Tmux, Bubblewrap Fallback)        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Pilar 1: Multica-Style Custom Agents & Live Host Probing
* **Runtime / Runner Host Selector**: Pemilihan runner komputasi langsung pada dialog pembuatan agent (`CreateAgentDialog`). Sesi chat otomatis di-route ke runner yang bersangkutan via WebSocket reverse tunnel.
* **Harness Lokal Runner Native**: Mendukung eksekusi tanpa API key cloud per-token:
  - **Codex Native CLI**
  - **OpenCode Native CLI** (kompatibel `>=1.18.0,<2.0.0`)
  - **Antigravity CLI (AGY)** (termasuk katalog model mutakhir seperti Gemini 4 Argon)
* **Live Model Probing**: Opsi dropdown model di UI bukan hardcoded, melainkan di-probe langsung secara live dari CLI yang terpasang di runner terpilih.

### Pilar 2: Multi-Divisi & 3-Tier Enterprise RBAC
* **Tiga Tingkatan Hak Akses**:
  1. `Global Admin`: Akses penuh ke seluruh sistem, master data divisi, dan bypass direktori.
  2. `Supervisor`: Kepala divisi yang terisolasi hanya pada divisinya sendiri. Dapat mengundang member, mengatur runner divisi, dan reset password tanpa bisa melihat akun Global Admin atau divisi lain.
  3. `Member`: Staff divisi yang dibatasi menjalankan tugas pada runner divisinya.
* **Strict Workspace Path Jailing**:
  - Staff terkunci ketat pada direktori pribadinya: `/home/coder/workspaces/{divisi}/{username}/...`.
  - Backend menyelesaikan tilde resolution (`~`) dan memblokir upaya *directory traversal*.

### Pilar 3: Agent Teams & Visual Task Board (Better-Paseo)
* **Agent Teams Builder UI**: Tab visual khusus `Agent Teams` dengan kartu komposisi tim (`TeamCompositionCard`) untuk mengelola tim multi-peran (misal Architect, Coder, Reviewer).
* **Preset Kolaboratif**: Template bawaan seperti *Video Studio (Remotion)* dan kolaborasi multi-agent.
* **Better-Paseo Tasks Board**: Tampilan Kanban board modern di `/tasks` berdasarkan status run terakhir (`lastRunStatus`).
* **Enhanced Chat Inspection**: Timeline interaksi ringkas dengan fitur *inline image preview & click-to-zoom* untuk screenshot browser.

### Pilar 4: Total Rebranding ke IPLabs (Imani Prima)
* **Web UI**: Penggantian seluruh nama produk menjadi **IPLabs Agent Platform**, eliminasi flicker maskot lama, penggunaan logo dan favicon resmi IPLabs.
* **Tema Warna Kustom**: Palette tema eksklusif IPLabs (kombinasi warna emas `#ffaa07` dan background teal/dark `#061212`) serta scrollbar universal yang adaptif.
* **Desktop Shell (Electron)**: Metadata aplikasi `IPLabs` / `ai.iplabs.desktop`, ikon aplikasi macOS (`.icns`, DMG background), Windows (`.ico`), Linux, dan **penonaktifan auto-updater upstream** agar rilis upstream tidak menimpa build IPLabs.
* **Android Shell**: Pembaruan version code (`22` / `0.2.2`) dan ikon aplikasi.

### Pilar 5: Tooling & Infrastruktur Runner Coder
* **Otomasi Setup Satu Baris (`scripts/setup-coder-runner.sh`)**: Pembuatan UUID Host ID stabil, penulisan konfigurasi `config.yaml`, dan inisialisasi daemon background tmux dengan auto-reconnect loop.
* **Sandbox Container Fallback**: Fallback otomatis ke `os_env` unisolated jika bubblewrap (`bwrap`) mendeteksi ketiadaan izin nested container virtualization.
* **Instalasi Ringan (`OMNIGENT_SKIP_WEB_UI=true`)**: Memungkinkan runner menginstall daemon CLI Python tanpa harus memasang Node.js >= 22.

---

## 🛠️ 4. Hasil Verifikasi Integrasi Upgrade (`v0.22.0-iplabs.1`)

Proses merge upstream `v0.22.0` ke dalam branch kustom `upgrade/v0.22.0-with-custom-features` telah melewati serangkaian pengujian:

1. **Resolusi 22 File Konflik**:
   - Berhasil menyelaraskan dependensi versioning `pyproject.toml`, `version.py`, dan `uv.lock`.
   - Mengintegrasikan styling `ToolCard`, `Sidebar`, `NewChatDialog`, dan `SettingsPage` antara fitur baru upstream dan identitas IPLabs.
2. **Uji Validasi TypeScript**:
   - Perintah: `pnpm tsc --noEmit` di folder `web/`.
   - Hasil: **Zero Error (100% Bersih)**.
3. **Uji Validasi Backend RBAC Pytest**:
   - Perintah: `pytest tests/server/test_supervisor_rbac_and_workspace.py`.
   - Hasil: **4 dari 4 test lulus (100%)**, memvalidasi path jailing dan hak akses supervisor.
4. **Uji Build Produksi Web**:
   - Perintah: `pnpm build` di folder `web/`.
   - Hasil: **Sukses terkompilasi dalam 4.16 detik (`✓ built in 4.16s`)**.

---

## 📋 5. Panduan Singkat Deployment

Ketika akan merilis versi baru ini ke server, ikuti langkah berikut:

### Server Development (`192.168.7.70`):
```bash
ssh owi@192.168.7.70
cd ~/omnigent || cd ~/omnigent-repo
git fetch origin
git checkout upgrade/v0.22.0-with-custom-features
git pull origin upgrade/v0.22.0-with-custom-features
cd deploy/docker
docker compose -p omnigent-labs up -d --build
```

### Server Production (`192.168.7.101`):
*(Setelah pengujian di server development dinyatakan stabil)*
```bash
ssh imani@192.168.7.101
cd ~/omnigent || cd ~/omnigent-repo
git fetch origin
git checkout upgrade/v0.22.0-with-custom-features
git pull origin upgrade/v0.22.0-with-custom-features
cd deploy/docker
docker compose -p omnigent-labs up -d --build
```
