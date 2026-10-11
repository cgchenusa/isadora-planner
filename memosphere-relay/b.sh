#!/bin/bash
set -e
BASE="https://raw.githubusercontent.com/cgchenusa/isadora-planner/memosphere-deploy-relay/memosphere-relay"
mkdir -p output/utils
curl -fsSL "$BASE/index.html" -o output/index.html
curl -fsSL "$BASE/utils/supabase.js" -o output/utils/supabase.js
echo "done"
ls -la output output/utils
md5sum output/index.html
