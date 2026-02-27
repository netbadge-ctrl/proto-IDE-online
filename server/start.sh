#!/bin/bash
node server/index.js &
BACKEND_PID=$!
sleep 2
node server/start-vite.js
kill $BACKEND_PID 2>/dev/null
