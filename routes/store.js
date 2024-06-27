const adminjs = require("./admin.js");
const log = require('../handlers/log');
const settings = require('../handlers/readSettings').settings(); 

module.exports.load = async function(app, db) {
  const buyResource = async (req, res, resourceType, resourceName) => {
    if (!req.session || !req.session.pterodactyl) return res.redirect("/login");

    let newsettings = await enabledCheck(req, res);
    if (!newsettings) return;

    const amount = parseInt(req.query.amount);
    if (!amount || isNaN(amount) || amount < 1 || amount > 10) return res.send("Invalid amount");

    const userCoins = (await db.get(`coins-${req.session.userinfo.id}`)) || 0;
    const resourceCap = (await db.get(`${resourceType}-${req.session.userinfo.id}`)) || 0;

    // just idk
    if (resourceCap + amount > settings.coins.store.storelimits[resourceType]) 
      return res.redirect(`/store?err=MAX${resourceName}EXCEETED`);

    const per = newsettings.coins.store[resourceType].per * amount;
    const cost = newsettings.coins.store[resourceType].cost * amount;

    if (userCoins < cost) return res.redirect(`/store?err=CANNOTAFFORD`);

    const newUserCoins = userCoins - cost;
    const newResource = resourceCap + amount;
    if (newUserCoins === 0) {
      await db.delete(`coins-${req.session.userinfo.id}`);
      await db.set(`${resourceType}-${req.session.userinfo.id}`, newResource);
    } else {
      await db.set(`coins-${req.session.userinfo.id}`, newUserCoins);
      await db.set(`${resourceType}-${req.session.userinfo.id}`, newResource);
    }

    let extra = (await db.get(`extra-${req.session.userinfo.id}`)) || { ram: 0, disk: 0, cpu: 0, servers: 0 };
    extra[resourceType] = extra[resourceType] + per;

    if (Object.values(extra).every(val => val === 0)) {
      await db.delete(`extra-${req.session.userinfo.id}`);
    } else {
      await db.set(`extra-${req.session.userinfo.id}`, extra);
    }

    adminjs.suspend(req.session.userinfo.id);

    log(`resources purchased`, `${req.session.userinfo.username}#${req.session.userinfo.discriminator} bought ${per} ${resourceName} from the store for \`${cost}\` Credits.`);

    res.redirect("/store?success=SUCCESS");
  };

  app.get("/buyram", async (req, res) => buyResource(req, res, "ram", "RAM"));
  app.get("/buydisk", async (req, res) => buyResource(req, res, "disk", "Disk"));
  app.get("/buycpu", async (req, res) => buyResource(req, res, "cpu", "CPU"));
  app.get("/buyservers", async (req, res) => buyResource(req, res, "servers", "Servers"));

  async function enabledCheck (req, res) {
    let newsettings = require('../handlers/readSettings').settings(); 
    if (newsettings.coins.store.enabled) return newsettings;
    else return res.redirect("/dashboard?err=STOREDISABLED");
  }
};