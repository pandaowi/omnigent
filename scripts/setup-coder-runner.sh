#!/usr/bin/env bash
# ==============================================================================
# Omnigent Runner Setup Script for Coder Workspaces
#
# Usage:
#   bash scripts/setup-coder-runner.sh [RUNNER_NAME] [SERVER_URL]
#
# Examples:
#   bash setup-coder-runner.sh omnigent-demo3
#   bash setup-coder-runner.sh omnigent-demo3 http://192.168.7.101:8090
# ==============================================================================

set -euo pipefail

# 1. Konfigurasi Default
RUNNER_NAME="${1:-${CODER_WORKSPACE_NAME:-omnigent-runner-$(date +%s)}}"
SERVER_URL="${2:-http://192.168.7.101:8090}"

echo "=================================================="
echo "  Setting up Omnigent Runner: ${RUNNER_NAME}"
echo "  Target Server            : ${SERVER_URL}"
echo "=================================================="

# 2. Generate Host ID Baru (UUID 32-hex tanpa strip)
if command -v python3 &>/dev/null; then
  NEW_HOST_ID=$(python3 -c "import uuid; print(uuid.uuid4().hex)")
else
  NEW_HOST_ID=$(cat /proc/sys/kernel/random/uuid | tr -d '-')
fi

echo "-> Generated Host ID: ${NEW_HOST_ID}"

# 3. Buat direktori dan tulis config.yaml
mkdir -p /home/coder/.omnigent /home/coder/.omnigent/logs

cat << EOF > /home/coder/.omnigent/config.yaml
host:
  host_id: ${NEW_HOST_ID}
  name: ${RUNNER_NAME}
server: ${SERVER_URL}
EOF
echo "-> Saved /home/coder/.omnigent/config.yaml"

# 4. Buat / Perbarui Script Loop Daemon runner
cat << EOF > /home/coder/run-runner.sh
#!/bin/bash
mkdir -p /home/coder/.omnigent/logs
while true; do
  echo "[\$(date)] Starting omni host..." >> /home/coder/.omnigent/logs/runner-service.log
  /home/coder/.local/bin/omni host ${SERVER_URL} --no-open >> /home/coder/.omnigent/logs/runner-service.log 2>&1
  echo "[\$(date)] omni host exited with code \$?. Reconnecting in 5s..." >> /home/coder/.omnigent/logs/runner-service.log
  sleep 5
done
EOF
chmod +x /home/coder/run-runner.sh
echo "-> Saved and made executable /home/coder/run-runner.sh"

# 5. Stop process lama jika ada dan restart tmux session
echo "-> Restarting tmux session 'omni-runner'..."
pkill -f "/home/coder/.local/bin/omni" 2>/dev/null || true
pkill -f "run-runner.sh" 2>/dev/null || true
sleep 1

tmux kill-session -t omni-runner 2>/dev/null || true
tmux new-session -d -s omni-runner "bash /home/coder/run-runner.sh"

echo "=================================================="
echo "✅ Runner '${RUNNER_NAME}' berhasil diaktifkan!"
echo "   Host ID    : ${NEW_HOST_ID}"
echo "   Server     : ${SERVER_URL}"
echo "   Log File   : /home/coder/.omnigent/logs/runner-service.log"
echo "   Cek status : tail -f ~/.omnigent/logs/runner-service.log"
echo "=================================================="
