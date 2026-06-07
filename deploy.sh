#!/bin/bash
# Deploy both HKMOD and LMN dating apps to their correct repos
set -e

echo "Deploying HKMOD to HKMO_D_Bot repo..."
cd /root/.openclaw/workspace/dating-apps/apps/hkmod
# Clone HKMO_D_Bot, replace dist, commit & push
TEMP_DIR=$(mktemp -d)
git clone https://mileschan852:$GITHUB_TOKEN@github.com/mileschan852/HKMO_D_Bot.git "$TEMP_DIR"
cd "$TEMP_DIR"
rm -rf dist/*
cp -r /root/.openclaw/workspace/dating-apps/apps/hkmod/dist/* dist/
git add -A
git -c user.email="gospel@mileschan852.com" -c user.name="Gospel" commit -m "deploy: HKMOD from monorepo $(date -u +%Y-%m-%d_%H:%M)" || true
git push
rm -rf "$TEMP_DIR"

echo "Deploying LMN to LetsMeetNow repo..."
cd /root/.openclaw/workspace/dating-apps/apps/lmn
git add -A
git -c user.email="gospel@mileschan852.com" -c user.name="Gospel" commit -m "deploy: LMN from monorepo $(date -u +%Y-%m-%d_%H:%M)" || true
git push

echo "Done!"
