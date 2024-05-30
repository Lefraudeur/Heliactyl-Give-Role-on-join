const settings = require('../handlers/readSettings').settings(); 
const indexjs = require("../index.js");
const adminjs = require("./admin.js");
const getPteroUser = require("../handlers/getPteroUser.js");
const Queue = require("../handlers/Queue.js");
const log = require("../handlers/log.js");

const fetch = require("node-fetch");

if (settings.pterodactyl && settings.pterodactyl.domain && settings.pterodactyl.domain.endsWith("/")) {
  settings.pterodactyl.domain = settings.pterodactyl.domain.slice(0, -1);
}
module.exports.load = async function (app, db) {
  const queue = new Queue();
  app.get("/create", async (req, res) => {
    if (!req.session.pterodactyl) return res.redirect("/login");

    let theme = indexjs.get(req);
    const newsettings = require('../handlers/readSettings').settings();
    let redirectLink = theme.settings.redirect.failedcreateserver ?? "/";

    if (!newsettings.allow.server.create) 
      return res.redirect(theme.settings.redirect.createserverdisabled || "/");
    
      queue.addJob(async (cb) => {
        const cacheAccount = await getPteroUser(req.session.userinfo.id, db);
        if (!cacheAccount) {
          cb();
          return res.send('Heliactyl failed to find an account on the configured panel, try relogging');
        }
        
        req.session.pterodactyl = cacheAccount.attributes;

        if (req.query.name && req.query.ram && req.query.disk && req.query.cpu && req.query.egg && req.query.location) {
          try {
            decodeURIComponent(req.query.name);
          } catch (err) {
            cb();
            return res.redirect(`${redirectLink}?err=COULDNOTDECODENAME`);
          }

          let packagename = await db.get(`package-${req.session.userinfo.id}`);
          let package = newsettings.packages.list[packagename ? packagename : newsettings.packages.default];

          let extra = await db.get(`extra-${req.session.userinfo.id}`) || { ram: 0, disk: 0, cpu: 0, servers: 0 };

          let ram2 = 0;
          let disk2 = 0;
          let cpu2 = 0;
          let servers2 = req.session.pterodactyl.relationships.servers.data.length;
          for (let i = 0, len = req.session.pterodactyl.relationships.servers.data.length; i < len; i++) {
            ram2 = ram2 + req.session.pterodactyl.relationships.servers.data[i].attributes.limits.memory;
            disk2 = disk2 + req.session.pterodactyl.relationships.servers.data[i].attributes.limits.disk;
            cpu2 = cpu2 + req.session.pterodactyl.relationships.servers.data[i].attributes.limits.cpu;
          };

          if (servers2 >= package.servers + extra.servers) {
            cb();
            return res.redirect(`${redirectLink}?err=TOOMUCHSERVERS`);
          }

          let name = decodeURIComponent(req.query.name);
          if (name.length < 1) { 
            cb();
            return res.redirect(`${redirectLink}?err=LITTLESERVERNAME`);
          }
          if (name.length > 191) {
            cb();
            return res.redirect(`${redirectLink}?err=BIGSERVERNAME`);
          }

          let location = req.query.location;

          if (Object.entries(newsettings.locations).filter(vname => vname[0] == location).length !== 1) {
            cb();
            return res.redirect(`${redirectLink}?err=INVALIDLOCATION`);
          }

          let requiredpackage = Object.entries(newsettings.locations).filter(vname => vname[0] == location)[0][1].package;
          if (requiredpackage && !requiredpackage.includes(packagename ? packagename : newsettings.packages.default)) {
            cb();
            return res.redirect(`${redirectLink}?err=PREMIUMLOCATION`);
          }

          let egg = req.query.egg;
          let egginfo = newsettings.eggs[egg];

          if (!egginfo) {
            cb();
            return res.redirect(`${redirectLink}?err=INVALIDEGG`);
          }

          let ram = parseFloat(req.query.ram);
          let disk = parseFloat(req.query.disk);
          let cpu = parseFloat(req.query.cpu);
          
          if (!isNaN(ram) && !isNaN(disk) && !isNaN(cpu)) {
            if (ram2 + ram > package.ram + extra.ram) {
              cb();
              return res.redirect(`${redirectLink}?err=EXCEEDRAM&num=${package.ram + extra.ram - ram2}`);
            }

            if (disk2 + disk > package.disk + extra.disk) {
              cb();
              return res.redirect(`${redirectLink}?err=EXCEEDDISK&num=${package.disk + extra.disk - disk2}`);
            }

            if (cpu2 + cpu > package.cpu + extra.cpu) {
              cb();
              return res.redirect(`${redirectLink}?err=EXCEEDCPU&num=${package.cpu + extra.cpu - cpu2}`);
            }

            if (egginfo.minimum && egginfo.minimum.ram && ram < egginfo.minimum.ram) {
              cb();
              return res.redirect(`${redirectLink}?err=TOOLITTLERAM&num=${egginfo.minimum.ram}`);
            }

            if (egginfo.minimum && egginfo.minimum.disk && disk < egginfo.minimum.disk) {
              cb();
              return res.redirect(`${redirectLink}?err=TOOLITTLEDISK&num=${egginfo.minimum.disk}`);
            }

            if (egginfo.minimum && egginfo.minimum.cpu && cpu < egginfo.minimum.cpu) {
              cb();
              return res.redirect(`${redirectLink}?err=TOOLITTLECPU&num=${egginfo.minimum.cpu}`);
            }

            if (egginfo.maximum && egginfo.maximum.ram && ram > egginfo.maximum.ram) {
              cb();
              return res.redirect(`${redirectLink}?err=TOOMUCHRAM&num=${egginfo.maximum.ram}`);
            }

            if (egginfo.maximum && egginfo.maximum.disk && disk > egginfo.maximum.disk) {
              cb();
              return res.redirect(`${redirectLink}?err=TOOMUCHDISK&num=${egginfo.maximum.disk}`);
            }

            if (egginfo.maximum && egginfo.maximum.cpu && cpu > egginfo.maximum.cpu) {
              cb();
              return res.redirect(`${redirectLink}?err=TOOMUCHCPU&num=${egginfo.maximum.cpu}`);
            }

            let specs = egginfo.info;
            
            specs["user"] = (await db.get(`users-${req.session.userinfo.id}`));
            if (!specs["limits"]) specs["limits"] = {
              swap: 0,
              io: 500,
              backups: 0
            };
            specs.name = name;
            specs.limits.swap = -1;
            specs.limits.memory = ram;
            specs.limits.disk = disk;
            specs.limits.cpu = cpu;
            if (!specs["deploy"]) specs.deploy = {
              locations: [],
              dedicated_ip: false,
              port_range: []
            }
            specs.deploy.locations = [location];
            
            // Make sure user has enough coins
            const createdServer = await db.get(`createdserver-${req.session.userinfo.id}`) ?? false;
            const coins = await db.get(`coins-${req.session.userinfo.id}`) ?? 0;
            const cost = newsettings.servercreation.cost;
            if (createdServer && coins < cost) {
              cb();
              return res.redirect(`/servers/new?err=TOOLITTLECOINS`);
            }

            const serverResponse = await fetch(
              `${newsettings.pterodactyl.domain}/api/application/servers`,
              {
                method: "POST",
                headers: {
                  'Content-Type': 'application/json',
                  "Authorization": `Bearer ${newsettings.pterodactyl.key}`,
                  "Accept": "application/json"
                },
                body: JSON.stringify(specs)
              }
            );
      
            if (!serverResponse.ok) {
              console.log(await serverResponse.text());
              cb();
              return res.redirect(`${redirectLink}?err=ERRORONCREATE`);
            }
      
            const serverInfo = await serverResponse.json();
            req.session.pterodactyl.relationships.servers.data.push(serverInfo);
            
            // Bill user if they have created a server before
            if (createdServer) 
              await db.set(`coins-${req.session.userinfo.id}`, coins - cost);
            
            await db.set(`lastrenewal-${serverInfo.attributes.id}`, Date.now());
            await db.set(`createdserver-${req.session.userinfo.id}`, true);

            cb();
            log('created server', `${req.session.userinfo.username}#${req.session.userinfo.discriminator} created a new server named \`${name}\` with the following specs:\n\`\`\`Memory: ${ram} MB\nCPU: ${cpu}%\nDisk: ${disk}\nLocation ID: ${location}\nEgg: ${egg}\`\`\``)
            return res.redirect("/servers?err=CREATEDSERVER");
          } else {
            cb();
            res.redirect(`${redirectLink}?err=NOTANUMBER`);
          }
        } else {
          cb();
          res.redirect(`${redirectLink}?err=MISSINGVARIABLE`);
        }
      })
  });

  app.get("/modify", async (req, res) => {
    if (!req.session.pterodactyl) return res.redirect("/login");
  
    let theme = indexjs.get(req);
  
    const newsettings = require('../handlers/readSettings').settings(); 
    if (newsettings.allow.server.modify !== true) 
      res.redirect(theme.settings.redirect.modifyserverdisabled ? theme.settings.redirect.modifyserverdisabled : "/");
      

    if (!req.query.id) return res.send("Missing server id.");

    const cacheAccount = await getPteroUser(req.session.userinfo.id, db)
      .catch(() => {
        return res.send("An error has occurred while attempting to update your account information and server list.");
      });
    if (!cacheAccount) return;
    req.session.pterodactyl = cacheAccount.attributes;

    let redirectlink = theme.settings.redirect.failedmodifyserver ? theme.settings.redirect.failedmodifyserver : "/"; // fail redirect link

    let checkexist = req.session.pterodactyl.relationships.servers.data.filter(name => name.attributes.id == req.query.id);
    if (checkexist.length !== 1) return res.send("Invalid server id.");

    let ram = req.query.ram ? (isNaN(parseFloat(req.query.ram)) ? undefined : parseFloat(req.query.ram)) : undefined;
    let disk = req.query.disk ? (isNaN(parseFloat(req.query.disk)) ? undefined : parseFloat(req.query.disk)) : undefined;
    let cpu = req.query.cpu ? (isNaN(parseFloat(req.query.cpu)) ? undefined : parseFloat(req.query.cpu)) : undefined;

    if (ram || disk || cpu) {
      const newsettings = require('../handlers/readSettings').settings(); 

      let packagename = await db.get(`package-${req.session.userinfo.id}`);
      let package = newsettings.packages.list[packagename ? packagename : newsettings.packages.default];

      let pterorelationshipsserverdata = req.session.pterodactyl.relationships.servers.data.filter(name => name.attributes.id.toString() !== req.query.id);

      let ram2 = 0;
      let disk2 = 0;
      let cpu2 = 0;
      for (let i = 0, len = pterorelationshipsserverdata.length; i < len; i++) {
        ram2 = ram2 + pterorelationshipsserverdata[i].attributes.limits.memory;
        disk2 = disk2 + pterorelationshipsserverdata[i].attributes.limits.disk;
        cpu2 = cpu2 + pterorelationshipsserverdata[i].attributes.limits.cpu;
      }
      let attemptegg = null;
      // let attemptname = null;

      for (let [name, value] of Object.entries(newsettings.eggs)) {
        if (value.info.egg == checkexist[0].attributes.egg) {
          attemptegg = newsettings.eggs[name];
          // attemptname = name;
        };
      };
      let egginfo = attemptegg ? attemptegg : null;

      if (!egginfo) return res.redirect(`${redirectlink}?id=${req.query.id}&err=MISSINGEGG`);

      let extra =
        await db.get(`extra-${req.session.userinfo.id}`) ?
          await db.get(`extra-${req.session.userinfo.id}`) :
          {
            ram: 0,
            disk: 0,
            cpu: 0,
            servers: 0
          };

      if (ram2 + ram > package.ram + extra.ram) return res.redirect(`${redirectlink}?id=${req.query.id}&err=EXCEEDRAM&num=${package.ram + extra.ram - ram2}`);
      if (disk2 + disk > package.disk + extra.disk) return res.redirect(`${redirectlink}?id=${req.query.id}&err=EXCEEDDISK&num=${package.disk + extra.disk - disk2}`);
      if (cpu2 + cpu > package.cpu + extra.cpu) return res.redirect(`${redirectlink}?id=${req.query.id}&err=EXCEEDCPU&num=${package.cpu + extra.cpu - cpu2}`);
      if (egginfo.minimum.ram && ram < egginfo.minimum.ram) return res.redirect(`${redirectlink}?id=${req.query.id}&err=TOOLITTLERAM&num=${egginfo.minimum.ram}`);
      if (egginfo.minimum.disk && disk < egginfo.minimum.disk) return res.redirect(`${redirectlink}?id=${req.query.id}&err=TOOLITTLEDISK&num=${egginfo.minimum.disk}`);
      if (egginfo.minimum.cpu && cpu < egginfo.minimum.cpu) return res.redirect(`${redirectlink}?id=${req.query.id}&err=TOOLITTLECPU&num=${egginfo.minimum.cpu}`);
      if (egginfo.maximum) {
        if (egginfo.maximum.ram && ram > egginfo.maximum.ram) return res.redirect(`${redirectlink}?id=${req.query.id}&err=TOOMUCHRAM&num=${egginfo.maximum.ram}`);
        if (egginfo.maximum.disk && disk > egginfo.maximum.disk) return res.redirect(`${redirectlink}?id=${req.query.id}&err=TOOMUCHDISK&num=${egginfo.maximum.disk}`);
        if (egginfo.maximum.cpu && cpu > egginfo.maximum.cpu) return res.redirect(`${redirectlink}?id=${req.query.id}&err=TOOMUCHCPU&num=${egginfo.maximum.cpu}`);
      };

      let limits = {
        memory: ram ? ram : checkexist[0].attributes.limits.memory,
        disk: disk ? disk : checkexist[0].attributes.limits.disk,
        cpu: cpu ? cpu : checkexist[0].attributes.limits.cpu,
        swap: egginfo ? checkexist[0].attributes.limits.swap : 0,
        io: egginfo ? checkexist[0].attributes.limits.io : 500
      };

      let serverinfo = await fetch(
        `${settings.pterodactyl.domain}/api/application/servers/${req.query.id}/build`,
        {
          method: "PATCH",
          headers: { 
            'Content-Type': 'application/json',
            "Authorization": `Bearer ${settings.pterodactyl.key}`,
            "Accept": "application/json" 
          },
          body: JSON.stringify({
            limits: limits,
            feature_limits: checkexist[0].attributes.feature_limits,
            allocation: checkexist[0].attributes.allocation
          })
        }
      );
      if (await serverinfo.statusText !== "OK") 
        return res.redirect(`${redirectlink}?id=${req.query.id}&err=ERRORONMODIFY`);
      
      let text = JSON.parse(await serverinfo.text());
      log(`modify server`, `${req.session.userinfo.username}#${req.session.userinfo.discriminator} modified the server called \`${text.attributes.name}\` to have the following specs:\n\`\`\`Memory: ${ram} MB\nCPU: ${cpu}%\nDisk: ${disk}\`\`\``)
      pterorelationshipsserverdata.push(text);
      req.session.pterodactyl.relationships.servers.data = pterorelationshipsserverdata;
      adminjs.suspend(req.session.userinfo.id);

      res.redirect("/servers?err=MODIFYSERVER");
    } else {
      res.redirect(`${redirectlink}?id=${req.query.id}&err=MISSINGVARIABLE`);
    }
  });  

  app.get("/delete", async (req, res) => {
    if (!req.session.pterodactyl) return res.redirect("/login");
    if (!req.query.id) return res.send("Missing id.");
  
    let theme = indexjs.get(req);
    const newsettings = require('../handlers/readSettings').settings();
  
    if (newsettings.allow.server.delete !== true)
      return res.redirect(theme.settings.redirect.deleteserverdisabled || "/");
  
    let server = req.session.pterodactyl.relationships.servers.data.find(server => server.attributes.id == req.query.id);
    if (!server) return res.send("Could not find server with that ID.");
  
    let serverName = server.attributes.name; // Get the server name before deletion
  
    let deletionresults = await fetch(
      `${settings.pterodactyl.domain}/api/application/servers/${req.query.id}`,
      {
        method: "delete",
        headers: {
          'Content-Type': 'application/json',
          "Authorization": `Bearer ${settings.pterodactyl.key}`
        }
      }
    );
  
    if (!deletionresults.ok) return res.send("An error has occurred while attempting to delete the server.");
  
    req.session.pterodactyl.relationships.servers.data = req.session.pterodactyl.relationships.servers.data.filter(server => server.attributes.id != req.query.id);
    await db.delete(`lastrenewal-${req.query.id}`);
  
    adminjs.suspend(req.session.userinfo.id);
  
    log('deleted server', `${req.session.userinfo.username}#${req.session.userinfo.discriminator} deleted server ${serverName}.`);
  
    return res.redirect('/servers?err=DELETEDSERVER');
  });
  
  app.get(`/api/createdServer`, async (req, res) => {
    if (!req.session.pterodactyl) 
      return res.json({ error: true, message: `You must be logged in.` });

    const createdServer = await db.get(`createdserver-${req.session.userinfo.id}`)
    return res.json({ created: createdServer ?? false, cost: settings.renewals.cost })
  })
};
