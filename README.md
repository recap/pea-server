# pea-server
##
A browser based p2p ftp server. Files are hosted inside the web browser, a signal server in Node.js is used to setup webrtc channels
between client browser and server browser.

## Example
A running example can be found ad http://dataplane.io

##Install
docker build -t pea-server .

docker run -d --net=host pea-server

goto http:\\\\127.0.0.1

