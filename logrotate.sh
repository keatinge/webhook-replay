last=$(ls /logs/ | grep -oP '(?<=log)([0-9]+)' | sort | tail -n 1)
next=$((last + 1))
new_log="/logs/log$next.log"
sudo bash -c "docker-compose logs --no-color > $new_log"