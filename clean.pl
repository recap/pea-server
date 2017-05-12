$out = `docker ps | grep qahba | awk '{print \$1}' | xargs docker rm -f`;
print($out);
exit(0);
