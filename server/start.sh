#!/bin/bash
# 本地开发时自动加载 .env 文件（Node 20+ 原生支持，无需 dotenv）
ENV_FLAG=""
if [ -f ".env" ]; then
  ENV_FLAG="--env-file=.env"
fi
node $ENV_FLAG server/index.js &
BACKEND_PID=$!
sleep 2
vite
kill $BACKEND_PID 2>/dev/null
