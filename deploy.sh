docker build -t 'whreplay:latest' .
docker save 'whreplay:latest' -o 'whreplay.tar'
scp 'whreplay.tar' 34.69.161.110:~/install/webhook-replay/replay.tar