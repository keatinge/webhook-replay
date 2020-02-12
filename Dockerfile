FROM node:12.13 as node-builder
COPY rfront /whreplay/rfront
WORKDIR /whreplay/rfront
RUN npm run build
FROM golang:1.13 as go-builder
RUN apt-get update && apt-get install -y sqlite3
COPY go.mod *.go /whreplay/
WORKDIR /whreplay
RUN go get -d .
RUN GOOS=linux go build -o /whreplay/server *.go
COPY --from=node-builder /whreplay/rfront/build /whreplay/rfront/build
CMD ["/whreplay/server"]
