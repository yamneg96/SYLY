#!/usr/bin/env bash
# Checks the tools SYLY needs on Linux and installs ONLY the ones that are missing or too old.
#   bash scripts/check-tools.sh              # check, then install what is missing (asks for sudo when needed)
#   bash scripts/check-tools.sh --check-only # only report
# Installs automatically on Debian/Ubuntu (apt). On other systems it tells you the command to run.
set -u
CHECK_ONLY=0; [ "${1:-}" = "--check-only" ] && CHECK_ONLY=1
missing=()

ver() { "$@" 2>&1 | head -n1; }
major() { echo "$1" | grep -oE '[0-9]+' | head -n1; }
minor() { echo "$1" | grep -oE '[0-9]+\.[0-9]+' | head -n1 | cut -d. -f2; }
ok()   { printf 'OK       %-16s %s\n' "$1" "$2"; }
miss() { printf 'MISSING  %-16s %s\n' "$1" "$2"; missing+=("$3"); }

# git
if command -v git >/dev/null; then ok "Git" "$(ver git --version)"; else miss "Git" "not found" git; fi

# python 3.12+
PY=""; for c in python3 python; do command -v "$c" >/dev/null && PY="$c" && break; done
if [ -n "$PY" ]; then
  v="$(ver "$PY" --version)"
  if [ "$(major "$v")" -gt 3 ] 2>/dev/null || { [ "$(major "$v")" = 3 ] && [ "$(minor "$v")" -ge 12 ]; }; then ok "Python 3.12+" "$v"
  else miss "Python 3.12+" "found $v, too old" python; fi
  "$PY" -m venv --help >/dev/null 2>&1 || miss "python venv" "module missing" python3-venv
else miss "Python 3.12+" "not found" python; fi

# node 20+ and npm
if command -v node >/dev/null; then
  v="$(ver node --version)"
  if [ "$(major "$v")" -ge 20 ] 2>/dev/null; then ok "Node.js 20+" "$v"; else miss "Node.js 20+" "found $v, too old" node; fi
else miss "Node.js 20+" "not found" node; fi
command -v npm >/dev/null && ok "npm" "$(ver npm --version)" || miss "npm" "not found" npm

# docker and the compose plugin
if command -v docker >/dev/null; then
  ok "Docker" "$(ver docker --version)"
  if docker compose version >/dev/null 2>&1; then ok "docker compose" "$(ver docker compose version)"; else miss "docker compose" "plugin missing" compose; fi
else miss "Docker" "not found" docker; fi

# cloudflared
if command -v cloudflared >/dev/null; then ok "cloudflared" "$(ver cloudflared --version)"; else miss "cloudflared" "not found" cloudflared; fi

if [ "${#missing[@]}" -eq 0 ]; then echo; echo "Everything is installed."; else
  echo
  if [ "$CHECK_ONLY" = 1 ]; then echo "Run again without --check-only to install: ${missing[*]}"; exit 0; fi
  if ! command -v apt-get >/dev/null; then
    echo "This is not an apt system. Install by hand: ${missing[*]}"
    echo "  Docker:      https://docs.docker.com/engine/install/"
    echo "  Node.js 20+: https://nodejs.org/ or nvm"
    echo "  cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    exit 1
  fi
  apt_pkgs=(); need_node=0
  for m in "${missing[@]}"; do case "$m" in
    git) apt_pkgs+=(git);; python) apt_pkgs+=(python3 python3-pip python3-venv);; python3-venv) apt_pkgs+=(python3-venv);;
    node) need_node=1;; npm) apt_pkgs+=(npm);; docker) apt_pkgs+=(docker.io docker-compose-v2);; compose) apt_pkgs+=(docker-compose-v2);;
  esac; done
  if [ "${#apt_pkgs[@]}" -gt 0 ]; then echo "Installing with apt: ${apt_pkgs[*]}"; sudo apt-get update && sudo apt-get install -y "${apt_pkgs[@]}"; fi
  if [ "$need_node" = 1 ]; then
    echo "Node.js 20+ is not in your apt sources. Install it with nvm (no sudo), then open a new terminal:"
    echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash && nvm install 22"
  fi
  if printf '%s\n' "${missing[@]}" | grep -qx cloudflared; then
    echo "Installing cloudflared ..."
    arch="$(dpkg --print-architecture)"
    curl -L -o /tmp/cloudflared.deb "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${arch}.deb" && sudo dpkg -i /tmp/cloudflared.deb
  fi
  if printf '%s\n' "${missing[@]}" | grep -qx docker; then
    sudo usermod -aG docker "$USER"; echo "Log out and in again so 'docker' works without sudo."
  fi
  echo; echo "Done. Run the script again to check."
fi

# Docker installed but not running / not allowed for this user
if command -v docker >/dev/null; then
  if docker info >/dev/null 2>&1; then echo "Docker engine is running."
  else echo "Docker is installed but not usable: start it ('sudo systemctl start docker') and make sure your user is in the docker group."; fi
fi
