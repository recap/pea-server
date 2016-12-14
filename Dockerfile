FROM google/nodejs

MAINTAINER Reggie Cushing

RUN mkdir /app/public 
RUN mkdir /app/Delivery.js

ADD pea-server.js /app/
ADD public /app/public/
ADD Delivery.js /app/Delivery.js/

RUN npm install http
RUN npm install url
RUN npm install path
RUN npm install querystring
RUN npm install finalhandler
RUN npm install serve-static
RUN npm install fs
RUN npm install events
RUN npm install uuid
RUN npm install mime
RUN npm install socket.io


CMD ["node", "pea-server.js"]
 
