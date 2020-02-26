pushd ~/install/webhook-replay
git pull
docker system prune -a
docker load -i whreplay.tar
touch replay.db
docker-compose down
docker-compose up -d
docker ps -a
