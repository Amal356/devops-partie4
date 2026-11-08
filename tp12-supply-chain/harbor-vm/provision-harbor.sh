#!/usr/bin/env bash
# TP12 partie 1 : installation de Docker et de Harbor (installeur en ligne) avec Trivy.
set -euo pipefail

HARBOR_VERSION="v2.15.4"
# Empreinte SHA-256 de harbor-online-installer-v2.15.4.tgz (MD5 officiel du fichier md5sum de la release : 78706b63bc8718e4ac6ebae6789098b2)
HARBOR_SHA256="eeb899cf7b626c925790adba87db9008dd1d73a693a72442651b5bdece9805c6"
HARBOR_IP="192.168.56.50"

echo "== /etc/hosts"
grep -q "harbor.lab.local" /etc/hosts || echo "${HARBOR_IP} harbor.lab.local" >> /etc/hosts

echo "== Docker (dépôt officiel)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q ca-certificates curl openssl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -q
apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
usermod -aG docker vagrant

echo "== Harbor ${HARBOR_VERSION}"
cd /opt
if [ ! -d /opt/harbor ]; then
  curl -fsSL --retry 3 -O "https://github.com/goharbor/harbor/releases/download/${HARBOR_VERSION}/harbor-online-installer-${HARBOR_VERSION}.tgz"
  echo "${HARBOR_SHA256}  harbor-online-installer-${HARBOR_VERSION}.tgz" | sha256sum -c -   # on n'installe rien qui n'a pas été vérifié
  tar xzf "harbor-online-installer-${HARBOR_VERSION}.tgz"
fi
cd /opt/harbor

if [ ! -f harbor.yml ]; then
  # Mots de passe générés aléatoirement : jamais de valeur par défaut (Harbor12345 / root123), jamais dans Git.
  ADMIN_PW="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 16)Aa1"
  DB_PW="$(openssl rand -hex 16)"
  cp harbor.yml.tmpl harbor.yml
  sed -i "s/^hostname: .*/hostname: harbor.lab.local/" harbor.yml
  sed -i '/^https:/,/^  private_key:/ s/^/#/' harbor.yml          # pas de certificat dans le lab : HTTP seulement
  sed -i "s/^harbor_admin_password: .*/harbor_admin_password: ${ADMIN_PW}/" harbor.yml
  sed -i "0,/^  password: root123/ s//  password: ${DB_PW}/" harbor.yml
  chmod 600 harbor.yml
  install -m 600 -o vagrant -g vagrant /dev/null /home/vagrant/harbor-admin-password.txt
  echo "${ADMIN_PW}" > /home/vagrant/harbor-admin-password.txt
fi

./install.sh --with-trivy
docker compose ps
echo "== Harbor prêt : http://harbor.lab.local (utilisateur admin, mot de passe dans /home/vagrant/harbor-admin-password.txt)"
