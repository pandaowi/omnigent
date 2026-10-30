# Panduan Setup & Duplikasi Runner Coder Omnigent

Dokumen ini berisi panduan teknis langkah demi langkah untuk membuat atau menduplikasi workspace Coder agar berfungsi sebagai Runner mandiri (*execution host*) untuk Omnigent.

---

## 1. Arsitektur & Prinsip Kerja Runner

1. **Arah Koneksi:**
   Runner bertindak sebagai *client* yang membuka koneksi WebSocket persisten keluar (*outbound*) ke Server Omnigent (`omni host <SERVER_URL> --no-open`). Server tidak perlu menembak masuk ke runner.
2. **Kebutuhan Identitas Unik (`host_id`):**
   Setiap runner diidentifikasi oleh `host_id` (UUID 32-karakter heksadesimal).
   > ⚠️ **PENTING:** Jika workspace Coder diduplikasi langsung, file `~/.omnigent/config.yaml` hasil duplikasi membawa `host_id` yang sama persis dengan runner asal. Jika kedua runner berjalan dengan `host_id` yang sama, koneksi keduanya akan saling berebut dan memutus satu sama lain.
3. **Kredensial Autentikasi (`auth_tokens.json`):**
   Runner memerlukan token session CLI di `~/.omnigent/auth_tokens.json` yang terdaftar untuk alamat server Omnigent terkait. Jika diduplikasi dari workspace yang sudah terautentikasi ke server target, token ini otomatis terbawa.

---

## 2. Cara Cepat: Menggunakan Script Otomatis

Di dalam terminal workspace Coder yang baru dibuat / diduplikasi, jalankan perintah berikut:

```bash
# Ganti 'omnigent-demo3' dengan nama runner yang Anda inginkan
curl -sSL https://raw.githubusercontent.com/pandaowi/omnigent/main/scripts/setup-coder-runner.sh | bash -s -- omnigent-demo3 http://192.168.7.101:8090
```

Atau jika script sudah tersedia secara lokal di repo:
```bash
bash scripts/setup-coder-runner.sh omnigent-demo3 http://192.168.7.101:8090
```

---

## 3. Cara Manual: Langkah demi Langkah

Jika Anda ingin menjalankannya secara manual per baris perintah di terminal workspace baru:

### Langkah A: Tentukan Identitas Baru Runner
```bash
# 1. Generate UUID 32-hex baru dan tentukan nama runner
NEW_HOST_ID=$(python3 -c "import uuid; print(uuid.uuid4().hex)")
RUNNER_NAME="omnigent-demo3"               # Sesuaikan nama
SERVER_URL="http://192.168.7.101:8090"      # Sesuaikan IP/Domain server

# 2. Tulis ke ~/.omnigent/config.yaml
mkdir -p /home/coder/.omnigent /home/coder/.omnigent/logs
cat << EOF > /home/coder/.omnigent/config.yaml
host:
  host_id: ${NEW_HOST_ID}
  name: ${RUNNER_NAME}
server: ${SERVER_URL}
EOF
```

### Langkah B: Pasang Script Daemon Reconnect
```bash
cat << 'EOF' > /home/coder/run-runner.sh
#!/bin/bash
mkdir -p /home/coder/.omnigent/logs
while true; do
  echo "[$(date)] Starting omni host..." >> /home/coder/.omnigent/logs/runner-service.log
  /home/coder/.local/bin/omni host http://192.168.7.101:8090 --no-open >> /home/coder/.omnigent/logs/runner-service.log 2>&1
  echo "[$(date)] omni host exited with code $?. Reconnecting in 5s..." >> /home/coder/.omnigent/logs/runner-service.log
  sleep 5
done
EOF
chmod +x /home/coder/run-runner.sh
```

### Langkah C: Jalankan di Background (tmux)
```bash
# Hentikan proses lama jika ada
pkill -f "/home/coder/.local/bin/omni" 2>/dev/null || true
pkill -f "run-runner.sh" 2>/dev/null || true
sleep 1

# Start session tmux baru
tmux kill-session -t omni-runner 2>/dev/null || true
tmux new-session -d -s omni-runner "bash /home/coder/run-runner.sh"
```

---

## 4. Verifikasi Status

### Dari Terminal Coder:
Pantau log runner secara real-time:
```bash
tail -f ~/.omnigent/logs/runner-service.log
```
Tanda sukses:
```text
Connecting to http://192.168.7.101:8090 as 'omnigent-demo3' (<HOST_ID>)
✓ Connected as 'omnigent-demo3' (<HOST_ID>), 0 live runner(s). Listening for sessions — Ctrl-C to disconnect.
```

### Dari Dashboard Web Omnigent:
1. Buka browser: `http://192.168.7.101:8090/settings/runners`
2. Runner baru akan muncul di tabel dengan badge hijau **Online**.
3. Buka `http://192.168.7.101:8090/settings/members` untuk mendelegasikan runner tersebut ke member/user tertentu.

---

## 5. Otomasi Penuh via Coder Terraform Template

Jika Anda ingin workspace baru **langsung otomatis online sebagai runner tanpa perlu mengetik apapun di terminal**, tambahkan blok berikut ke dalam template Terraform Coder Anda:

```hcl
resource "coder_script" "omnigent_runner" {
  agent_id     = coder_agent.main.id
  display_name = "Omnigent Runner Daemon"
  icon         = "/icon/terminal.svg"
  run_on_start = true

  script = <<-EOT
    #!/bin/bash
    set -e
    
    # 1. Pastikan config memiliki host_id unik jika belum ada
    if [ ! -f /home/coder/.omnigent/config.yaml ]; then
      mkdir -p /home/coder/.omnigent
      NEW_ID=$(python3 -c "import uuid; print(uuid.uuid4().hex)")
      cat << EOF > /home/coder/.omnigent/config.yaml
host:
  host_id: $NEW_ID
  name: ${data.coder_workspace.me.name}
server: http://192.168.7.101:8090
EOF
    fi

    # 2. Jalankan runner daemon dalam tmux
    tmux has-session -t omni-runner 2>/dev/null || \
      tmux new-session -d -s omni-runner "bash /home/coder/run-runner.sh"
  EOT
}
```
