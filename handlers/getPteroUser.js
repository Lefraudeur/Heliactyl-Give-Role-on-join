const settings = require('../handlers/readSettings').settings(); 

const fetch = require('node-fetch')

module.exports = async (userid, db) => {
    return new Promise(async (resolve, err) => {
        let cacheAccount = await fetch(
            `${settings.pterodactyl.domain}/api/application/users/${(await db.get(`users-${userid}`))}?include=servers`,
            {
                method: "GET",
                headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
            }
        );
        if (await cacheAccount.statusText === "Not Found") return err('Ptero account not found');
        let cacheAccountInfo = JSON.parse(await cacheAccount.text());
        resolve(cacheAccountInfo);
    })
}