#!/bin/bash
# Deploy both HKMOD and LMN dating apps
set -e

echo "Deploying HKMOD..."
cd /root/.openclaw/workspace/dating-apps/apps/hkmod
rsync -avz --delete dist/ /var/www/hkmod/

echo "Deploying LMN..."
cd /root/.openclaw/workspace/dating-apps/apps/lmn
rsync -avz --delete dist/ /var/www/lmn/

echo "Done!"
