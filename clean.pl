$out = `docker ps | grep qahba | awk '{print \$1}' | xargs docker rm 2>/dev/null`;
exit(0);
