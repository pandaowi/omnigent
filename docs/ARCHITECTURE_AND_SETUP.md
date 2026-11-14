# Arsitektur Coding & Multi-Runner Omnigent dengan Coder Workspace

Dokumentasi ini merangkum arsitektur, cara kerja, instalasi kustom, port forwarding, dan konfigurasi auto-start runner untuk ekosistem **Omnigent** yang terintegrasi dengan **Coder Workspaces** (termasuk runner general `omnigent-demo2` dan runner khusus framework `frappe-dev`).

---

## 1. Topologi & Arsitektur Sistem

Ekosistem ini memisahkan secara tegas antara **Central Control Plane (Omnigent Server)** dan **Execution Plane (Coder Runner Hosts)**.

```
                              ┌──────────────────────────────────────────────┐
                              │           Browser Klien Pengguna             │
                              │       http://192.168.7.101:8090/             │
                              └──────────────────────┬───────────────────────┘
                                                     │ HTTP / WebSocket (UI)
                                                     ▼
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ HOST PHYSICAL SERVER (192.168.7.101)                                                       │
│                                                                                            │
│   ┌──────────────────────────────────────────────────────────┐                             │
│   │ Docker: omnigent-labs-omnigent-1                         │                             │
│   │ - FastAPI Backend (Port 8000 -> Host 8090)               │                             │
│   │ - Vite React SPA (Web UI)                                │                             │
│   │ - Tunnel Listener: /v1/runner/tunnel (WebSocket)         │                             │
│   └───────────────┬──────────────────────────▲───────────────┘                             │
│                   │ SQLAlchemy / Psycopg     │                                             │
│                   ▼                          │ Inbound WS Tunnel                           │
│   ┌───────────────────────────────┐          │ (Reverse Connection)                        │
│   │ PostgreSQL (omnigent-labs-db) │          │                                             │
│   │ - Sessions, Hosts, Accounts   │          │                                             │
│   └───────────────────────────────┘          │                                             │
│                                              │                                             │
│  ────────────────────────────────────────────┼───────────────────────────────────────────  │
│                                              │                                             │
│  CODER RUNNER WORKSPACES (Container Docker Terisolasi)                                     │
│                                              │                                             │
│  ┌───────────────────────────────────────────┴────────────────┐                             │
│  │ Container: coder-tantowijauhari-omnigent-demo2-devel       │                             │
│  │ Name: omnigent-demo2                                       │                             │
│  │ Tujuan: General Development (Node.js, Python, Golang)      │                             │
│  │ Harness: Codex, OpenCode, AGY                              │                             │
│  │ Daemon: omni host http://192.168.7.101:8090 (tmux)         │                             │
│  └────────────────────────────────────────────────────────────┘                             │
│                                              ▲                                             │
│  ┌───────────────────────────────────────────┴────────────────┐                             │
│  │ Container: coder-tantowijauhari-frappe-dev                 │                             │
│  │ Name: frappe-dev                                           │                             │
│  │ Tujuan: Frappe & ERPNext Full-Stack Ecosystem              │                             │
│  │ Stack Terpasang: MariaDB 10.11, Redis 6379/11000/13000,    │                             │
│  │                  Socket.io, bench CLI, Python 3.12 venv    │                             │
│  │ Harness: OpenCode (Go), Codex, AGY                         │                             │
│  │ Daemon: omni host http://192.168.7.101:8090 (tmux)         │                             │
│  └────────────────────────────────────────────────────────────┘                             │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Mengapa Runner Khusus Frappe (`frappe-dev`) Diperlukan?
Frappe Framework membutuhkan lingkungan runtime aktif (*stateful environment*):
1. **MariaDB / PostgreSQL**: database skema Frappe.
2. **Redis**: Cache, Queue task asynchronous, dan Socket.io realtime events.
3. **Frappe Bench CLI**: Perintah `bench migrate`, `bench new-app`, `bench restart`, `bench console`.

Jika coding dilakukan di runner general (`omnigent-demo2`), AI agent tidak bisa langsung mengeksekusi migrasi database atau memvalidasi sintaks DocType secara langsung. Dengan menjadikan `frappe-dev` sebagai Runner Host di Omnigent, AI Agent (OpenCode / Codex) dapat mengeksekusi perintah `bench` secara native di dalam chat turn.

---

## 2. Cara Kerja & Penggunaan Port Forwarding

Ketika Omnigent membuat aplikasi (misal: frontend React/Vue pada port 3000, atau Frappe app pada port 8000) di dalam container runner:

### Mengapa Klien Tidak Bisa Langsung Mengakses `http://localhost:3000`?
1. Aplikasi berjalan di **localhost container Coder**, bukan di laptop lokal pengguna.
2. Container Coder berada di balik jaringan internal Docker host (`192.168.7.101`), dan port-port aplikasi dinamis tidak secara otomatis di-publish ke IP publik.

### Solusi 1: Coder SSH Port Forwarding (Paling Praktis)
Coder CLI menyediakan perintah SSH dengan flag pembatas:
```bash
# Perhatikan: gunakan tanda minus ganda (--) sebelum memasukkan argumen SSH standard seperti -L
coder ssh main.frappe-dev.tantowijauhari.coder -- -L 3000:localhost:3000 -L 8000:localhost:8000
```
*Port 3000 dan 8000 di dalam container Frappe sekarang dapat diakses langsung dari browser laptop Anda via `http://localhost:3000` dan `http://localhost:8000`.*

### Solusi 2: Standard SSH dengan Jump Host (`-J`)
Jika menghubungkan melalui user host physical `imani@192.168.7.101`:
```bash
ssh -J imani@192.168.7.101 -L 3000:localhost:3000 coder@<CONTAINER_IP>
```
*Catatan: Domain internal `.coder` hanya dikenali jika Coder DNS resolver terkonfigurasi di mesin klien.*

### Solusi 3: Coder Web Port Preview URL
Coder secara bawaan mendukung port forwarding berbasis HTTP subdomain:
```
https://3000--main--frappe-dev--tantowijauhari.coder.domain-anda.com/
```
Url ini otomatis me-route request dari internet langsung ke port yang bersangkutan di dalam container tanpa memerlukan konfigurasi SSH.

---

## 3. Instalasi Custom Omnigent Runner dari Git Fork

Jika Anda menggunakan branch/fork khusus Omnigent (misalnya: `https://github.com/pandaowi/omnigent.git`) yang memuat patch UI, fitur Multica-style agent, dan dukungan model OpenCode/Codex:

### A. Catatan Penting Mengenai Permission (JANGAN Gunakan Sudo)
* **Wajib install sebagai user biasa (`coder`), JANGAN menggunakan `sudo`:**
  Jika Anda menginstall menggunakan `sudo uv tool install`, interpreter Python akan berada di bawah `/root/.local/share/...` yang tidak bisa dibaca oleh user biasa, sehingga memicu error:
  `bash: /usr/local/bin/omni: /root/.local/share/uv/tools/omnigent/bin/python: bad interpreter: Permission denied`
* Selain itu, proses runner yang berjalan sebagai `root` akan membuat file-file workspace berpemilik `root` dan mengacaukan git workspace Anda.
* **Jika symlink root lama sudah terlanjur ada, bersihkan dulu:**
  ```bash
  sudo rm -f /usr/local/bin/omni
  ```

### B. Tantangan Node.js pada Runner
Pembangunan paket resmi Omnigent secara penuh memicu kompilasi SPA Web UI (memerlukan Node.js >= 22.13.0). Namun, container runner biasanya hanya memiliki Node.js 18.x atau 20.x, dan runner **hanya membutuhkan CLI Python daemon**, bukan frontend web.

### C. Langkah Instalasi Step-by-Step

1. **Install atau Update `omni` dari branch fork (misal: `feat/multica-style-agents`):**
   ```bash
   OMNIGENT_SKIP_WEB_UI=true uv tool install \
     "git+https://github.com/pandaowi/omnigent.git@feat/multica-style-agents" \
     --force
   ```

2. **Pastikan PATH Mengarah ke `~/.local/bin`:**
   ```bash
   export PATH="$HOME/.local/bin:$PATH"
   echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
   ```

3. **Verifikasi Instalasi:**
   ```bash
   which omni
   # Output harus: /home/coder/.local/bin/omni
   omni --version
   ```

---

## 4. Konfigurasi Identitas Runner (`config.yaml`) & Login

### A. Memberi Nama Host yang Benar (Hindari Error `must be set together`)
> ⚠️ **PENTING:** Jangan menggunakan environment variable `export OMNIGENT_HOST_NAME="..."`. Di Omnigent, environment variable tersebut dipasangkan secara ketat dengan `OMNIGENT_HOST_ID` untuk ephemeral disposable sandboxes; jika diset sendirian di shell, daemon akan melempar error:
> `OMNIGENT_HOST_ID and OMNIGENT_HOST_NAME must be set together`

Cara resmi dan stabil untuk runner biasa adalah menuliskan nama host ke dalam file konfigurasi:
```bash
mkdir -p ~/.omnigent
cat << 'EOF' > ~/.omnigent/config.yaml
host:
  name: omnigent-runner-dev
EOF
```
*Catatan: `host_id` akan otomatis di-generate dan disimpan secara stabil di file tersebut saat runner pertama kali terkoneksi.*

### B. Login Interaktif Satu Kali
Sebelum menjalankan loop background di Tmux, Anda **wajib login satu kali** agar token autentikasi tersimpan di `~/.omnigent/auth_tokens.json`:
```bash
# Untuk Server Development (7.70):
omni login http://192.168.7.70:8090

# Atau untuk Server Production (7.101):
omni login http://192.168.7.101:8090
```
Masukkan username dan password admin sampai muncul konfirmasi sukses.

---

## 5. Konfigurasi Auto-Start Runner pada Coder Workspace

Agar runner otomatis online dan melakukan rekoneksi jika koneksi jaringan sempat terputus:

### A. Untuk Workspace yang Sudah Ada (Existing Workspace)

1. **Buat Script Auto-Reconnect (`~/run-runner.sh`):**
   ```bash
   cat << 'EOF' > ~/run-runner.sh
   #!/bin/bash
   export PATH="$HOME/.local/bin:$PATH"
   mkdir -p ~/.omnigent/logs

   while true; do
     echo "[$(date)] Starting omni host..." >> ~/.omnigent/logs/runner.log
     omni host http://192.168.7.70:8090 --no-open >> ~/.omnigent/logs/runner.log 2>&1
     echo "[$(date)] omni host stopped (exit code: $?). Reconnecting in 5s..." >> ~/.omnigent/logs/runner.log
     sleep 5
   done
   EOF

   chmod +x ~/run-runner.sh
   ```

2. **Jalankan di Background Session `tmux`:**
   ```bash
   tmux kill-session -t omni-runner 2>/dev/null || true
   tmux new-session -d -s omni-runner "bash $HOME/run-runner.sh"
   ```

3. **Pasang Hook Startup di `~/.profile` dan `~/.bashrc`:**
   Tambahkan baris berikut di baris terbawah `~/.profile` dan `~/.bashrc` agar setiap kali container workspace Coder di-restart / di-boot ulang, runner otomatis aktif:
   ```bash
   # Auto-start Omnigent runner daemon in background if not running
   if ! tmux has-session -t omni-runner 2>/dev/null; then
     rm -f ~/.omnigent/daemon.pid ~/.omnigent/daemons/* ~/.omnigent/locks/* 2>/dev/null
     tmux new-session -d -s omni-runner "bash $HOME/run-runner.sh"
   fi
   ```

4. **Monitoring Log Real-Time:**
   ```bash
   tail -f ~/.omnigent/logs/runner.log
   ```
   Atau attach langsung ke tmux:
   ```bash
   tmux attach -t omni-runner
   # Tekan Ctrl+b lalu d untuk detach keluar tanpa mematikan runner
   ```

---

## 6. Fitur Custom Agent Multica-Style

Pada branch `feat/multica-style-agents`, web UI Omnigent kini mendukung pembuatan agent bergaya Multica:

1. **Runtime / Runner Host Selector:**
   Saat membuat agent kustom di web UI (`Settings -> Custom Agents` atau dropdown `Create custom agent`), pilih **Runtime / Runner Host** (misal: `omnigent-runner-dev ● Online`).
2. **Prioritas Native Harness:**
   Pilih engine runner seperti **Codex (Runner Native CLI)**, **OpenCode (Runner Native CLI)**, atau **Antigravity CLI (Runner Native)** yang berjalan langsung di environment runner tanpa memerlukan API Key berbayar per token.
3. **Auto-Detect Live Model Options:**
   Model tidak perlu diketik manual. Omnigent otomatis mem-probe model yang terinstall di runner yang dipilih dan menyajikannya dalam dropdown pilihan model.
4. **Auto-Routing Session:**
   Ketika custom agent tersebut dipilih di New Chat, Omnigent otomatis me-route eksekusi ke runner host yang sudah di-assign.

---

## 7. Untuk Workspace Baru via Coder Template (Terraform)

Jika Anda membuat template Coder baru di dashboard Coder (`main.tf`), masukkan runner startup langsung ke blok `coder_agent`:

```hcl
resource "coder_agent" "main" {
  arch           = "amd64"
  os             = "linux"
  startup_script = <<-EOT
    #!/bin/bash
    set -e

    # Pastikan tmux terpasang
    if ! command -v tmux >/dev/null 2>&1; then
      sudo apt-get update && sudo apt-get install -y tmux
    fi

    # Install Omnigent Runner dari repo custom
    if ! command -v omni >/dev/null 2>&1; then
      OMNIGENT_SKIP_WEB_UI=true uv tool install git+https://github.com/pandaowi/omnigent.git
    fi

    # Auto-start daemon di dalam tmux session
    if ! tmux has-session -t omni-runner 2>/dev/null; then
      tmux new-session -d -s omni-runner "/home/coder/run-runner.sh"
    fi
  EOT
}
```

---

## 8. Multi-Divisi & Arsitektur 3-Tier RBAC (Global Admin, Supervisor, Member)

Untuk mendukung organisasi dengan banyak divisi (misal: IT/Dev, Finance, HR, Operations), sistem menggunakan hierarki 3-Tier Role-Based Access Control (RBAC):

```
┌─────────────────────────────────────────────────────────────┐
│ 1. GLOBAL ADMIN (Super Administrator / IT Head)             │
│    - Akses penuh ke seluruh sistem                          │
│    - Kelola Master Data Divisi / Organisasi                 │
│    - Menunjuk Supervisor untuk tiap Divisi                  │
│    - Alokasi runner host & whitelist model ke tiap Divisi   │
│    - Full Filesystem Bypass (bisa inspect semua folder)     │
└──────────────────────────────┬──────────────────────────────┘
                               │ Menugaskan & Menjaga
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. SUPERVISOR (Division Head / Kepala Divisi)               │
│    - Bertanggung jawab HANYA pada divisinya sendiri         │
│    - Invite Member baru (terkunci otomatis ke divisinya)    │
│    - Mengatur runner & model dari jatah divisinya           │
│    - Reset password & remove member di divisinya            │
│    - KEAMANAN (Guardrails):                                 │
│      * TIDAK BISA melihat / memodifikasi Global Admin       │
│      * TIDAK BISA mengakses divisi lain atau runner lain    │
└──────────────────────────────┬──────────────────────────────┘
                               │ Mengawasi
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. MEMBER (Staff Divisi)                                    │
│    - Menjalankan chat, task, & otomasi pada runner divisinya│
│    - Terkunci (jailed) pada folder pribadinya               │
│      /home/coder/workspaces/{divisi}/{username}/...         │
└─────────────────────────────────────────────────────────────┘
```

### Struktur Folder Workspace Terisolasi:
Agar project otomasi dan coding tidak bertumpuk di `/home/coder`:
```text
/home/coder/workspaces/
  ├── it-development/
  │   ├── tantowi/
  │   │   ├── automasi-backup-db/
  │   │   └── erpnext-custom-app/
  │   └── bobby/
  │       └── payment-gateway/
  ├── finance/
  │   └── sarah/
  │       └── automasi-rekap-invoice/
  └── hr/
      └── dewi/
          └── automasi-payroll/
```

---

## 9. [TODO / ROADMAP] Coder Shared Storage Volume Mount (`/data/omnigent-workspaces`)

> 📌 **TODO Kebutuhan Mendatang:**  
> Ketika banyak runner aktif (misal runner `demo` untuk Codex, runner `demo2` untuk Antigravity, dan runner `frappe-dev` untuk OpenCode), container Coder yang berbeda memiliki filesystem lokal terpisah. Agar folder `/home/coder/workspaces` tersinkronisasi 100% secara real-time di semua runner, terapkan shared volume mount di server fisik Coder.

### Langkah Setup pada Host Server Fisik (`192.168.7.101`):
1. **Buat direktori bersama di host fisik:**
   ```bash
   sudo mkdir -p /data/omnigent-workspaces
   # Pastikan UID 1000 (user 'coder' bawaan Coder container) memiliki permission write
   sudo chown -R 1000:1000 /data/omnigent-workspaces
   sudo chmod -R 775 /data/omnigent-workspaces
   ```

2. **Perbarui Template Coder (`main.tf`):**
   Di dashboard Coder (`Templates -> Edit main.tf`), tambahkan blok `volumes` ke resource `docker_container.workspace`:
   ```hcl
   resource "docker_container" "workspace" {
     name  = "coder-${data.coder_workspace.me.owner}-${data.coder_workspace.me.name}"
     image = "codercom/enterprise-base:ubuntu"
     
     # Shared storage volume mount antar runner
     volumes {
       container_path = "/home/coder/workspaces"
       host_path      = "/data/omnigent-workspaces"
       read_write     = true
     }
   }
   ```

3. **Publish Template & Update Workspace:**
   * Simpan dan publish versi template baru di Coder.
   * Pada workspace yang ada, klik tombol **"Update"** untuk me-restart container dengan volume baru. Data `/home/coder` lama tetap aman karena tersimpan di persistent disk Coder.

---

## 10. Panduan Deployment Server Development & Production (Server Deployment Playbook)

Bagian ini adalah panduan standar bagi engineer maupun AI Agent untuk mengeksekusi deployment ke server Development dan Production.

### A. Matriks Lingkungan Server

| Parameter | Server Development | Server Production |
|---|---|---|
| **Host IP** | `192.168.7.70` | `192.168.7.101` |
| **SSH User** | `owi` (`owi@192.168.7.70`) | `imani` (`imani@192.168.7.101`) |
| **Akses Web UI** | `http://192.168.7.70:8090` | `http://192.168.7.101:8090` |
| **Target Branch** | `feat/multica-style-agents` atau `main` | `feat/multica-style-agents` atau `main` |
| **Project Compose** | `omnigent-labs` | `omnigent-labs` |
| **Container Backend** | `omnigent-labs-omnigent-1` (Port 8000 -> 8090) | `omnigent-labs-omnigent-1` (Port 8000 -> 8090) |
| **Container Database** | `omnigent-labs-db` / `omnigent-labs-postgres-1` | `omnigent-labs-db` / `omnigent-labs-postgres-1` |
| **Direktori Standar** | `~/omnigent` atau `~/omnigent-repo/deploy/docker` | `~/omnigent` atau `~/omnigent-repo/deploy/docker` |

---

### B. Prosedur Deployment Standar (Step-by-Step)

Ketika diperintahkan untuk melakukan deploy ke salah satu server, ikuti langkah-langkah berikut:

#### 1. Masuk Melalui SSH
```bash
# Untuk Server Development:
ssh owi@192.168.7.70

# Untuk Server Production:
ssh imani@192.168.7.101
```

#### 2. Navigasi ke Direktori Project & Tarik Kode Terbaru
```bash
# Masuk ke direktori repository
cd ~/omnigent || cd ~/omnigent-repo

# Pastikan working tree bersih dan fetch branch kustom
git fetch origin
git checkout feat/multica-style-agents
git pull origin feat/multica-style-agents
```

#### 3. Build & Restart Service Melalui Docker Compose
Masuk ke direktori deployment docker dan jalankan rebuild:
```bash
cd deploy/docker

# Rebuild image container dan jalankan di background (-p omnigent-labs menjaga nama container konsisten)
docker compose -p omnigent-labs up -d --build
```
> *Catatan: Proses build mencakup kompilasi Vite React SPA frontend dan FastAPI Python backend di dalam multi-stage Dockerfile.*

#### 4. Verifikasi Status dan Log Container
```bash
# Cek apakah kedua container berjalan normal (STATUS: Up / healthy)
docker compose -p omnigent-labs ps

# Periksa log startup backend
docker compose -p omnigent-labs logs -f --tail=100 omnigent

# Pastikan endpoint HTTP merespons dengan kode 200/307
curl -I http://localhost:8090/
```

#### 5. Verifikasi Koneksi Runner WebSocket Tunnel
Setelah container backend server restart, pastikan runner di container Coder otomatis terhubung kembali:
```bash
# Cek status runner aktif di database
docker exec -i omnigent-labs-omnigent-1 python3 -c "
from omnigent.server.app import make_app
print('Checking hosts...')
"
# Atau cek langsung di tabel hosts database PostgreSQL:
docker exec -i omnigent-labs-postgres-1 psql -U omnigent -d omnigent -c "SELECT encode(host_id, 'hex') AS host_id, name, status, last_seen_at FROM hosts;"
```

---

## 11. Detail Penambahan & Modifikasi Fitur dari Source Asli (Upstream Omnigent v0.21.0)

Fork ini dibangun di atas rilis resmi upstream **Omnigent v0.21.0**, dengan penambahan sebanyak **152 file termodifikasi (+11.053 baris kode, -1.770 baris)** yang terbagi ke dalam 5 pilar inovasi:

### 1. Multica-Style Custom Agents & Live Runner Probing
* **Runtime / Runner Host Selector**:
  - Pada dialog pembuatan agent (`CreateAgentDialog` & `CreateAgentTeamDialog`), ditambahkan selector dropdown *Runtime / Runner Host* (contoh: `omnigent-runner-dev ● Online`).
  - Pemilihan ini secara otomatis me-route turn eksekusi chat ke runner host yang bersangkutan melalui WebSocket tunnel.
* **Integrasi Runner Native Harness**:
  - **Codex Native CLI**: Eksekusi coding harness langsung dari environment runner tanpa dependensi cloud API.
  - **OpenCode Native CLI**: Dukungan penuh harness OpenCode (versi `>=1.18.0,<2.0.0`) dengan probe opsi model live dari runner CLI.
  - **Antigravity CLI (AGY)**: Integrasi probe model dinamis dari AGY runner, termasuk katalog model terbaru seperti Gemini 4 Argon.
* **Live Dynamic Model Probing**:
  - Opsi model tidak di-hardcode di UI, melainkan di-probe secara real-time dari host runner yang dipilih via route `_session_harness_readiness.py` dan `model_option_routes.py`.

### 2. Multi-Divisi & 3-Tier Enterprise RBAC
* **Hierarki Role 3 Tingkat**:
  - **Global Admin**: Super Administrator dengan visibilitas penuh, pengelola master data organisasi/divisi, dan bypass isolasi direktori.
  - **Supervisor**: Kepala Divisi yang terisolasi ketat hanya pada divisinya sendiri. Dapat membuat/mengundang member (terkunci otomatis ke divisinya), mengatur runner dan whitelist model divisi, serta mereset password member.
    - *Guardrail Keamanan*: Supervisor dicegah melihat atau memodifikasi akun Global Admin maupun mengakses divisi lain (`test_supervisor_rbac_and_workspace.py`).
  - **Member**: Staff operasional yang hanya dapat menjalankan chat/task pada runner divisi dan terkunci pada workspace pribadinya.
* **Path Jailing & Dynamic Workspace Routing**:
  - Struktur isolasi folder: `/home/coder/workspaces/{divisi}/{username}/...`.
  - Backend mengimplementasikan resolusi tilde (`~`) yang aman dan mencegah *directory traversal* keluar dari sandbox divisi pengguna.
* **Redesign Members Page & Modals**:
  - Tampilan tabel eksekutif dengan filter divisi, supervisor account badge, dropdown seleksi user, dan modal alokasi runner yang bersih.

### 3. Agent Teams & Visual Task Board (Better-Paseo)
* **Agent Teams Builder UI**:
  - Tab visual `Agent Teams` di navigasi utama dengan komponen kartu komposisi tim (`TeamCompositionCard`).
  - Dialog pembentukan tim kolaboratif multi-peran dengan preset bawaan (*Video Studio Remotion*, *Collaborative Bundle: Architect, Coder, Reviewer*).
* **Better-Paseo Visual Tasks Board (Kanban)**:
  - Halaman `/tasks` dengan visual Kanban board modern berbasis status run terakhir (`lastRunStatus`).
  - Sidebar navigation link ke Tasks dengan icon `ListTodoIcon`.
* **Compact Timeline & Collapsible Tool Pills**:
  - Tampilan timeline interaksi chat yang ringkas, collapsible tool pills yang informatif, serta fitur **inline image preview & zoom** untuk hasil screenshot browser.

### 4. Total Rebranding ke IPLabs (Imani Prima)
* **Web UI Branding**:
  - Mengubah seluruh string teks user-facing dari "Omnigent" menjadi **"IPLabs Agent Platform"**.
  - Mengeliminasi flicker maskot starfish pada saat refresh halaman.
  - Mengganti seluruh favicon dan branding header dengan logo resmi IPLabs / Imani Prima.
  - Menyesuaikan tema warna (*IPLabs palette label*) dan universal theme-aware scrollbars yang dinamis mengikuti tint latar belakang.
* **Desktop Shell (Electron)**:
  - Penyesuaian metadata aplikasi menjadi `IPLabs` / `ai.iplabs.desktop` dengan email maintainer `IPLabs <support@iplabs.ai>`.
  - Penggantian aset icon native macOS (`.icns`, background installer `.dmg`), Windows (`.ico`), dan Linux (`.svg`).
  - **Penonaktifan Upstream Auto-Updater**: Mencegah binary rilis resmi upstream Omnigent menimpa branding aplikasi IPLabs.
* **Android Shell**:
  - Update version code (`versionCode: 22`, `versionName: 0.2.2`) dan asset icon Android.

### 5. Tooling, Sandbox & Runner Infrastruktur
* **Skrip Otomasi Setup Runner (`scripts/setup-coder-runner.sh`)**:
  - Skrip bash satu baris untuk generate UUID Host ID stabil, pembuatan file konfigurasi `~/.omnigent/config.yaml`, dan inisialisasi loop auto-reconnect di tmux session.
* **Sandbox Container Fallback**:
  - Fallback otomatis ke unisolated `os_env` jika `bwrap` (bubblewrap) gagal berjalan di container tanpa nested virtualization privileges.
* **Runner-Only Lightweight Packaging**:
  - Dukungan flag `OMNIGENT_SKIP_WEB_UI=true` saat instalasi runner (`uv tool install`) sehingga container runner Coder tidak memerlukan Node.js >= 22.

---

## 12. Ringkasan Perintah Penting & Cheat Sheet

| Kategori | Tindakan | Perintah |
|---|---|---|
| **Deploy** | **SSH ke Server Dev** | `ssh owi@192.168.7.70` |
| **Deploy** | **SSH ke Server Prod** | `ssh imani@192.168.7.101` |
| **Deploy** | **Update & Rebuild Server** | `git pull origin feat/multica-style-agents && cd deploy/docker && docker compose -p omnigent-labs up -d --build` |
| **Runner** | **Cek status runner aktif** | `docker exec coder-tantowijauhari-frappe-dev tmux ls` |
| **Runner** | **Lihat log runner realtime** | `docker exec coder-tantowijauhari-frappe-dev tail -f /home/coder/.omnigent/logs/runner-service.log` |
| **Runner** | **Masuk ke session tmux runner** | `tmux attach -t omni-runner` |
| **Database** | **Cek status runner di database** | `docker exec -i omnigent-labs-postgres-1 psql -U omnigent -d omnigent -c "SELECT encode(host_id, 'hex'), name, status FROM hosts;"` |
| **Network** | **Port Forwarding via Coder CLI** | `coder ssh <workspace-name> -- -L 3000:localhost:3000` |
