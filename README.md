# pea-server
Share files directly from your computer/smartphone to other devices directly with saving files to the cloud. 
Public randezvous server at [dataplane.io](https://dataplane.io).

## Pros:
- Easy for users to start using (only 3 clicks to start serving a file).
- Secure end-to-end encryption for file transfers.
- Easy to stop server (just kill browser tab).
- Direct file transfers i.e. no cloud services involved in handling data.

## Cons:
- Browser has to remain open while transfers are taking place.
- Files larges than 400MB might be problematic.
- Not suitable for permanent file server.

## How it works
Pea-server uses webRTC technology which is available in modern browsers such as chrome and firefox.
WebRTC (Real Time Communication) allows data to be transferred directly between browsers. A randezvous
server is used for signaling i.e. help both browsers setup their direct channel. 


## Install
### local
git clone https://github.com/recap/pea-server.git
cd pea-server 
openssl req -x509 -newkey rsa:2048 -keyout keytmp.pem -out cert.pem -days 365 -nodes
npm install
node pea-server.js 8080 8585
_goto http://127.0.0.1:8080_

### docker
docker build -t pea-server .
docker run --net=host pea-server /bin/sh
__get certificates from [letsencrypt](https://letsencrypt.org/)__
node pea-server.js 80 443

