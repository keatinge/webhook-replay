docker build -t 'whreplay:latest' .
docker save 'whreplay:latest' -o 'whreplay.tar'
scp 'whreplay.tar' 'deploy_server_side.sh' 34.69.161.110:~/install/webhook-replay/
ssh 34.69.161.110 ~/install/webhook-replay/deploy_server_side.sh
