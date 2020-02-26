FROM node:12.13 as node-builder
COPY whfrontend /whreplay/whfrontend
WORKDIR /whreplay/whfrontend
RUN npm install
RUN npm run build
FROM golang:1.13 as go-builder
COPY backend /whreplay/backend
WORKDIR /whreplay/backend
RUN go get -d .
RUN GOOS=linux go build -o /whreplay/server *.go
FROM alpine:3.11
# Get GLIBC because go-sqlite3 doesn't allow static compilation
RUN apk --no-cache add ca-certificates wget && \
    wget -q -O /etc/apk/keys/sgerrand.rsa.pub https://alpine-pkgs.sgerrand.com/sgerrand.rsa.pub && \
    wget https://github.com/sgerrand/alpine-pkg-glibc/releases/download/2.28-r0/glibc-2.28-r0.apk && \
    apk add glibc-2.28-r0.apk
COPY --from=node-builder /whreplay/whfrontend/build /whreplay/whfrontend/build
COPY --from=go-builder /whreplay/server /whreplay/server

WORKDIR /whreplay
CMD ["/whreplay/server"]
