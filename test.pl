$ip_ = `docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' qahba`;
$ip = chomp($ip_);
print($ip);
$log = `curl -i $ip:8080`;
$out = `curl -i $ip:8080 2>/dev/null | grep -e ^HTTP | awk '{print \$2}'`;
if ($out == 200) {
	print($log);
	exit(0);
} else {
	print($log);
	exit(1);
}
