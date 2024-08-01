const settings = require('../handlers/readSettings').settings(); 
const adminjs = require("./admin.js");
const getPteroUser = require('../handlers/getPteroUser');
const logToDiscord = require("../handlers/log");
const fetch = require("node-fetch");

module.exports.load = async (app, db) => {
  app.get("/create", async (req, res) => {
      try {
          if (!req.session || !req.session.pterodactyl || !req.session.userinfo) return res.redirect("/login");
          if (!req.query.name || !req.query.cpu || !req.query.ram || !req.query.disk || !req.query.egg || !req.query.location) return res.redirect("/servers?err=MISSINGVARIABLE");
      
          if (!settings.allow.server.create) return res.redirect("/servers/new?err=disabled");
      
          const cacheAccount = await getPteroUser(req.session.userinfo.id, db);
          if (!cacheAccount) return;
      
          req.session.pterodactyl = cacheAccount.attributes;
            
          const name = decodeURIComponent(req.query.name);
      
          if (name.length < 1) return res.redirect("/servers?err=LITTLESERVERNAME");
      
          if (name.length > 191) return res.redirect("/servers?err=BIGSERVERNAME");
      
          const packagename = await db.get(`package-${req.session.userinfo.id}`);
          const package = settings.packages.list[packagename || settings.packages.default];
          const extra = await db.get(`extra-${req.session.userinfo.id}`) || {
            ram: 0,
            disk: 0,
            cpu: 0,
            servers: 0
          };
      
          let ram2 = 0, disk2 = 0, cpu2 = 0;
          const serversData = req.session.pterodactyl.relationships.servers.data;
      
          serversData.forEach(server => {
              ram2 += server.attributes.limits.memory;
              disk2 += server.attributes.limits.disk;
              cpu2 += server.attributes.limits.cpu;
          });
        
          if (serversData.length >= package.servers + extra.servers) return res.redirect("/servers?err=TOOMUCHSERVERS");
          
          const location = req.query.location;
          if (!Object.prototype.hasOwnProperty.call(settings.locations, location)) return res.redirect("/servers?err=INVALIDLOCATION");
          
          const requiredpackage = settings.locations[location].package;
          if (requiredpackage && !requiredpackage.includes(packagename || settings.packages.default)) return res.redirect("/servers?err=PREMIUMLOCATION");
          
          const egg = req.query.egg;
          const egginfo = settings.eggs[egg];
          if (!egginfo) return res.redirect("/servers?err=INVALIDEGG");    

          const cpu = parseFloat(req.query.cpu);
          const ram = parseFloat(req.query.ram);
          const disk = parseFloat(req.query.disk);
        
          if (isNaN(cpu) || isNaN(ram) || isNaN(disk)) return res.redirect("/servers?err=NOTANUMBER");

          // Exceed resources
          if (ram2 + ram > package.ram + extra.ram)
              return res.redirect(`/servers?err=EXCEEDRAM&num=${package.ram + extra.ram - ram2}`);
          
          if (disk2 + disk > package.disk + extra.disk)
              return res.redirect(`/servers?err=EXCEEDDISK&num=${package.disk + extra.disk - disk2}`);
          
          if (cpu2 + cpu > package.cpu + extra.cpu)
              return res.redirect(`/servers?err=EXCEEDCPU&num=${package.cpu + extra.cpu - cpu2}`);
          
          // Little resources
          if (egginfo.minimum && egginfo.minimum.ram && ram < egginfo.minimum.ram)
              return res.redirect(`/servers?err=TOOLITTLERAM&num=${egginfo.minimum.ram}`);
        
          if (egginfo.minimum && egginfo.minimum.disk && disk < egginfo.minimum.disk)
              return res.redirect(`/servers?err=TOOLITTLEDISK&num=${egginfo.minimum.disk}`);
        
          if (egginfo.minimum && egginfo.minimum.cpu && cpu < egginfo.minimum.cpu)
              return res.redirect(`/servers?err=TOOLITTLECPU&num=${egginfo.minimum.cpu}`);
          
          // Too Much resources
          if (egginfo.maximum && egginfo.maximum.ram && ram > egginfo.maximum.ram)
              return res.redirect(`/servers?err=TOOMUCHRAM&num=${egginfo.maximum.ram}`);

          if (egginfo.maximum && egginfo.maximum.disk && disk > egginfo.maximum.disk)
              return res.redirect(`/servers?err=TOOMUCHDISK&num=${egginfo.maximum.disk}`);
          
          if (egginfo.maximum && egginfo.maximum.cpu && cpu > egginfo.maximum.cpu)
              return res.redirect(`/servers?err=TOOMUCHCPU&num=${egginfo.maximum.cpu}`);
        
          let specs = egginfo.info;
          specs.user = await db.get(`users-${req.session.userinfo.id}`) || {};
          specs.limits = specs.limits || {
            swap: 0,
            io: 500,
            backups: 0 
          };
          specs.name = name;
          specs.limits.swap = -1;
          specs.limits.memory = ram;
          specs.limits.disk = disk;
          specs.limits.cpu = cpu;
          specs.deploy = specs.deploy || {
            locations: [],
            dedicated_ip: false,
            port_range: [] 
          };
          specs.deploy.locations = [location];
        
          // Make sure user has enough coins
          const createdServer = await db.get(`createdserver-${req.session.userinfo.id}`) || false;
          const coins = await db.get(`coins-${req.session.userinfo.id}`) || 0;
          const cost = settings.servercreation.cost;
        
          if (createdServer && coins < cost) return res.redirect("/servers/new?err=TOOLITTLECOINS");
        
          const serverResponse = await fetch(`${settings.pterodactyl.domain}/api/application/servers`, {
              method: "POST",
              headers: {
                  'Content-Type': 'application/json',
                  "Authorization": `Bearer ${settings.pterodactyl.key}`,
                  "Accept": "application/json"
              },
              body: JSON.stringify(specs)
          });
        
          if (!serverResponse.ok) {
              console.error(await serverResponse.text());
              return res.redirect("/servers?err=ERRORONCREATE");
          }
        
          const serverInfo = await serverResponse.json();
          req.session.pterodactyl.relationships.servers.data.push(serverInfo);
        
          // Bill user if they have created a server before
          if (createdServer) await db.set(`coins-${req.session.userinfo.id}`, coins - cost);
          
          await db.set(`lastrenewal-${serverInfo.attributes.id}`, Date.now()); // c
          await db.set(`createdserver-${req.session.userinfo.id}`, true);
        
          logToDiscord(
            "created server",
            `${req.session.userinfo.username} created a new server named \`${name}\` with the following specs:\n\`\`\`Memory: ${ram} MB\nCPU: ${cpu}%\nDisk: ${disk}\nLocation ID: ${location}\nEgg: ${egg}\`\`\``
          );
          return res.redirect("/servers?err=CREATEDSERVER");
      } catch (error) {
          console.error("An error occurred:", error);
          return res.redirect('/dashboard?err=INTERNALERROR')
      }
    });

    app.get("/modify", async (req, res) => {
      try {
        if (!req.session || !req.session.pterodactyl || !req.session.userinfo) return res.redirect("/login");
         
        if (!settings.allow.server.modify) return res.redirect("/servers/modify?err=disabled");

        if (!req.query.id) return res.send("Missing server id.");
        
        const cacheAccount = await getPteroUser(req.session.userinfo.id, db);
        if (!cacheAccount) return;

        req.session.pterodactyl = cacheAccount.attributes;
        
        const serverId = req.query.id;
        const serverData = req.session.pterodactyl.relationships.servers.data;
        
        const serverToModify = serverData.find(server => server.attributes.id == serverId);
        if (!serverToModify) return res.send("Invalid server id.");
        
        let cpu = parseFloat(req.query.cpu);
        let ram = parseFloat(req.query.ram);
        let disk = parseFloat(req.query.disk);
        
        if (isNaN(cpu) || isNaN(ram) || isNaN(disk)) return res.redirect(`/servers/edit?id=${serverId}&err=MISSINGVARIABLE`);
        
        let packagename = await db.get(`package-${req.session.userinfo.id}`);
        let package = settings.packages.list[packagename || settings.packages.default];
        
        let serverDataExceptCurrent = serverData.filter(server => server.attributes.id.toString() !== serverId);
        
        let cpu2 = 0, ram2 = 0, disk2 = 0;
        serverDataExceptCurrent.forEach(server => {
          cpu2 += server.attributes.limits.cpu;
          ram2 += server.attributes.limits.memory;
          disk2 += server.attributes.limits.disk;
        });
        
        let egginfo = Object.values(settings.eggs).find(egg => egg.info.egg === serverToModify.attributes.egg);
        if (!egginfo) return res.redirect(`/servers/edit?id=${serverId}&err=MISSINGEGG`);
        
        let extra = await db.get(`extra-${req.session.userinfo.id}`) || {
          ram: 0,
          disk: 0,
          cpu: 0,
          servers: 0
        };
        
        // Exceed resources
        if (ram2 + ram > package.ram + extra.ram) 
          return res.redirect(`/servers/edit?id=${serverId}&err=EXCEEDRAM&num=${package.ram + extra.ram - ram2}`);
        
        if (disk2 + disk > package.disk + extra.disk) 
          return res.redirect(`/servers/edit?id=${serverId}&err=EXCEEDDISK&num=${package.disk + extra.disk - disk2}`);
        
        if (cpu2 + cpu > package.cpu + extra.cpu) 
          return res.redirect(`/servers/edit?id=${serverId}&err=EXCEEDCPU&num=${package.cpu + extra.cpu - cpu2}`);
        
        // Little resources
        if (egginfo.minimum.ram && ram < egginfo.minimum.ram) 
          return res.redirect(`/servers/edit?id=${serverId}&err=TOOLITTLERAM&num=${egginfo.minimum.ram}`);
        
        if (egginfo.minimum.disk && disk < egginfo.minimum.disk) 
          return res.redirect(`/servers/edit?id=${serverId}&err=TOOLITTLEDISK&num=${egginfo.minimum.disk}`);
        
        if (egginfo.minimum.cpu && cpu < egginfo.minimum.cpu) 
          return res.redirect(`/servers/edit?id=${serverId}&err=TOOLITTLECPU&num=${egginfo.minimum.cpu}`);
        
        // Too Much resources
        if (egginfo.maximum) {
          if (egginfo.maximum.ram && ram > egginfo.maximum.ram) 
            return res.redirect(`/servers/edit?id=${serverId}&err=TOOMUCHRAM&num=${egginfo.maximum.ram}`);
          
          if (egginfo.maximum.disk && disk > egginfo.maximum.disk) 
            return res.redirect(`/servers/edit?id=${serverId}&err=TOOMUCHDISK&num=${egginfo.maximum.disk}`);

          if (egginfo.maximum.cpu && cpu > egginfo.maximum.cpu) 
            return res.redirect(`/servers/edit?id=${serverId}&err=TOOMUCHCPU&num=${egginfo.maximum.cpu}`);
        }
        
        let limits = {
          memory: ram,
          disk: disk,
          cpu: cpu,
          swap: egginfo ? serverToModify.attributes.limits.swap : 0,
          io: egginfo ? serverToModify.attributes.limits.io : 500
        };
        
        let serverinfo = await fetch(`${settings.pterodactyl.domain}/api/application/servers/${serverId}/build`, {
          method: "PATCH",
          headers: {
            'Content-Type': 'application/json',
            "Authorization": `Bearer ${settings.pterodactyl.key}`,
            "Accept": "application/json"
          },
          body: JSON.stringify({
            limits: limits,
            feature_limits: serverToModify.attributes.feature_limits,
            allocation: serverToModify.attributes.allocation
          })
        });
        
        if (!serverinfo.ok) return res.redirect(`/servers/edit?id=${serverId}&err=ERRORONMODIFY`);
        
        let serverInfoText = await serverinfo.json();
        
        logToDiscord(
          "modify server",
          `${req.session.userinfo.username} modified the server called \`${serverInfoText.attributes.name}\` to have the following specs:\n\`\`\`Memory: ${ram} MB\nCPU: ${cpu}%\nDisk: ${disk}\`\`\``
        );
        
        // G
        serverDataExceptCurrent.push(serverInfoText);
        req.session.pterodactyl.relationships.servers.data = serverDataExceptCurrent;
        adminjs.suspend(req.session.userinfo.id);
        
        res.redirect("/servers?err=MODIFYSERVER");
      } catch (error) {
        console.error("Error modifing server:", error);
        return res.redirect('/dashboard?err=INTERNALERROR')
      }
    });

  app.get("/delete", async (req, res) => {
    if (!req.session || !req.session.pterodactyl || !req.session.userinfo) return res.redirect("/login");
    if (!req.query.id) return res.send("Missing id.");
  
    if (!settings.allow.server.delete) return res.redirect("/servers");
  
    let server = req.session.pterodactyl.relationships.servers.data.find(server => server.attributes.id == req.query.id);
    if (!server) return res.send("Could not find server with that ID.");
  
    let serverName = server.attributes.name; // Get the server name before deletion
  
    try {
      let deletionResults = await fetch(`${settings.pterodactyl.domain}/api/application/servers/${req.query.id}`, {
        method: "delete",
        headers: {
          'Content-Type': 'application/json',
          "Authorization": `Bearer ${settings.pterodactyl.key}`
        }
      });
    
      if (!deletionResults.ok) return res.send("An error has occurred while attempting to delete the server.");
    
      req.session.pterodactyl.relationships.servers.data = req.session.pterodactyl.relationships.servers.data.filter(server => server.attributes.id != req.query.id);
      await db.delete(`lastrenewal-${req.query.id}`);
    
      adminjs.suspend(req.session.userinfo.id);
    
      logToDiscord(
        "deleted server",
        `${req.session.userinfo.username} deleted server ${serverName}.`
      );
    
      return res.redirect('/servers?err=DELETEDSERVER');
    } catch (error) {
      console.error("Error deleting server:", error);
      return res.redirect('/dashboard?err=INTERNALERROR')
    }
  });

  // A
  
  app.get(`/api/createdServer`, async (req, res) => {
    if (!req.session.pterodactyl) return res.json({ error: true, message: `You must be logged in.` });

    const createdServer = await db.get(`createdserver-${req.session.userinfo.id}`)
    return res.json({ created: createdServer ?? false, cost: settings.renewals.cost })
  })
};