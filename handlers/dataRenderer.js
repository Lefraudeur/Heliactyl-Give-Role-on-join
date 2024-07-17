const settings = require('./readSettings').settings(); 
const indexjs = require('../index');
const db = require('./db');

async function renderDataEval(req) {
  const theme = indexjs.get(req);
  const userinfo = req.session.userinfo;

  const packageName = userinfo ? await db.get(`package-${userinfo.id}`) || settings.packages.default : null;
  const extraResources = userinfo ? await db.get(`extra-${userinfo.id}`) || { ram: 0, disk: 0, cpu: 0, servers: 0 } : null;
  const packages = userinfo ? settings.packages.list[await db.get(`package-${userinfo.id}`) || settings.packages.default] : null;
  const coins = settings.coins.enabled ? (userinfo ? await db.get(`coins-${userinfo.id}`) || 0 : null) : null;

  return {
      req,
      settings: settings,
      userinfo,
      packagename: packageName,
      extraresources: extraResources,
      packages,
      coins,
      pterodactyl: req.session.pterodactyl,
      theme: theme.name || "default",
      db
  };
}

module.exports = { renderDataEval };