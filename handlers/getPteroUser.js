const settings = require('../handlers/readSettings').settings(); 

const fetch = require('node-fetch')
module.exports = async (userid, db) => {
    try {
      let cacheAccount = await fetch(
        `${settings.pterodactyl.domain}/api/application/users/${(await db.get(`users-${userid}`))}?include=servers`,
        {
          method: "GET",
          headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
        }
      );
  
      if (cacheAccount.statusText === "Not Found") throw new Error('Ptero account not found');
      
      let cacheAccountInfo = await cacheAccount.json();
      return cacheAccountInfo;
    } catch (error) {
      console.error(error);
      return null;
    }
  }