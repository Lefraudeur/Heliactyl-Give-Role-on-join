const indexjs = require("../index.js");
const adminjs = require("./admin.js");
const fs = require("fs");
const ejs = require("ejs");
const log = require('../handlers/log');
const path = require("path");

module.exports.load = async function(app, db) {
  const buyResource = async (req, res, resourceType, resourceName) => {
    if (!req.session.pterodactyl) return res.redirect("/login");

    let newsettings = await enabledCheck(req, res);
    if (!newsettings) return;

    const amount = parseInt(req.query.amount);
    if (!amount || isNaN(amount) || amount < 1 || amount > 10) return res.send("Invalid amount");

    const theme = indexjs.get(req);
    const failedCallback = theme.settings.redirect[`failedPurchase${resourceName}`] || "/store";

    const userCoins = (await db.get(`coins-${req.session.userinfo.id}`)) || 0;
    const resourceCap = (await db.get(`${resourceType}-${req.session.userinfo.id}`)) || 0;

    const per = newsettings.api.client.coins.store[resourceType].per * amount;
    const cost = newsettings.api.client.coins.store[resourceType].cost * amount;

    if (userCoins < cost) return res.redirect(`${failedCallback}?err=CANNOTAFFORD`);

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

    res.redirect((theme.settings.redirect[`purchase${resourceName}`] || "/store") + "?err=none");
  };

  app.get("/buyram", async (req, res) => buyResource(req, res, "ram", "RAM"));
  app.get("/buydisk", async (req, res) => buyResource(req, res, "disk", "Disk"));
  app.get("/buycpu", async (req, res) => buyResource(req, res, "cpu", "CPU"));
  app.get("/buyservers", async (req, res) => buyResource(req, res, "servers", "Servers"));

  async function enabledCheck(req, res) {
    const newsettings = require('../handlers/readSettings').settings(); 
    if (newsettings.api.client.coins.store.enabled === true) return newsettings;

    const theme = indexjs.get(req);
    ejs.renderFile(
      `./themes/${theme.name}/${theme.settings.notfound}`,
      await indexjs.renderdataeval(req),
      null,
      function (err, str) {
        delete req.session.newaccount;
        if (err) {
          console.log(`[WEBSITE] An error has occurred on path ${req._parsedUrl.pathname}:`);
          console.log(err);
          return res.render("404.ejs", { err });
        }
        res.status(200);
        res.send(str);
      }
    );
    return null;
  }
};
