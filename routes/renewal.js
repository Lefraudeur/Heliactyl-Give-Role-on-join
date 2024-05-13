const settings = require('../handlers/readSettings').settings(); 
const { CronJob } = require("cron");
const getAllServers = require("../handlers/getAllServers");
const fetch = require("node-fetch");
const chalk = require("chalk");

if (settings.pterodactyl && settings.pterodactyl.domain && settings.pterodactyl.domain.endsWith("/")) {
  settings.pterodactyl.domain = settings.pterodactyl.domain.slice(0, -1);
}

module.exports.load = async function (app, db) {
  // Renewal system is...
  app.get(`/api/renewalstatus`, async (req, res) => {
    if (!settings.renewals.status) return res.json({ error: true });
    if (!req.query.id) return res.json({ error: true });
    if (!req.session.pterodactyl) return res.json({ error: true });
    const server = req.session.pterodactyl.relationships.servers.data.filter((server) => server.attributes.id === req.query.id)[0];
    if (!server) return res.json({ error: true });

    const lastRenewal = await db.get(`lastrenewal-${req.query.id}`);
    if (!lastRenewal) return res.json({ text: 'Disabled' });

    if (lastRenewal > Date.now()) return res.json({ text: 'Renewed', success: true });
    else {
      const delay = settings.renewals.delay * 86400000;
      if (Date.now() - lastRenewal > delay) {
        return res.json({ text: 'Last chance to renew!', renewable: true });
      }
      const time = msToDaysAndHours(delay - (Date.now() - lastRenewal));
      return res.json({ text: time, renewable: true });
    }
  });

  app.get(`/renew`, async (req, res) => {
    if (!settings.renewals.status) return res.send(`Renewals are currently disabled.`);
    if (!req.query.id) return res.send(`Missing ID.`);
    if (!req.session.pterodactyl) return res.redirect(`/login`);
    const server = req.session.pterodactyl.relationships.servers.data.filter((server) => server.attributes.id === req.query.id)[0];
    if (!server) return res.send(`No server with that ID was found!`);

    const lastRenewal = await db.get(`lastrenewal-${req.query.id}`);
    if (!lastRenewal) return res.send('No renewals are recorded for this ID.');

    if (lastRenewal > Date.now()) return res.redirect(`/dashboard`);

    let coins = await db.get("coins-" + req.session.userinfo.id);
    coins = coins? coins : 0;

    if (settings.renewals.cost > coins) return res.redirect(`/dashboard` + "?err=CANNOTAFFORDRENEWAL");

    await db.set("coins-" + req.session.userinfo.id, coins - settings.renewals.cost);

    const newTime = lastRenewal + settings.renewals.delay * 86400000;
    await db.set(`lastrenewal-${req.query.id}`, newTime);

    return res.redirect(`/dashboard` + `?success=RENEWED`);
  });

  new CronJob(`0 0 * * *`, async () => {
    if (settings.renewals.status) {
      console.log(chalk.cyan("[heliactyl]") + chalk.white(" Checking renewal servers... "));
      const servers = await getAllServers();
      for (const server of servers) {
        const id = server.attributes.id;
        const lastRenewal = await db.get(`lastrenewal-${id}`);
        if (!lastRenewal) continue;

        if (lastRenewal > Date.now()) continue;
        if (Date.now() - lastRenewal > settings.renewals.delay * 86400000) {
          // Server hasn't paid for renewal and gets suspended
          let reponse = await fetch(
            settings.pterodactyl.domain + "/api/application/servers/" + id + "/suspend",
            {
              method: "post",
              headers: {
                'Content-Type': 'application/json',
                "Authorization": `Bearer ${settings.pterodactyl.key}`
              }
            }
          );
          let ok = await reponse.ok;
          if (ok!== true) continue;
          console.log(`Server with ID ${id} failed renewal and was deleted.`);
          await db.delete(`lastrenewal-${id}`);
        }
      }
      console.log(chalk.cyan("[Heliactyl]") + chalk.white("The renewal check-over is now complete."));
    }
  }, null, true, settings.timezone)
   .start()
};

function msToDaysAndHours(ms) {
  const msInDay = 86400000;
  const msInHour = 3600000;

  const days = Math.floor(ms / msInDay);
  const hours = Math.round((ms - days * msInDay) / msInHour * 100) / 100;

  const pluralDays = days === 1 ? "" : "s";
  const pluralHours = hours === 1 ? "" : "s";

  return `${days} day${pluralDays} and ${hours} hour${pluralHours}`;
}