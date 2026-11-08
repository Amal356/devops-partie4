#!/usr/bin/env bash
# TP12 partie 6 : ne lance une image que si sa signature Cosign est valide.
# Usage : ./verify-before-run.sh <image:tag ou image@sha256:...> [options docker run...]
# Variables : COSIGN_PUB (défaut ./cosign.pub), COSIGN_FLAGS (ex. "--allow-http-registry --allow-insecure-registry" pour le lab)
set -euo pipefail

IMAGE="${1:?usage : $0 <image> [options docker run]}"; shift
PUB="${COSIGN_PUB:-./cosign.pub}"
read -r -a FLAGS <<< "${COSIGN_FLAGS:-}"

[ -f "$PUB" ] || { echo "REFUS : clé publique introuvable ($PUB)" >&2; exit 2; }

# 1. Vérifier la signature. cosign résout le tag en digest et contrôle la signature de CE digest.
if ! SORTIE=$(cosign verify --key "$PUB" "${FLAGS[@]}" "$IMAGE" 2>/dev/null); then
  echo "REFUS : signature absente ou invalide pour $IMAGE" >&2
  exit 1
fi

# 2. Récupérer le digest qui vient d'être vérifié et lancer CE digest, jamais le tag :
#    sinon le tag pourrait être déplacé entre la vérification et le lancement (TOCTOU).
DIGEST=$(printf '%s' "$SORTIE" | jq -r '.[0].critical.image."docker-manifest-digest"')
REPO="${IMAGE%@*}"; REPO="${REPO%:*}"
[[ "$DIGEST" == sha256:* ]] || { echo "REFUS : digest vérifié introuvable" >&2; exit 1; }

echo "OK : signature valide pour ${REPO}@${DIGEST}"
exec docker run "$@" "${REPO}@${DIGEST}"
