const indexjs = require("../index.js");
const adminjs = require('./admin.js');
const ejs = require("ejs");
const fetch = require('node-fetch');
const NodeCache = require("node-cache");
const myCache = new NodeCache({ 
  deleteOnExpire: true,
  stdTTL: 59 
});

module.exports.load = async function (app, db) {
  /**
  * Information 
  * A lot of the API information is taken from Heliactyl v14.
  */


  /**
   * GET /api
   * Returns the status of the API.
   */
  app.get("/api", async (req, res) => {
    /* Check that the API key is valid */
    let auth = await check(req, res);
    if (!auth) return;
    res.send({ "status": true });
  });

  /**
   * GET /api/userinfo
   * Returns the user information.
   */

  app.get("/api/userinfo", async (req, res) => {
    /* Check that the API key is valid */
    let auth = await check(req, res);
    if (!auth) return;
  
    if (!req.query.id) return res.send({ status: "missing id" });
  
    if (!(await db.get("users-" + req.query.id))) return res.send({ status: "invalid id" });
  
    const newsettings = require('../handlers/readSettings').settings(); 
  
    if (newsettings.oauth2.link.slice(-1) == "/")
      newsettings.oauth2.link = newsettings.oauth2.link.slice(0, -1);
  
    if (newsettings.oauth2.callbackpath.slice(0, 1) !== "/")
    newsettings.oauth2.callbackpath = "/" + newsettings.oauth2.callbackpath

    if (newsettings.pterodactyl.domain.slice(-1) == "/")
    newsettings.pterodactyl.domain = newsettings.pterodactyl.domain.slice(0, -1);

    let packagename = await db.get("package-" + req.query.id);
    let package = newsettings.packages.list[packagename ? packagename : newsettings.packages.default];
    if (!package) package = {  
      ram: 0,  
      disk: 0,  
      cpu: 0,  
      servers: 0  
    };
    package["name"] = packagename;
  
    let pterodactylid = await db.get("users-" + req.query.id);
    
    let userinforeq = await fetch(
      newsettings.pterodactyl.domain + "/api/application/users/" + pterodactylid + "?include=servers",
      {
        method: "get",
        headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${newsettings.pterodactyl.key}` }
      }
    );
    if (await userinforeq.statusText == "Not Found") {
      console.log("[WEBSITE] An error has occured while attempting to get a user's information");
      console.log("- Discord ID: " + req.query.id);
      console.log("- Pterodactyl Panel ID: " + pterodactylid);
      return res.send({ status: "could not find user on panel" });
    }

    let userinfo = await userinforeq.json();
  
    res.send({
      status: "success",
      package: package,
      extra: await db.get("extra-" + req.query.id) ? await db.get("extra-" + req.query.id) : {
        ram: 0,
        disk: 0,
        cpu: 0,
        servers: 0
      },
      userinfo: userinfo,  
      coins: newsettings.coins.enabled == true ? (await db.get("coins-" + req.query.id) ? await db.get("coins-" + req.query.id) : 0) : null
    });
  });  

  /**
   * POST /api/setcoins
   * Sets the number of coins for a user.
   */

  app.post("/api/setcoins", async (req, res) => {	
    /* Check that the API key is valid */
    let auth = await check(req, res);	
    if (!auth) return;	

    if (typeof req.body !== "object") return res.send({status: "body must be an object"});	
    if (Array.isArray(req.body)) return res.send({status: "body cannot be an array"});	
    let id = req.body.id;	
    let coins = req.body.coins;	
    if (typeof id !== "string") return res.send({status: "id must be a string"});	
    if (!(await db.get("users-" + id))) return res.send({status: "invalid id"});	
    if (typeof coins !== "number") return res.send({status: "coins must be number"});	
    if (coins < 0 || coins > 999999999999999) return res.send({status: "too small or big coins"});	
    if (coins == 0) {	
      await db.delete("coins-" + id)	
    } else {	
      await db.set("coins-" + id, coins);	
    }	
    res.send({status: "success"});	
  });

  /**
   * POST /api/updateCoins
   * Updates the number of coins for a user.
   */

  app.get("/api/updateCoins", async (req, res) => {
    if (!req.session.pterodactyl) return res.redirect("/login");
  
    const newSettings = require('../handlers/readSettings').settings(); 
    let userInfo = req.session.userinfo;
    let initialCoins = await db.get(`coins-${req.session.userinfo.id}`);
  
    if (myCache.get(`coins_${userInfo.id}`) == true) 
      return res.send({coins: initialCoins});
  
    myCache.set(`coins_${userInfo.id}`, true, 59);
  
    if (await db.get(`coins-${userInfo.id}`) == null) {
      await db.set(`coins-${userInfo.id}`, 0);
    } else {
      let currentCoins = await db.get(`coins-${userInfo.id}`);
      currentCoins = currentCoins + newSettings["afk page"].coins;
      await db.set(`coins-${userInfo.id}`, currentCoins);
    }
  
    let updatedCoins = await db.get(`coins-${userInfo.id}`);
    res.send({coins: updatedCoins});
  });
  
  

  /**
   * POST /api/createcoupon
   * Creates a coupon with attributes such as coins, CPU, RAM, disk, and servers.
   */

app.post("/api/createcoupon", async (req, res) => {
    /* Check that the API key is valid */
    let auth = await check(req, res);
    if (!auth) return;

    if (typeof req.body !== "object") return res.send({status: "body must be an object"});
    if (Array.isArray(req.body)) return res.send({status: "body cannot be an array"});

    let code = typeof req.body.code == "string" ? req.body.code.slice(0, 200) : Math.random().toString(36).substring(2, 15);

    if (!code.match(/^[a-z0-9]+$/i)) return res.json({ status: "illegal characters" });

    let coins = typeof req.body.coins == "number" ? req.body.coins : 0;
    let ram = typeof req.body.ram == "number" ? req.body.ram : 0;
    let disk = typeof req.body.disk == "number" ? req.body.disk : 0;
    let cpu = typeof req.body.cpu == "number" ? req.body.cpu : 0;
    let servers = typeof req.body.servers == "number" ? req.body.servers : 0;

    if (coins < 0) return res.json({ status: "coins is less than 0" });
    if (ram < 0) return res.json({ status: "ram is less than 0" });
    if (disk < 0) return res.json({ status: "disk is less than 0" });
    if (cpu < 0) return res.json({ status: "cpu is less than 0" });
    if (servers < 0) return res.json({ status: "servers is less than 0" });

    if (!coins && !ram && !disk && !cpu && !servers) return res.json({ status: "cannot create empty coupon" });

    await db.set("coupon-" + code, {
      coins: coins,
      ram: ram,
      disk: disk,
      cpu: cpu,
      servers: servers
    });

    return res.json({ status: "success", code: code });
  });

  /**
   * POST /api/revokecoupon
   * Sets the plan for a user.
   */

  app.post("/api/revokecoupon", async (req, res) => {
    /* Check that the API key is valid */
    let auth = await check(req, res);
    if (!auth) return;

    if (typeof req.body !== "object") return res.send({status: "body must be an object"});
    if (Array.isArray(req.body)) return res.send({status: "body cannot be an array"});

    let code = req.body.code;

    if (!code) return res.json({ status: "missing code" });

    if (!code.match(/^[a-z0-9]+$/i)) return res.json({ status: "invalid code" });

    if (!(await db.get("coupon-" + code))) return res.json({ status: "invalid code" });

    await db.delete("coupon-" + code);

    res.json({ status: "success" })
});

  /**
   * POST /api/setplan
   * Sets the plan for a user.
   */

  app.post("/api/setplan", async (req, res) => {
    /* Check that the API key is valid */
    let auth = await check(req, res);
    if (!auth) return;

    if (!req.body) return res.send({ status: "missing body" });

    if (typeof req.body.id !== "string") return res.send({ status: "missing id" });

    if (!(await db.get("users-" + req.body.id))) return res.send({ status: "invalid id" });

    if (typeof req.body.package !== "string") {
      await db.delete("package-" + req.body.id);
      adminjs.suspend(req.body.id);
      return res.send({ status: "success" });
    } else {
      const newsettings = require('../handlers/readSettings').settings(); 
      if (!newsettings.packages.list[req.body.package]) return res.send({ status: "invalid package" });
      await db.set("package-" + req.body.id, req.body.package);
      adminjs.suspend(req.body.id);
      return res.send({ status: "success" });
    }
  });

  /**
   * POST /api/setresources
   * Sets the resources for a user.
   */

  app.post("/api/setresources", async (req, res) => {
    /* Check that the API key is valid */
    let auth = await check(req, res);
    if (!auth) return;

    if (!req.body) return res.send({ status: "missing body" });

    if (typeof req.body.id !== "string") return res.send({ status: "missing id" });

    if (!(await db.get("users-" + req.body.id))) res.send({ status: "invalid id" });

    if (typeof req.body.ram == "number" || typeof req.body.disk == "number" || typeof req.body.cpu == "number" || typeof req.body.servers == "number") {
      let ram = req.body.ram;
      let disk = req.body.disk;
      let cpu = req.body.cpu;
      let servers = req.body.servers;

      let currentextra = await db.get("extra-" + req.body.id);
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

      if (typeof ram == "number") {
        if (ram < 0 || ram > 999999999999999) {
          return res.send({ status: "ram size" });
        }
        extra.ram = ram;
      }

      if (typeof disk == "number") {
        if (disk < 0 || disk > 999999999999999) {
          return res.send({ status: "disk size" });
        }
        extra.disk = disk;
      }

      if (typeof cpu == "number") {
        if (cpu < 0 || cpu > 999999999999999) {
          return res.send({ status: "cpu size" });
        }
        extra.cpu = cpu;
      }

      if (typeof servers == "number") {
        if (servers < 0 || servers > 999999999999999) {
          return res.send({ status: "server size" });
        }
        extra.servers = servers;
      }

      if (extra.ram == 0 && extra.disk == 0 && extra.cpu == 0 && extra.servers == 0) {
        await db.delete("extra-" + req.body.id);
      } else {
        await db.set("extra-" + req.body.id, extra);
      }

      adminjs.suspend(req.body.id);
      return res.send({ status: "success" });
    } else {
      res.send({ status: "missing variables" });
    }
  });


  /**
   * Checks the authorization and returns the settings if authorized.
   * Renders the file based on the theme and sends the response.
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {Object|null} - The settings object if authorized, otherwise null.
   */

  async function check(req, res) {
    const settings = require('../handlers/readSettings').settings(); 
    if (settings.api.enabled == true) {
      let auth = req.headers['authorization'];
      if (auth) {
        if (auth == "Bearer " + settings.api.code) {
          return settings;
        };
      };
    }

    let theme = indexjs.get(req);
    ejs.renderFile(
      `./themes/${theme.name}/${theme.settings.notfound}`,
      await indexjs.renderdataeval(req),
      null,
      function (err, str) {
        delete req.session.newaccount;
        if (err) {
          console.log(`[WEBSITE] An error has occured on path ${req._parsedUrl.pathname}:`);
          console.log(err);
          return res.render("404.ejs", { err });
        };
        res.status(200);
        res.send(str);
      });
    return null;
  }
};
