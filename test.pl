$ip = `docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' qahba`;
chomp($ip);
$out = `curl -i $ip:8080 2>/dev/null | grep -e ^HTTP | awk '{print \$2}'`;

if ($out == 200) {
	exit(0);
} else {
	$log = `curl -i $ip:8080`;
	print($ip);
	print($log);
	exit(1);
}
