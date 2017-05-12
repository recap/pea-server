$out = `curl -i localhost:8080 2>/dev/null | grep -e ^HTTP | awk '{print \$2}'`;
if ($out == 200) {
	print($out);
	exit(0);
} else {
	print($out);
	exit(1);
}
