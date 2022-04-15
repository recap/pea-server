FROM node:16.14-alpine

MAINTAINER Reggie Cushing

RUN mkdir -p /app/public 
RUN mkdir -p /app/src 


ADD pea-server.js /app/
ADD package.json /app/
ADD public /app/public/
ADD src /app/src/
ADD run.sh /app/run.sh
WORKDIR /app/

RUN npm install -g pm2
RUN npm install 
CMD ["sh", "-c", "/app/run.sh"]
 
