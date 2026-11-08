#!/usr/bin/env bash
# TP12 : installe la base de vulnérabilités Trivy dans Harbor sans dépendre d'un seul gros téléchargement.
# Connexion instable : le téléchargement direct de Trivy (ghcr.io) était coupé (timeout, PROTOCOL_ERROR).
# Ici : téléchargement HTTP de la couche OCI avec REPRISE (-C -), vérification SHA-256, puis mode hors ligne.
# Usage (dans la VM Harbor) : sudo bash /vagrant/trivy-db-offline.sh
set -euo pipefail

REPO="aquasecurity/trivy-db"
TAG="2"
WORK="/var/tmp/trivy-db"
HARBOR_DIR="/opt/harbor"
CACHE="/data/trivy-adapter/trivy"   # monté dans le conteneur trivy-adapter (cache de Trivy)

mkdir -p "$WORK" && cd "$WORK"

token() {
  curl -fsSL "https://ghcr.io/token?service=ghcr.io&scope=repository:${REPO}:pull" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])'
}

echo "== 1. Manifeste OCI de ${REPO}:${TAG}"
curl -fsSL --retry 5 -H "Authorization: Bearer $(token)" \
  -H "Accept: application/vnd.oci.image.manifest.v1+json" \
  "https://ghcr.io/v2/${REPO}/manifests/${TAG}" -o manifest.json
read -r DIGEST SIZE < <(python3 -c '
import json
m = json.load(open("manifest.json"))
l = [x for x in m["layers"] if "trivy.db.layer" in x["mediaType"]][0]
print(l["digest"], l["size"])')
echo "   couche ${DIGEST} (${SIZE} octets)"

verifie() { [ -f db.tar.gz ] && echo "${DIGEST#sha256:}  db.tar.gz" | sha256sum -c --status - ; }

echo "== 2. Téléchargement avec reprise"
for essai in $(seq 1 40); do
  if verifie; then break; fi
  ACTUEL=$(stat -c %s db.tar.gz 2>/dev/null || echo 0)
  if [ "$ACTUEL" -ge "$SIZE" ]; then echo "   fichier complet mais empreinte fausse : on recommence"; rm -f db.tar.gz; fi
  echo "   essai ${essai} : ${ACTUEL}/${SIZE} octets"
  curl -fL -C - --retry 3 --retry-delay 5 --speed-limit 1024 --speed-time 60 \
    -H "Authorization: Bearer $(token)" \
    "https://ghcr.io/v2/${REPO}/blobs/${DIGEST}" -o db.tar.gz || { echo "   coupure : reprise dans 5 s"; sleep 5; }
done
verifie || { echo "ÉCHEC : la base n'a pas pu être téléchargée en entier"; exit 1; }
echo "   db.tar.gz : empreinte SHA-256 conforme au digest OCI"

echo "== 3. Installation dans le cache de trivy-adapter"
tar xzf db.tar.gz          # trivy.db + metadata.json
cat metadata.json; echo
cd "$HARBOR_DIR"
docker compose stop trivy-adapter
mkdir -p "$CACHE/db"
cp "$WORK/trivy.db" "$WORK/metadata.json" "$CACHE/db/"
chown -R --reference="$CACHE" "$CACHE/db"
ls -ln "$CACHE/db"

echo "== 4. Trivy en mode hors ligne (plus de téléchargement au moment du scan)"
sed -i 's/^  skip_update: false/  skip_update: true/; s/^  skip_java_db_update: false/  skip_java_db_update: true/' harbor.yml
grep -nE "^  (skip_update|skip_java_db_update|timeout):" harbor.yml
docker compose down
./prepare --with-trivy
docker compose up -d
echo "== Terminé : relancer le scan dans Harbor (il ne télécharge plus rien)."
