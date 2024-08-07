> [!WARNING]
> Overnode has semi-deprecated Fixed Heliactyl. Overnode is now developing [Fixed Palladium](https://github.com/OvernodeProjets/Fixed-Palladium). Heliactyl is now end of life (EOL), the still-updated forks of Heliactyl are: [Plexactyl](https://github.com/Plexactyl/panel), [Heliactyl (by Ghostload)](https://github.com/Heliactyl-Project/Heliactyl) and Fixed Heliactyl.
# Fixed Heliactyl • The Modern Client Panel for Pterodactyl

![Heliactyl](https://github.com/OvernodeProjets/Fixed-Heliactyl/assets/73477238/fe5aaf5c-1c01-4145-b37a-b91b184354b5)

> [!WARNING]
> Fixed Heliactyl 12.8 and above are not compatible with older files (themes and settings.json files) due to major modifications. For themes: Replace all `settings.api.client` with `settings`. For settings: Reconfigure using YAML. Thank you for understanding.
## Features

- **Resource Management**: Create servers, manage resources.
- **Coins**: Earn through AFK pages, J4R, Coupon.
- **Renewal**: Use coins for server renewal.
- **Coupons**: Distribute resources and coins.
- **Servers**: Create, view, and edit servers.
- **Payments**: Stripe integration for purchases.
- **User System**: Authentication, password regeneration, etc.
- **Store**: Purchase resources with coins.
- **Dashboard**: Overview of resources.
- **Join for Rewards**: Earn coins by joining Discord servers.
- **Admin Panel**: Manage coins, resources, coupons.
- **API**: For bots and other integrations.

## Install Guide

### 1. Configuring Heliactyl

#### Pterodactyl Method (Easiest)

1. **Upload File**: Upload the Heliactyl file to a Pterodactyl NodeJS server. [Download the egg from Pelican Eggs Library](https://github.com/pelican-eggs/generic/blob/main/nodejs/egg-pterodactyl-node-js-generic.json)
2. **Setup NodeJS**: Unarchive the file and set the server to use NodeJS 16.

#### Direct Method

1. **Install Node.js 16 or newer it's recommended to install it with nvm**:

- `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash`
- reopen a new ssh session (e.g., restart putty)
- `nvm install 16`
- check the node version with `node -v` and switch between versions with `nvm use <version>`

2. **Download heliactyl files in /var/www/heliactyl**:

- `git clone https://github.com/OvernodeProjets/Fixed-Heliactyl.git /var/www/heliactyl`

3. **Installing required node modules (and build dependencies to avoid errors)**:

- `apt-get update && apt-get install libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev build-essential`
- `cd /var/www/heliactyl && npm i`

After configuring settings.json, to start the server, use `node index.js`</br>
To run in the background, use PM2 (see PM2 section)</br>

## 2. Setting up webserver

1. Rename settings_example.yml to settings.yml and configure settings.yml (specify panel domain/apikey and discord auth settings for it to work)

2. Start the server (Ignore the 2 strange errors that might come up)

3. Login to your DNS manager, point the domain you want your dashboard to be hosted on to your VPS IP address. (Example: dashboard.domain.com 192.168.0.1)

4. Run `apt install nginx && apt install certbot` on the vps

5. Run `ufw allow 80` and `ufw allow 443` on the vps

6. Run `certbot certonly -d <Your Heliactyl Domain>` then do 1 and put your email

7. Run `nano /etc/nginx/sites-enabled/heliactyl.conf`

8. Paste the configuration at the bottom of this and replace with the IP of the pterodactyl server including the port and with the domain you want your dashboard to be hosted on.

9. Run `systemctl restart nginx` and try open your domain.

## Nginx Proxy Config

```Nginx
server {
    listen 80;
    listen [::]:80;
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name <domain>;

    ssl_certificate /etc/letsencrypt/live/<domain>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<domain>/privkey.pem;
    ssl_session_cache shared:SSL:10m;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'HIGH:!aNULL:!MD5:!ECDHE-RSA-AES128-SHA';
    
    if ($scheme = http) {
        return 301 https://$server_name$request_uri;
    }

    location /afk/ws {
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_pass http://localhost:<port>/afk/ws;
    }
    
    location / {
        proxy_pass http://localhost:<port>/;
        proxy_buffering off;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

<hr>

## Updating

### From Heliactyl v11/v13 or Dashactyl v0.4 to Heliactyl v12:

1. Store certain things such as your api keys, discord auth settings, etc in a .txt file
2. Download database.sqlite
3. Delete all files off the server (or delete and remake the folder if done in ssh)
4. Upload the latest Heliactyl v12 release and unzip it
5. Upload database.sqlite and reconfigure settings.yml

### Move to Heliactyl 14+:

1. Delete everything except database.sqlite
2. Put the files that you didn't delete into a zip file
3. Upload the latest Heliactyl release and unzip it
4. Upload database.sqlite and reconfigure settings

<hr>

## Running in background / on startup, on a server instead of within Pterodactyl

### Installing [pm2](https://github.com/Unitech/pm2):

- Run `npm install pm2 -g` on the server

### Starting the Dashboard in Background:

- Change directory to your Heliactyl folder Using `cd` command, Example: `cd /var/www/heliactyl`
- To run Heliactyl, use `pm2 start index.js --name "heliactyl"`
- To view logs, run `pm2 logs Heliactyl`

### Making the dashboard run on startup:

- Make sure your dashboard is running in the background with the help of [pm2](https://github.com/Unitech/pm2)
- You can check if Heliactyl is running in the background with `pm2 list`
- Once you confirm that Heliactyl is running in the background, you can create a startup script by running `pm2 startup` and `pm2 save`
- Note: Supported init systems are `systemd`, `upstart`, `launchd`, `rc.d`
- To stop your Heliactyl from running in the background, use `pm2 unstartup`

To stop a currently running Heliactyl instance, use `pm2 stop heliactyl`

<br>

## Credit:
 - Dashactyl 0.3.1 & 0.4 (0.3.1 Base - 0.4 Database System)
 - Heliactyl (v12 Base - v14 Api Documentation - v15 Afk System but remade)
 - Faliactyl (Settings system)

> [!WARNING]
>
> We cannot force you to keep "Powered by Heliactyl" in the footer, but please consider keeping it. It helps to get more visibility for the project, which is getting better. We won't > provide technical support for installations without the notice in the footer. We may DMCA the website under certain conditions.
> Please do keep the footer, though.
