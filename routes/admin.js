const ejs = require("ejs");
const fetch = require("node-fetch");
const indexjs = require("../index.js");
const adminjs = require("./admin.js");
const log = require("../handlers/log.js");

const settings = require('../handlers/readSettings').settings();

module.exports.load = async function (app, db) {

  /**
   * GET /setcoins
   * Endpoint to set the number of coins for a user.
   */

    app.get("/setcoins", async (req, res) => {
        let theme = indexjs.get(req);

        if (!req.session.pterodactyl || !req.session) return four0four(req, res, theme);

        let cacheAccount = await fetch(
            `${settings.pterodactyl.domain}/api/application/users/${(await db.get(`users-${req.session.userinfo.id}`))}?include=servers`,
            {
                method: "GET",
                headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
            }
        );

        if (await cacheAccount.statusText == "Not Found") return four0four(req, res, theme);
        
        let cacheAccountInfo = JSON.parse(await cacheAccount.text());

        req.session.pterodactyl = cacheAccountInfo.attributes;
        if (!cacheAccountInfo.attributes.root_admin) return four0four(req, res, theme);

        let id = req.query.id;
        let coins = req.query.coins;

        if (!id) return res.redirect("/admin?err=MISSINGID");
        if (!(await db.get(`users-${id}`))) return res.redirect("/admin?err=INVALIDID");

        if (!coins) return res.redirect("/admin?err=MISSINGCOINS");

        coins = parseFloat(coins);

        if (isNaN(coins)) return res.redirect("/admin?err=INVALIDCOINNUMBER");

        if (coins < 0 || coins > 999999999999999) return res.redirect("/admin?err=COINSIZE");

        if (coins == 0) {
            await db.delete(`coins-${id}`)
        } else {
            await db.set(`coins-${id}`, coins);
        }

        log(`set coins`, `${req.session.userinfo.username}#${req.session.userinfo.discriminator} set the coins of the user with the ID \`${id}\` to \`${coins}\`.`)
        res.redirect("/admin?err=success");
    });

  /**
   * GET /addcoins
   * Endpoint to add coins to a user's account.
   */

    app.get("/addcoins", async (req, res) => {
        let theme = indexjs.get(req);

        if (!req.session.pterodactyl || !req.session) return four0four(req, res, theme);

        let cacheAccount = await fetch(
            `${settings.pterodactyl.domain}/api/application/users/${(await db.get(`users-${req.session.userinfo.id}`))}?include=servers`,
            {
                method: "GET",
                headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
            }
        );

        if (await cacheAccount.statusText == "Not Found") return four0four(req, res, theme);
        let cacheAccountInfo = JSON.parse(await cacheAccount.text());

        req.session.pterodactyl = cacheAccountInfo.attributes;
        if (!cacheAccountInfo.attributes.root_admin ) return four0four(req, res, theme);

        let id = req.query.id;
        let coins = req.query.coins;

        if (!id) return res.redirect("/admin?err=MISSINGID");
        if (!(await db.get(`users-${req.query.id}`))) return res.redirect("/admin?err=INVALIDID");

        if (!coins) return res.redirect("/admin?err=MISSINGCOINS");

        let currentcoins = await db.get(`coins-${id}`) || 0;

        coins = currentcoins + parseFloat(coins);

        if (isNaN(coins)) return res.redirect("/admin?err=INVALIDCOINNUMBER");

        if (coins < 0 || coins > 999999999999999) return res.redirect("/admin?err=COINSIZE");

        if (coins == 0) {
            await db.delete(`coins-${id}`)
        } else {
            await db.set(`coins-${id}`, coins);
        }

        log(`add coins`, `${req.session.userinfo.username}#${req.session.userinfo.discriminator} added \`${req.query.coins}\` coins to the user with the ID \`${id}\`'s account.`)
        res.redirect("/admin?err=success");
    });

  /**
   * GET /setresources
   * Endpoint to set additional resources for a user's account.
   */

    app.get("/setresources", async (req, res) => {
        let theme = indexjs.get(req);

        if (!req.session.pterodactyl || !req.session) return four0four(req, res, theme);

        let cacheAccount = await fetch(
            `${settings.pterodactyl.domain}/api/application/users/${(await db.get(`users-${req.session.userinfo.id}`))}?include=servers`,
            {
                method: "GET",
                headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
            }
        );

        if (await cacheAccount.statusText == "Not Found") return four0four(req, res, theme);
        let cacheAccountInfo = JSON.parse(await cacheAccount.text());

        req.session.pterodactyl = cacheAccountInfo.attributes;
        if (!cacheAccountInfo.attributes.root_admin) return four0four(req, res, theme);

        if (!req.query.id) return res.redirect("/admin?err=MISSINGID");

        if (!(await db.get(`users-${req.query.id}`))) return res.redirect("/admin?err=INVALIDID");

        if (!req.query.ram || !req.query.disk || !req.query.cpu || !req.query.servers) return res.redirect("/admin?err=MISSINGVARIABLES");

        let ramstring = req.query.ram;
        let diskstring = req.query.disk;
        let cpustring = req.query.cpu;
        let serversstring = req.query.servers;
        let id = req.query.id;
        let currentextra = await db.get(`extra-${req.query.id}`);
        let extra;
        if (typeof currentextra == "object") {
            extra = currentextra;
        } else {
            extra = {
                ram: 0,
                disk: 0,
                cpu: 0,
                servers: 0
            }
        }
        if (ramstring) {
            let ram = parseFloat(ramstring);
            if (ram < 0 || ram > 999999999999999) {
                return res.redirect("/admin?err=RAMSIZE");
            }
            extra.ram = ram;
        }
        if (diskstring) {
            let disk = parseFloat(diskstring);
            if (disk < 0 || disk > 999999999999999) {
                return res.redirect("/admin?err=DISKSIZE");
            }
            extra.disk = disk;
        }
        if (cpustring) {
            let cpu = parseFloat(cpustring);
            if (cpu < 0 || cpu > 999999999999999) {
                return res.redirect("/admin?err=CPUSIZE");
            }
            extra.cpu = cpu;
        }
        if (serversstring) {
            let servers = parseFloat(serversstring);
            if (servers < 0 || servers > 999999999999999) {
                return res.redirect("/admin?err=SERVERSIZ");
            }
            extra.servers = servers;
        }
        if (extra.ram == 0 && extra.disk == 0 && extra.cpu == 0 && extra.servers == 0) {
            await db.delete(`extra-${req.query.id}`);
        } else {
            await db.set(`extra-${req.query.id}`, extra);
        }
        adminjs.suspend(req.query.id);
        log(`set resources`, `${req.session.userinfo.username}#${req.session.userinfo.discriminator} set the resources of the user with the ID \`${id}\` to:\`\`\`servers: ${serversstring}\nCPU: ${cpustring}%\nMemory: ${ramstring} MB\nDisk: ${diskstring} MB\`\`\``)
        res.redirect("/admin?err=success");
    });

  /**
   * GET /stats
   * Endpoint to 
   * Test
   */
  
  app.get("/stats", async (req, res) => {
    let theme = indexjs.get(req);

    if (!req.session.pterodactyl || !req.session) return four0four(req, res, theme);

    let cacheAccount = await fetch(
        `${settings.pterodactyl.domain}/api/application/users/${(await db.get(`users-${req.session.userinfo.id}`))}?include=servers`,
        {
            method: "GET",
            headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
        }
    );

    if (await cacheAccount.statusText == "Not Found") return four0four(req, res, theme);
    let cacheAccountInfo = JSON.parse(await cacheAccount.text());

    req.session.pterodactyl = cacheAccountInfo.attributes;
    if (!cacheAccountInfo.attributes.root_admin) return four0four(req, res, theme);

      const users = await db.get("users") || [];
  
      const stats = {
        total_users: users.length,
      };
  
      res.json(stats);
  });
  
  /**
   * GET /addresources
   * Endpoint to add additional resources to a user's account.
   */

    app.get("/addresources", async (req, res) => {
        let theme = indexjs.get(req);

        if (!req.session.pterodactyl || !req.session) return four0four(req, res, theme);

        let cacheAccount = await fetch(
            `${settings.pterodactyl.domain}/api/application/users/${(await db.get(`users-${req.session.userinfo.id}`))}?include=servers`,
            {
                method: "GET",
                headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
            }
        );

        if (await cacheAccount.statusText == "Not Found") return four0four(req, res, theme);
        let cacheAccountInfo = JSON.parse(await cacheAccount.text());

        req.session.pterodactyl = cacheAccountInfo.attributes;
        if (!cacheAccountInfo.attributes.root_admin) return four0four(req, res, theme);

        if (!req.query.id) return res.redirect("/admin?err=MISSINGID");

        if (!(await db.get(`users-${req.query.id}`))) return res.redirect("/admin?err=INVALIDID");

        if (!req.query.cpu || !req.query.ram || !req.query.disk || !req.query.servers) return res.redirect("/admin?err=MISSINGVARIABLES");
        
            let ramstring = req.query.ram;
            let diskstring = req.query.disk;
            let cpustring = req.query.cpu;
            let serversstring = req.query.servers;
            let id = req.query.id;

            let currentextra = await db.get(`extra-${req.query.id}`);
            let extra;

            if (typeof currentextra == "object") {
                extra = currentextra;
            } else {
                extra = {
                    ram: 0,
                    disk: 0,
                    cpu: 0,
                    servers: 0
                }
            }

            if (ramstring) {
                let ram = parseFloat(ramstring);
                if (ram < 0 || ram > 999999999999999) {
                    return res.redirect("/admin?err=RAMSIZE");
                }
                extra.ram = extra.ram + ram;
            }

            if (diskstring) {
                let disk = parseFloat(diskstring);
                if (disk < 0 || disk > 999999999999999) {
                    return res.redirect("/admin?err=DISKSIZE");
                }
                extra.disk = extra.disk + disk;
            }

            if (cpustring) {
                let cpu = parseFloat(cpustring);
                if (cpu < 0 || cpu > 999999999999999) {
                    return res.redirect("/admin?err=CPUSIZE");
                }
                extra.cpu = extra.cpu + cpu;
            }

            if (serversstring) {
                let servers = parseFloat(serversstring);
                if (servers < 0 || servers > 999999999999999) {
                    return res.redirect("/admin?err=SERVERSIZE");
                }
                extra.servers = extra.servers + servers;
            }

            if (extra.ram == 0 && extra.disk == 0 && extra.cpu == 0 && extra.servers == 0) {
                await db.delete(`extra-${req.query.id}`);
            } else {
                await db.set(`extra-${req.query.id}`, extra);
            }

            adminjs.suspend(req.query.id);

            log(`add resources`, `${req.session.userinfo.username}#${req.session.userinfo.discriminator} add the resources of the user with the ID \`${id}\` to:\`\`\`servers: ${serversstring}\nCPU: ${cpustring}%\nMemory: ${ramstring} MB\nDisk: ${diskstring} MB\`\`\``)
            return res.redirect("/admin?err=success");
    });

  /**
   * GET /setplan
   * Endpoint to set the plan for a user.
   */

    app.get("/setplan", async (req, res) => {
        let theme = indexjs.get(req);

        if (!req.session.pterodactyl || !req.session) return four0four(req, res, theme);

        let cacheAccount = await fetch(
            `${settings.pterodactyl.domain}/api/application/users/${(await db.get(`users-${req.session.userinfo.id}`))}?include=servers`,
            {
                method: "GET",
                headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
            }
        );

        if (await cacheAccount.statusText == "Not Found") return four0four(req, res, theme);
        let cacheAccountInfo = JSON.parse(await cacheAccount.text());

        req.session.pterodactyl = cacheAccountInfo.attributes;
        if (!cacheAccountInfo.attributes.root_admin) return four0four(req, res, theme);

        if (!req.query.id) return res.redirect("/admin?err=MISSINGID");

        if (!(await db.get(`users-${req.query.id}`))) return res.redirect("/admin?err=INVALIDID");

        if (req.query.package) {
            if (!settings.packages.list[req.query.package]) return res.redirect("/admin?err=INVALIDPACKAGE");

            await db.set(`package-${req.query.id}`, req.query.package);
            adminjs.suspend(req.query.id);

            log(`set plan`, `${req.session.userinfo.username}#${req.session.userinfo.discriminator} set the plan of the user with the ID \`${req.query.id}\` to \`${req.query.package}\`.`)
            return res.redirect("/admin?err=success");
        }
    });

  /**
   * GET /create_coupon
   * Endpoint to create a coupon code.
   */

    app.get("/create_coupon", async (req, res) => {
        let theme = indexjs.get(req);

        if (!req.session.pterodactyl || !req.session) return four0four(req, res, theme);

        let cacheAccount = await fetch(
            `${settings.pterodactyl.domain}/api/application/users/${(await db.get(`users-${req.session.userinfo.id}`))}?include=servers`,
            {
                method: "GET",
                headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
            }
        );

        if (await cacheAccount.statusText == "Not Found") return four0four(req, res, theme);
        let cacheAccountInfo = JSON.parse(await cacheAccount.text());

        req.session.pterodactyl = cacheAccountInfo.attributes;
        if (!cacheAccountInfo.attributes.root_admin) return four0four(req, res, theme);

        let code = req.query.code ? req.query.code.slice(0, 200) : Math.random().toString(36).substring(2, 15);

        if (!code.match(/^[a-z0-9]+$/i)) return res.redirect("/admin?err=CREATECOUPONINVALIDCHARACTERS");

        let coins = req.query.coins || 0;
        let ram = req.query.ram * 1024 || 0;
        let disk = req.query.disk * 1024 || 0;
        let cpu = req.query.cpu * 100 || 0;
        let servers = req.query.servers || 0;

        coins = parseFloat(coins);
        ram = parseFloat(ram);
        disk = parseFloat(disk);
        cpu = parseFloat(cpu);
        servers = parseFloat(servers);

        if (coins < 0 || ram < 0 || disk < 0 || cpu < 0 || servers < 0) return res.redirect("/admin?err=CREATECOUPONLESSTHANONE");
        
        if (!coins && !ram && !disk && !cpu && !servers) return res.redirect("/admin?err=CREATECOUPONEMPTY");

        await db.set(`coupon-${code}`, {
            coins: coins,
            ram: ram,
            disk: disk,
            cpu: cpu,
            servers: servers
        });

        log(`create coupon`, `${req.session.userinfo.username}#${req.session.userinfo.discriminator} created the coupon code \`${code}\` which gives:\`\`\`coins: ${coins}\nMemory: ${ram} MB\nDisk: ${disk} MB\nCPU: ${cpu}%\nServers: ${servers}\`\`\``)
        res.redirect(`/admin?code=${code}`)
    });

  /**
   * GET /revoke_coupon
   * Endpoint to revoke a coupon code.
   */

    app.get("/revoke_coupon", async (req, res) => {
        let theme = indexjs.get(req);

        if (!req.session.pterodactyl || !req.session) return four0four(req, res, theme);

        let cacheAccount = await fetch(
            `${settings.pterodactyl.domain}/api/application/users/${(await db.get(`users-${req.session.userinfo.id}`))}?include=servers`,
            {
                method: "GET",
                headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
            }
        );

        if (await cacheAccount.statusText == "Not Found") return four0four(req, res, theme);
        let cacheAccountInfo = JSON.parse(await cacheAccount.text());

        req.session.pterodactyl = cacheAccountInfo.attributes;
        if (!cacheAccountInfo.attributes.root_admin) return four0four(req, res, theme);

        let code = req.query.code;

        if (!code.match(/^[a-z0-9]+$/i)) return res.redirect("/admin?err=REVOKECOUPONCANNOTFINDCODE");

        if (!(await db.get(`coupon-${code}`))) return res.redirect("/admin?err=REVOKECOUPONCANNOTFINDCODE");

        await db.delete(`coupon-${code}`);

        log(`revoke coupon`, `${req.session.userinfo.username}#${req.session.userinfo.discriminator} revoked the coupon code \`${code}\`.`)
        res.redirect("/admin?revokedcode=true");
    });

  /**
   * GET /remove_account
   * Endpoint to remove an account.
   */

    app.get("/remove_account", async (req, res) => {
        let theme = indexjs.get(req);

        if (!req.session.pterodactyl || !req.session) return four0four(req, res, theme);

        let cacheAccount = await fetch(
            `${settings.pterodactyl.domain}/api/application/users/${(await db.get(`users-${req.session.userinfo.id}`))}?include=servers`,
            {
                method: "GET",
                headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
            }
        );

        if (await cacheAccount.statusText == "Not Found") return four0four(req, res, theme);
        let cacheAccountInfo = JSON.parse(await cacheAccount.text());

        req.session.pterodactyl = cacheAccountInfo.attributes;
        if (!cacheAccountInfo.attributes.root_admin) return four0four(req, res, theme);

        // This doesn't delete the account and doesn't touch the renewal system.

        if (!req.query.id) return res.redirect("/dashboard?err=REMOVEACCOUNTMISSINGID");

        let discordid = req.query.id;
        let pteroid = await db.get(`users-${discordid}`);

        // Remove IP.

        let selected_ip = await db.get(`ip-${discordid}`);

        if (selected_ip) {
            let allips = await db.get("ips") || [];
            allips = allips.filter(ip => ip !== selected_ip);

            if (allips.length == 0) {
                await db.delete("ips");
            } else {
                await db.set("ips", allips);
            }

            await db.delete(`ip-${discordid}`);
        }

        // Remove user from dashboard.

        let userids = await db.get("users") || [];
        userids = userids.filter(user => user !== pteroid);

        if (userids.length == 0) {
            await db.delete("users");
        } else {
            await db.set("users", userids);
        }

        await db.delete(`users-${discordid}`);

        // Remove coins/resources.

        await db.delete(`coins-${discordid}`);
        await db.delete(`extra-${discordid}`);
        await db.delete(`package-${discordid}`);

        // Remove server and user account

        let servers = cacheAccountInfo.attributes.relationships.servers.data;
        for (let server of servers) {
            await fetch(`${settings.pterodactyl.domain}/api/application/servers/${server.id}`, {
                method: "DELETE",
                headers: {
                    'Content-Type': 'application/json',
                    "Authorization": `Bearer ${settings.pterodactyl.key}`
                }
            });
        }

        await fetch(`${settings.pterodactyl.domain}/api/application/users/${pteroid}`, {
            method: "DELETE",
            headers: {
                'Content-Type': 'application/json',
                "Authorization": `Bearer ${settings.pterodactyl.key}`
            }
        });

        log(`remove account`, `${req.session.userinfo.username}#${req.session.userinfo.discriminator} removed the account with the ID \`${discordid}\`.`)
        res.redirect("/login?success=REMOVEACCOUNT");
    });

  /**
   * GET /getip
   * Endpoint to retrieve the IP address associated with a user's account.
   */

    app.get("/getip", async (req, res) => {
        let theme = indexjs.get(req);

        if (!req.session.pterodactyl || !req.session) return four0four(req, res, theme);

        let cacheAccount = await fetch(
            `${settings.pterodactyl.domain}/api/application/users/${(await db.get(`users-${req.session.userinfo.id}`))}?include=servers`,
            {
                method: "GET",
                headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
            }
        );

        if (await cacheAccount.statusText == "Not Found") return four0four(req, res, theme);
        let cacheAccountInfo = JSON.parse(await cacheAccount.text());

        req.session.pterodactyl = cacheAccountInfo.attributes;
        if (!cacheAccountInfo.attributes.root_admin) return four0four(req, res, theme);

        if (!req.query.id) return res.redirect("/admin?err=MISSINGID");

        if (!(await db.get(`users-${req.query.id}`))) return res.redirect("/admin?err=INVALIDID");

        if (!(await db.get(`ip-${req.query.id}`))) return res.redirect("/admin?err=NOIP");
        
        let ip = await db.get(`ip-${req.query.id}`);
        log(`view ip`, `${req.session.userinfo.username}#${req.session.userinfo.discriminator} viewed the IP of the account with the ID \`${req.query.id}\`.`)
        return res.redirect(`/admin?err=success&ip=${ip}`)
    });

  /**
   * GET /userinfo
   * Endpoint to retrieve user information.
   */

    app.get("/userinfo", async (req, res) => {
        let theme = indexjs.get(req);

        if (!req.session.pterodactyl || !req.session) return four0four(req, res, theme);

        let cacheAccount = await fetch(
            `${settings.pterodactyl.domain}/api/application/users/${(await db.get(`users-${req.session.userinfo.id}`))}?include=servers`,
            {
                method: "GET",
                headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
            }
        );

        if (await cacheAccount.statusText == "Not Found") return four0four(req, res, theme);
        let cacheAccountInfo = JSON.parse(await cacheAccount.text());

        req.session.pterodactyl = cacheAccountInfo.attributes;
        if (!cacheAccountInfo.attributes.root_admin) return four0four(req, res, theme);

        if (!req.query.id) return res.send({ status: "missing id" });

        if (!(await db.get(`users-${req.query.id}`))) return res.send({ status: "invalid id" });

        let packagename = await db.get(`package-${req.query.id}`);
        let package = settings.packages.list[packagename ? packagename : settings.packages.default];
        if (!package) package = {
            ram: 0,
            disk: 0,
            cpu: 0,
            servers: 0
        };

        package["name"] = packagename;

        let pterodactylid = await db.get(`users-${req.query.id}`);
        let userinforeq = await fetch(
            `${settings.pterodactyl.domain}/api/application/users/${pterodactylid}?include=servers`,
            {
                method: "GET",
                headers: {
                    'Content-Type': 'application/json',
                    "Authorization": `Bearer ${settings.pterodactyl.key}` 
                }
            }
        );
        if (await userinforeq.statusText == "Not Found") {
            console.log("[WEBSITE] An error has occurred while attempting to get a user's information");
            console.log(`- Discord ID: ${req.query.id}`);
            console.log(`- Pterodactyl Panel ID: ${pterodactylid}`);
            return res.send({ status: "could not find user on panel" });
        }
        let userinfo = await userinforeq.json();

        res.send({
            status: "success",
            package: package,
            extra: await db.get(`extra-${req.query.id}`) ? await db.get(`extra-${req.query.id}`) : {
                ram: 0,
                disk: 0,
                cpu: 0,
                servers: 0
            },
            userinfo: userinfo,
            coins: settings.coins.enabled ? (await db.get(`coins-${req.query.id}`) ? await db.get(`coins-${req.query.id}`) : 0) : null
        });
    });
    
    async function four0four(req, res, theme) {
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
                };
                res.status(404);
                res.send(str);
            });
    }

    module.exports.suspend = async function (discordid) {
        if (!settings.allow.server.overresourcessuspend) return;

        let canpass = await indexjs.islimited();
        if (canpass == false) {
            setTimeout(async function () {
                    adminjs.suspend(discordid);
                }, 1)
            return;
        };

        indexjs.ratelimits(1);
        let pterodactylid = await db.get(`users-${discordid}`);
        let userinforeq = await fetch(
            `${settings.pterodactyl.domain}/api/application/users/${pterodactylid}?include=servers`,
            {
                method: "GET",
                headers: { 
                    'Content-Type': 'application/json',
                    "Authorization": `Bearer ${settings.pterodactyl.key}` 
                }
            }
        );
        if (await userinforeq.statusText == "Not Found") {
            console.log("[WEBSITE] An error has occurred while attempting to check if a user's server should be suspended.");
            console.log(`- Discord ID: ${req.query.id}`);
            console.log(`- Pterodactyl Panel ID: ${pterodactylid}`);
            return;
        };
        let userinfo = JSON.parse(await userinforeq.text());

        let packagename = await db.get(`package-${discordid}`);
        let package = settings.packages.list[packagename || settings.packages.default];

        let userRelationShipServers = userinfo.attributes.relationships.servers

        let extra =
            await db.get(`extra-${discordid}`) ||
            {
                ram: 0,
                disk: 0,
                cpu: 0,
                servers: 0
            };

        let plan = {
            ram: package.ram + extra.ram,
            disk: package.disk + extra.disk,
            cpu: package.cpu + extra.cpu,
            servers: package.servers + extra.servers
        };

        let current = {
            ram: 0,
            disk: 0,
            cpu: 0,
            servers: userRelationShipServers.data.length
        };
        for (let i = 0, len = userRelationShipServers.data.length; i < len; i++) {
            current.ram = current.ram + userRelationShipServers.data[i].attributes.limits.memory;
            current.disk = current.disk + userRelationShipServers.data[i].attributes.limits.disk;
            current.cpu = current.cpu + userRelationShipServers.data[i].attributes.limits.cpu;
        };

        indexjs.ratelimits(userRelationShipServers.data.length);
        if (current.ram > plan.ram || current.disk > plan.disk || current.cpu > plan.cpu || current.servers > plan.servers) {
            for (let i = 0, len = userRelationShipServers.data.length; i < len; i++) {
                let suspendid = userRelationShipServers.data[i].attributes.id;
                await fetch(
                    `${settings.pterodactyl.domain}/api/application/servers/${suspendid}/suspend`,
                    {
                        method: "POST",
                        headers: { 
                            'Content-Type': 'application/json',
                            "Authorization": `Bearer ${settings.pterodactyl.key}` 
                        }
                    }
                );
            }
        } else {
            if (settings.renewals.status) return;
            for (let i = 0, len = userRelationShipServers.data.length; i < len; i++) {
                let suspendid = userRelationShipServers.data[i].attributes.id;
                await fetch(
                    `${settings.pterodactyl.domain}/api/application/servers/${suspendid}/unsuspend`,
                    {
                        method: "POST",
                        headers: { 
                            'Content-Type': 'application/json',
                            "Authorization": `Bearer ${settings.pterodactyl.key}` 
                        }
                    }
                );
            }
        };
    }
};