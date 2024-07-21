const fetch = require("node-fetch");
const getPteroUser = require('../handlers/getPteroUser');
const logToDiscord = require("../handlers/log");
const indexjs = require("../index");
const adminjs = require("./admin");
const settings = require('../handlers/readSettings').settings();

module.exports.load = async (app, db) => {

async function checkAuthenticated (req, res, next) {
    if (!req.session || !req.session.pterodactyl) return res.redirect("/");

    const cacheAccount = await getPteroUser(req.session.userinfo.id, db);
    if (!cacheAccount) return;

    req.session.pterodactyl = cacheAccount.attributes;
    if (!cacheAccount.attributes.root_admin) return res.redirect("/dashboard");

    next();
};

  /**
   * GET /setcoins
   * Endpoint to set the number of coins for a user.
   */
    app.get("/setcoins", checkAuthenticated, async (req, res) => {
        let { id, coins } = req.query;

        if (!id) return res.redirect("/admin?err=MISSINGID");
        if (!(await db.get(`users-${id}`))) return res.redirect("/admin?err=INVALIDID");
        if (!coins) return res.redirect("/admin?err=MISSINGCOINS");

        coins = parseFloat(coins);

        if (isNaN(coins)) return res.redirect("/admin?err=INVALIDCOINNUMBER");

        if (coins < 0 || coins > 999999999999999) return res.redirect("/admin?err=COINSIZE");

        if (coins === 0) {
            await db.delete(`coins-${id}`)
        } else {
            await db.set(`coins-${id}`, coins);
        }

        logToDiscord(
            "set coins",
            `${req.session.userinfo.username}#${req.session.userinfo.discriminator} set the coins of the user with the ID \`${id}\` to \`${coins}\`.`
        );
        res.redirect("/admin?success=SUCCESS");
    });

  /**
   * GET /addcoins
   * Endpoint to add coins to a user's account.
   */
    app.get("/addcoins", checkAuthenticated, async (req, res) => {
        let { id, coins } = req.query;

        if (!id) return res.redirect("/admin?err=MISSINGID");
        if (!(await db.get(`users-${id}`))) return res.redirect("/admin?err=INVALIDID");
        if (!coins) return res.redirect("/admin?err=MISSINGCOINS");

        let currentcoins = await db.get(`coins-${id}`) || 0;

        coins = currentcoins + parseFloat(coins);

        if (isNaN(coins)) return res.redirect("/admin?err=INVALIDCOINNUMBER");

        if (coins < 0 || coins > 999999999999999) return res.redirect("/admin?err=COINSIZE");

        if (coins === 0) {
            await db.delete(`coins-${id}`)
        } else {
            await db.set(`coins-${id}`, coins);
        }

        logToDiscord(
            "add coins",
            `${req.session.userinfo.username}#${req.session.userinfo.discriminator} added \`${coins}\` coins to the user with the ID \`${id}\`'s account.`
        );
        res.redirect("/admin?success=SUCCESS");
    });

  /**
   * GET /setresources
   * Endpoint to set additional resources for a user's account.
   */
  app.get("/setresources", checkAuthenticated, async (req, res) => {
    let { id, cpu, ram, disk, servers } = req.query;

    if (!id) return res.redirect("/admin?err=MISSINGID");
    if (!(await db.get(`users-${id}`))) return res.redirect("/admin?err=INVALIDID");
    if (!cpu || !ram || !disk || !servers) return res.redirect("/admin?err=MISSINGVARIABLES");

    let currentExtra = await db.get(`extra-${id}`) || { ram: 0, disk: 0, cpu: 0, servers: 0 };

    const resources = { ram, disk, cpu, servers };
    const limits = { ram: 999999999999999, disk: 999999999999999, cpu: 999999999999999, servers: 999999999999999 };

    for (let key in resources) {
        let value = parseFloat(resources[key]);
        if (isNaN(value) || value < 0 || value > limits[key]) return res.redirect(`/admin?err=${key.toUpperCase()}SIZE`);
        currentExtra[key] = value;
    }

    if (Object.values(currentExtra).every(val => val === 0)) {
        await db.delete(`extra-${id}`);
    } else {
        await db.set(`extra-${id}`, currentExtra);
    }

    adminjs.suspend(id);
    logToDiscord(
        "set resources",
        `${req.session.userinfo.username}#${req.session.userinfo.discriminator} set the resources of the user with the ID \`${id}\` to:\n\`\`\`servers: ${servers}\nCPU: ${cpu}%\nMemory: ${ram} MB\nDisk: ${disk} MB\`\`\``
    );

    res.redirect("/admin?success=SUCCESS");
});

  /**
   * GET /addresources
   * Endpoint to add additional resources to a user's account.
   */
  app.get("/addresources", checkAuthenticated, async (req, res) => {
    let { id, cpu, ram, disk, servers } = req.query;

    if (!id) return res.redirect("/admin?err=MISSINGID");
    if (!(await db.get(`users-${id}`))) return res.redirect("/admin?err=INVALIDID");
    if (!cpu || !ram || !disk || !servers) return res.redirect("/admin?err=MISSINGVARIABLES");

    let currentExtra = await db.get(`extra-${id}`) || { ram: 0, disk: 0, cpu: 0, servers: 0 };

    const resources = { ram, disk, cpu, servers };
    const limits = { ram: 999999999999999, disk: 999999999999999, cpu: 999999999999999, servers: 999999999999999 };

    for (let key in resources) {
        let value = parseFloat(resources[key]);
        if (isNaN(value) || value < 0 || value > limits[key]) return res.redirect(`/admin?err=${key.toUpperCase()}SIZE`);
        currentExtra[key] += value;
    }

    if (Object.values(currentExtra).every(val => val === 0)) {
        await db.delete(`extra-${id}`);
    } else {
        await db.set(`extra-${id}`, currentExtra);
    }

    adminjs.suspend(id);
    logToDiscord(
        "add resources",
        `${req.session.userinfo.username}#${req.session.userinfo.discriminator} added resources for user ID \`${id}\`:\n\`\`\`servers: ${servers}\nCPU: ${cpu}%\nMemory: ${ram} MB\nDisk: ${disk} MB\`\`\``
    );

    return res.redirect("/admin?success=SUCCESS");
});

  /**
   * GET /stats
   * Endpoint to display the statistiques
   */
  app.get("/stats", checkAuthenticated, async (req, res) => {
    const users = await db.get("users") || [];

    const stats = {
      total_users: users.length,
    };

    res.json(stats);
  });

  /**
   * GET /setplan
   * Endpoint to set the plan for a user.
   */
    app.get("/setplan", checkAuthenticated, async (req, res) => {
        let { id, package } = req.query;

        if (!id) return res.redirect("/admin?err=MISSINGID");
        if (!(await db.get(`users-${id}`))) return res.redirect("/admin?err=INVALIDID");
        if (!package) return;

        if (!settings.packages.list[package]) return res.redirect("/admin?err=INVALIDPACKAGE");
        await db.set(`package-${id}`, package);
        adminjs.suspend(id);
        logToDiscord(
            "set plan",
            `${req.session.userinfo.username}#${req.session.userinfo.discriminator} set the plan of the user with the ID \`${id}\` to \`${package}\`.`
        );
        return res.redirect("/admin?success=SUCCESS");
    });

  /**
   * GET /create_coupon
   * Endpoint to create a coupon code.
   */
    app.get("/create_coupon", checkAuthenticated, async (req, res) => {
        let {
            cpu = cpu * 100 || 0,
            ram = ram * 1024 || 0,
            disk = disk * 1024 || 0,
            servers = servers || 0,
            coins = coins || 0 ,
            code = code ? code.slice(0, 200) : Math.random().toString(36).substring(2, 15)
        } = req.query;

        if (!code.match(/^[a-z0-9]+$/i)) return res.redirect("/admin?err=CREATECOUPONINVALIDCHARACTERS");

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

        logToDiscord(
            "create coupon",
            `${req.session.userinfo.username}#${req.session.userinfo.discriminator} created the coupon code \`${code}\` which gives:\`\`\`coins: ${coins}\nMemory: ${ram} MB\nDisk: ${disk} MB\nCPU: ${cpu}%\nServers: ${servers}\`\`\``
        );
        res.redirect(`/admin?code=${code}`)
    });

  /**
   * GET /revoke_coupon
   * Endpoint to revoke a coupon code.
   */
    app.get("/revoke_coupon", checkAuthenticated, async (req, res) => {
        let { code } = req.query;

        if (!code.match(/^[a-z0-9]+$/i)) return res.redirect("/admin?err=REVOKECOUPONCANNOTFINDCODE");

        if (!(await db.get(`coupon-${code}`))) return res.redirect("/admin?err=REVOKECOUPONCANNOTFINDCODE");

        await db.delete(`coupon-${code}`);

        logToDiscord(
            "revoke coupon",
            `${req.session.userinfo.username}#${req.session.userinfo.discriminator} revoked the coupon code \`${code}\`.`
        );
        res.redirect("/admin?revokedcode=true");
    });

  /**
   * GET /remove_account
   * Endpoint to remove an account.
   */
    app.get("/remove_account", checkAuthenticated, async (req, res) => {
        let { id } = req.query;

        // This doesn't delete the account and doesn't touch the renewal system.
        if (!id) return res.redirect("/dashboard?err=REMOVEACCOUNTMISSINGID");

        let pteroid = await db.get(`users-${id}`);

        // Remove IP.
        let selected_ip = await db.get(`ip-${id}`);

        if (selected_ip) {
            // Never seen before
            let allips = await db.get("ips") || [];
            allips = allips.filter(ip => ip !== selected_ip);

            if (allips.length === 0) {
                await db.delete("ips");
            } else {
                await db.set("ips", allips);
            }

            await db.delete(`ip-${id}`);
        }

        // Remove user from dashboard.
        let userids = await db.get("users") || [];
        userids = userids.filter(user => user !== pteroid);

        if (userids.length === 0) {
            await db.delete("users");
        } else {
            await db.set("users", userids);
        }

        await db.delete(`users-${id}`);

        // Remove coins/resources.
        await db.delete(`coins-${id}`);
        await db.delete(`extra-${id}`);
        await db.delete(`package-${id}`);

        // Remove server and user account
        let servers = cacheAccount.attributes.relationships.servers.data;
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

        logToDiscord(
            "remove account",
            `${req.session.userinfo.username}#${req.session.userinfo.discriminator} removed the account with the ID \`${id}\`.`
        );
        res.redirect("/login?success=REMOVEACCOUNT");
    });

  /**
   * GET /getip
   * Endpoint to retrieve the IP address associated with a user's account.
   */
    app.get("/getip", checkAuthenticated, async (req, res) => {
        let { id } = req.query;

        if (!id) return res.redirect("/admin?err=MISSINGID");

        if (!(await db.get(`users-${id}`))) return res.redirect("/admin?err=INVALIDID");

        if (!(await db.get(`ip-${id}`))) return res.redirect("/admin?err=NOIP");
        
        let ip = await db.get(`ip-${id}`);
        logToDiscord(
            "view ip",
            `${req.session.userinfo.username}#${req.session.userinfo.discriminator} viewed the IP of the account with the ID \`${id}\`.`
        );
        return res.redirect(`/admin?success=IP&ip=${ip}`);
    });

  /**
   * GET /userinfo
   * Endpoint to retrieve user information.
   */
    app.get("/userinfo", checkAuthenticated, async (req, res) => {
        let { id } = req.query;

        if (!id) return res.send({ status: "missing id" });

        if (!(await db.get(`users-${id}`))) return res.send({ status: "invalid id" });

        let packagename = await db.get(`package-${id}`);
        let package = settings.packages.list[packagename || settings.packages.default];
        if (!package) package = {
            ram: 0,
            disk: 0,
            cpu: 0,
            servers: 0
        };

        package.name = packagename;

        const cacheAccount = await getPteroUser(req.session.userinfo.id, db);
        if (!cacheAccount) return;

        res.send({
            status: "success",
            package: package,
            extra: await db.get(`extra-${id}`) || {
                ram: 0,
                disk: 0,
                cpu: 0,
                servers: 0
            },
            userinfo: userinfo,
            coins: settings.coins.enabled ? (await db.get(`coins-${id}`) || 0) : null
        });
    });

    module.exports.suspend = async (discordid) => {
        if (!settings.allow.server.overresourcessuspend) return;

        let canpass = await indexjs.islimited();
        if (!canpass) {
            setTimeout(() => {
                adminjs.suspend(discordid);
            }, 1);
            return;
        }
        
        indexjs.ratelimits(req._parsedUrl.pathname, req.ip, 1);
        const cacheAccount = await getPteroUser(req.session.userinfo.id, db);
        if (!cacheAccount) return;

        let packagename = await db.get(`package-${discordid}`);
        let package = settings.packages.list[packagename || settings.packages.default];

        let userRelationShipServers = userinfo.attributes.relationships.servers;

        let extra = await db.get(`extra-${discordid}`) || {
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

        indexjs.ratelimits(req._parsedUrl.pathname, req.ip, userRelationShipServers.data.length);
        if (current.ram > plan.ram || current.disk > plan.disk || current.cpu > plan.cpu || current.servers > plan.servers) {
            for (let i = 0, len = userRelationShipServers.data.length; i < len; i++) {
                let suspendid = userRelationShipServers.data[i].attributes.id;
                await fetch(`${settings.pterodactyl.domain}/api/application/servers/${suspendid}/suspend`, {
                    method: "POST",
                    headers: { 
                        'Content-Type': 'application/json',
                        "Authorization": `Bearer ${settings.pterodactyl.key}` 
                    }
                });
            }
        } else {
            if (settings.renewals.status) return;

            for (let i = 0, len = userRelationShipServers.data.length; i < len; i++) {
                let suspendid = userRelationShipServers.data[i].attributes.id;
                await fetch(`${settings.pterodactyl.domain}/api/application/servers/${suspendid}/unsuspend`, {
                    method: "POST",
                    headers: { 
                        'Content-Type': 'application/json',
                        "Authorization": `Bearer ${settings.pterodactyl.key}` 
                    }
                });
            }
        };
    }
};