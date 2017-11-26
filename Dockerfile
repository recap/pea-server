FROM google/nodejs

MAINTAINER Reggie Cushing

RUN mkdir /app/public 
RUN mkdir /app/src 


ADD pea-server.js /app/
ADD package.json /app/
ADD common.js /app/
ADD public /app/public/
ADD src /app/src/

RUN npm install 


CMD ["node", "pea-server.js", "80", "443"]
 
