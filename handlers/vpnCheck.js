const fetch = require('node-fetch');
const settings = require('../handlers/readSettings').settings();
const getTemplate = require('../handlers/getTemplate').template;

/**
 * This function performs a VPN check using the proxycheck.io API.
 * 
 * @param {string} key - The API key for proxycheck.io.
 * @param {object} db - The database object.
 * @param {string} ip - The IP address to check.
 * @param {object} res - The response object.
 * @returns {Promise<boolean>} - A promise that resolves to a boolean indicating whether the IP is a VPN/proxy or not.
 */
async function vpnCheck(key, db, ip, res) {
  return new Promise(async (resolve) => {
    let ipcache = await db.get(`vpncheckcache-${ip}`);
    let vpncheck;

    if (!ipcache) {
      vpncheck = await fetch(`https://proxycheck.io/v2/${ip}?key=${key}&vpn=1`)
        .then(response => response.json())
        .catch(() => null);
    }

    if (ipcache || (vpncheck && vpncheck[ip])) {
      if (!ipcache) ipcache = vpncheck[ip].proxy;
      await db.set(`vpncheckcache-${ip}`, ipcache, 172800000);

      // Is a VPN/proxy?
      if (ipcache === "yes") {
        res.send(getTemplate("Detected VPN", `${settings.name} detected that you are using a VPN; Please turn it off to continue.`, true));
        resolve(true);
      } else {
        resolve(false);
      }
    } else {
      resolve(false);
    }
  });
}

module.exports = { vpnCheck };