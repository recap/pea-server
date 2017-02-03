FROM google/nodejs

MAINTAINER Reggie Cushing

RUN mkdir /app/public 


ADD pea-server.js /app/
ADD package.json /app/
ADD public /app/public/

RUN npm install 


CMD ["node", "pea-server.js"]
 
