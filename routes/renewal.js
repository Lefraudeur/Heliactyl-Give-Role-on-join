const settings = require('../handlers/readSettings').settings(); 
const { CronJob } = require("cron");
const getAllServers = require("../handlers/getAllServers");
const fetch = require("node-fetch");
const chalk = require("chalk");

module.exports.load = async (app, db) => {

    app.get(`/api/renewalstatus`, async (req, res) => {
        if (!settings.renewals.status 
          || !req.query.id 
          || !req.session.pterodactyl 
          || !req.session 
          || req.session.pterodactyl.relationships.servers.data.filter(server => server.attributes.id == req.query.id).length == 0) 
          return res.json({ error: true });

        const lastRenewal = await db.get(`lastrenewal-${req.query.id}`); // c
        if (!lastRenewal) return res.json({ text: "Disabled" });

        if (!lastRenewal < Date.now()) {
          const renewalDelay = settings.renewals.delay * 86400000;
          if ((Date.now() - lastRenewal) > renewalDelay) return res.json({ text: "Time to renew", renewable: true });
          
          const time = msToDaysAndHours(renewalDelay - (Date.now() - lastRenewal));
          return res.json({ text: time, renewable: false });
        }

        return res.json({ text: "Renewed", success: true });
    })

    app.get(`/renew`, async (req, res) => {
      if (!settings.renewals.status) return res.redirect("/dashboard?err=RENEWALSDISABLED");
      if (!req.query.id) return res.send("Missing ID.");
      if (!req.session.pterodactyl) return res.redirect("/login");
      
      const server = req.session.pterodactyl.relationships.servers.data.find(server => server.attributes.id == req.query.id);
      if (!server) return res.send(`No server with that ID was found!`);
  
      const lastRenewal = await db.get(`lastrenewal-${req.query.id}`);
      const currentTime = Date.now();
  
      if (!lastRenewal) {
          await db.set(`lastrenewal-${req.query.id}`, currentTime);
          return res.redirect("/dashboard?err=NORENEWRECORD");
      }
  
      const nextEligibleRenewalTime = lastRenewal + (settings.renewals.delay * 86400000);
  
      if (currentTime < nextEligibleRenewalTime) return res.redirect("/dashboard?success=NEXTELIGIBLERENEWALTIME");
  
      let coins = await db.get(`coins-${req.session.userinfo.id}`);
      coins = coins ? coins : 0;

      const renewCost = settings.renewals.cost
  
      if (renewCost > coins) return res.redirect("/dashboard?err=CANNOTAFFORDRENEWAL");
      
      await db.set(`coins-${req.session.userinfo.id}`, coins - renewCost);
      await db.set(`lastrenewal-${req.query.id}`, currentTime);
  
      return res.redirect("/dashboard?success=RENEWED");
  });

    new CronJob(`0 0 * * *`, async () => {
        if (settings.renewals.status) {
          console.log(`${chalk.cyan("[heliactyl]")}${chalk.white(" Checking renewal servers... ")}`);
            getAllServers().then(async servers => {
                for (const server of servers) {
                    const id = server.attributes.id;
                    const lastRenewal = await db.get(`lastrenewal-${id}`);
                    if (!lastRenewal) continue;

                    if (lastRenewal > Date.now()) continue;
                    if ((Date.now() - lastRenewal) > (settings.renewals.delay * 86400000)) {
                        // Server hasn't paid for renewal and gets suspended
                        let deletionresults = await fetch(`${settings.pterodactyl.domain}/api/application/servers/${id}/suspend`, {
                            method: "POST",
                            headers: {
                                'Content-Type': 'application/json',
                                "Authorization": `Bearer ${settings.pterodactyl.key}`
                            }
                          });
                        let ok = await deletionresults.ok;
                        if (!ok) continue;
                        console.log(`Server with ID ${id} failed renewal and was deleted.`);
                        await db.delete(`lastrenewal-${id}`);
                    }
                }
            })
            console.log(`${chalk.cyan("[Heliactyl]")}${chalk.white("The renewal check-over is now complete.")}`);
        }
    }, null, true, settings.timezone).start()
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