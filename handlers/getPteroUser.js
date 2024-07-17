const settings = require('../handlers/readSettings').settings(); 
const fetch = require('node-fetch');

/**
 * This function retrieves account information from the Pterodactyl API.
 * 
 * @param {string} userid - The user ID to lookup.
 * @param {object} db - The database object.
 * @returns {Promise<object>} - A promise that resolves to the account information.
 */
async function getPteroUser(userid, db) {
    return new Promise(async (resolve, reject) => {
        try {
            let userID = await db.get(`users-${userid}`);
            if (!userID) {
                return reject('User ID not found in database');
            }

            let cacheAccount = await fetch(`${settings.pterodactyl.domain}/api/application/users/${userID}?include=servers`, {
                method: "GET",
                headers: { 
                    'Content-Type': 'application/json', 
                    "Authorization": `Bearer ${settings.pterodactyl.key}` 
                }
            });

            if (cacheAccount.status === 404) {
                return reject('Ptero account not found');
            }

            let cacheAccountInfo = await cacheAccount.json();
            resolve(cacheAccountInfo);
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = getPteroUser;