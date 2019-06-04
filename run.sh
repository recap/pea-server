#!/bin/sh
pm2 start pea-server.js
sleep 2
pm2 logs pea-server
