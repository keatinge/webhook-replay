sudo apt-get update
sudo apt-get install -y nginx git
mkdir ~/install
pushd  ~/install
git clone https://github.com/keatinge/webhook-replay.git

sudo mkdir /logs
sudo touch /logs/nginx-access.log
sudo touch /logs/nginx-error.log

# Install docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install docker-compose
sudo curl -L "https://github.com/docker/compose/releases/download/1.25.3/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Allow to run docker as non-root
sudo groupadd docker
sudo gpasswd -a $USER docker
newgrp docker

# Setup HTTPS
sudo apt install python3-acme python3-certbot python3-mock python3-openssl python3-pkg-resources python3-pyparsing python3-zope.interface
sudo apt install python3-certbot-nginx
