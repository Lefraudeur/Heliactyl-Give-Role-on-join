const fetch = require('node-fetch');
const { renderFile } = require('ejs');
const fs = require('fs');

const newsettings = require('../handlers/readSettings').settings(); 

module.exports = async (key, db, ip) => {
    return new Promise(async (resolve, reject) => {
        try {
            let ipcache = await db.get(`vpncheckcache-${ip}`);
            let vpncheck;

            if (!ipcache) {
                vpncheck = await fetch(`https://proxycheck.io/v2/${ip}?key=${key}&vpn=1`).then(res => res.json()).catch(() => { });
            }

            if (ipcache || (vpncheck && vpncheck[ip])) {
                if (!ipcache) ipcache = vpncheck[ip].proxy;
                await db.set(`vpncheckcache-${ip}`, ipcache, 172800000);

                // Is a VPN/proxy?
                if (ipcache === "yes") {
                    renderFile(
                        `./themes/${newsettings.theme}/alerts/vpn.ejs`,
                        {
                            settings: newsettings,
                            db,
                            extra: { home: { name: 'VPN Detected' } }
                        },
                        (err, renderedTemplate) => {
                            if (err) {
                                console.error(err);
                                reject(err);
                            } else {
                                resolve(renderedTemplate);
                            }
                        }
                    );
                } else {
                    resolve(false);
                }
            } else {
                resolve(false);
            }
        } catch (error) {
            reject(error);
        }
    });
};
