# pea-server
Peer to peer file sharing through web browsers. Share files directly from your computer/smartphone to other devices directly without saving files to the cloud. 
Public randezvous server at [dataplane.io](https://dataplane.io).

## How does it work?
The technique employed here is Interactive Connectivity Establishment (ICE). ICE is a method that uses STUN (Session Traversal Utilities for NAT), TURN (Traversal Using Relay around NAT) and a signalling server to setup a connection between two endpoints. In turn, this method relies on a technique known as [UDP hole punching](https://en.wikipedia.org/wiki/UDP_hole_punching) which uses UDP to work around NATs. The success of hole punching depends on the NAT implementation. Typically, endpoint-independent mapping would allow this while an address/port dependent mapping (a.k.a symmetric NAT) would not allow UDP hole punching. Pea-server is a signalling server, while we use publicly available STUN servers provided by Google. TURN is disabled so that we only esteblish peer to peer connections or nothing at all.  

In this setup 2 browsers wanting to set up a connection will use the pea-server to exchange ICE candidates (IP and port). The browsers will attempt to open a channel using different combinations of candidates. Once a channel is established, we use it as an FTP channel by exchanging files lists and file data. 

## Pros:
- Easy for users to start using (only 3 clicks to start serving a file).
- Secure end-to-end encryption for file transfers.
- Easy to stop server (just kill browser tab).
- Direct file transfers i.e. no cloud services involved in handling data.

## Cons:
- Connectivity depends on the local/remote network firewalls ability to let UDP holes.
- Browser has to remain open while transfers are taking place.
- Not yet suitable for large files.
- Not suitable for permanent file server.

## Try it out
A Docker pre built image is available on Dockerhub. To run locally:
```
docker run -d -p 8080:80 recap/pea-server
```
- Make sure port 8080 is open locally. 
- Point a browser to your server IP on port 8080.
- Click on the upload icon to add files to your browser server.
- Open a second browser by scanning the QR-code. 
- If everything goes right you should see the list of files.
- If the loading icon keeps looping then a peer to peer connection could not be setup most probably because of NAT setups.
 
## Install
### local
```shell
git clone https://github.com/recap/pea-server.git
cd pea-server 
npm install
node pea-server.js 8080
```
_goto http://127.0.0.1:8080_

### docker
```shell
make buid
make run
```
Get container IP
```shell
docker ps
docker inspect [CONTAINER ID] | grep IPAddress
```
_goto http://[CONTAINER IP]_

