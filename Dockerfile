#build using docker
FROM node:carbon-alpine as builder
RUN apk add --no-cache make gcc g++ python zeromq-dev
WORKDIR /home/build
COPY package*.json yarn* .babelrc ./
COPY src src/
RUN yarn install && yarn build

FROM node:carbon-alpine
RUN mkdir -p /usr/app /usr/app/web
WORKDIR /usr/app
EXPOSE 3001
COPY --from=builder /home/build/node_modules node_modules
COPY --from=builder /home/build/dist dist
COPY config/les.json config/les.json
COPY start-server.sh /usr/app/start-server.sh
CMD [ "/usr/app/start-server.sh" ]
