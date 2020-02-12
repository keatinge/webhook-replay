FROM node:12.13 as node-builder
COPY rfront /whreplay/rfront
WORKDIR /whreplay/rfront
RUN npm install
RUN npm run build
FROM golang:1.13 as go-builder
RUN apt-get update && apt-get install -y sqlite3
COPY go.mod *.go /whreplay/
WORKDIR /whreplay
RUN go get -d .
RUN GOOS=linux go build -o /whreplay/server *.go
FROM alpine:3.11
# Get GLIBC because go-sqlite3 doesn't allow static compilation
RUN apk --no-cache add ca-certificates wget && \
    wget -q -O /etc/apk/keys/sgerrand.rsa.pub https://alpine-pkgs.sgerrand.com/sgerrand.rsa.pub && \
    wget https://github.com/sgerrand/alpine-pkg-glibc/releases/download/2.28-r0/glibc-2.28-r0.apk && \
    apk add glibc-2.28-r0.apk
COPY --from=node-builder /whreplay/rfront/build /whreplay/rfront/build
COPY --from=go-builder /whreplay/server /whreplay/server

WORKDIR /whreplay
CMD ["/whreplay/server"]
