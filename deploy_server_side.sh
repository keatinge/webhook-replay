pushd ~/install/webhook-replay
git pull
docker system prune -a
docker load -i ~/install/replay.tar