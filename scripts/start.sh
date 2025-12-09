#!/bin/sh
# Initialize database then start server
node /app/scripts/init-db.js
node /app/server.js
