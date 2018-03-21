FROM node:9-alpine

WORKDIR /usr/src/app

COPY package.json /usr/src/app/
COPY yarn.lock /usr/src/app/
RUN yarn install
COPY ./src /usr/src/app/src

VOLUME /data

EXPOSE 8080
CMD [ "npm", "start", "--", "/data" ]
