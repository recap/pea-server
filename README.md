# pea-server
##
A browser based web server. Files are hosted inside the web browser, a proxy server in Node.js proxies the requests from 
client web browsers to server web browsers. 

## Example
A running example can be found ad http://dataplane.io

##Install
docker build -t pea-server .
docker run -d --net=host pea-server

goto http:\\127.0.0.1

