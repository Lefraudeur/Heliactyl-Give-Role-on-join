const adminjs = require('./admin');
const newsettings = require('../handlers/readSettings').settings();
const { getPteroUser } = require('../handlers/getPteroUser');

module.exports.load = async (app, db) => {

  /**
  * Information 
  * A lot of the API information is taken from Heliactyl v14 (heliactyloss).
  * 'Content-Type': 'application/json'
  */

  /**
   * Middleware to check API authorization
   */
  async function checkAPI(req, res, next) {
    if (!newsettings.api.enabled) return res.status(403).send('API Disabled');
    
    const auth = req.headers['authorization'];
    if (!auth || auth !== `Bearer ${newsettings.api.code}`) {
      return res.status(401).send('Unauthorized');
    }
    
    next();
  }

  /**
   * GET /api
   * Returns the status of the API.
   */
  app.get("/api", checkAPI, async (req, res) => {
    res.send({ "status": true });
  });

  /**
   * POST /api/userinfo
   * Returns the user information.
   */
  app.post("/api/userinfo", checkAPI, async (req, res) => {
    const userId = req.body.id;
    if (!userId) return res.send({ status: "missing id" });

    const user = await db.get(`users-${userId}`);
    if (!user) return res.send({ status: "invalid id" });

    const package = newsettings.packages.list[user.package] || {
      ram: 0,
      disk: 0,
      cpu: 0,
      servers: 0
    };
    package.name = user.package;

    const cacheAccount = await getPteroUser(req.session.userinfo.id, db);
    if (!cacheAccount) return res.send({ status: "unable to fetch user info" });

    res.send({
      status: "success",
      coins: newsettings.coins.enabled ? (user.coins || 0) : null,
      package,
      extra: await db.get(`extra-${userId}`) || { 
        ram: 0,
        disk: 0,
        cpu: 0,
        servers: 0
      },
      userinfo: cacheAccount
    });
  });

  /**
   * POST /api/setcoins
   * Sets the number of coins for a user.
   */
  app.post("/api/setcoins", checkAPI, async (req, res) => {
    const { id, coins } = req.body;
    if (typeof req.body !== "object") return res.send({ status: "body must be an object" });
    if (!id) return res.send({ status: "id must be a string" });
    if (!coins || typeof coins !== "number") return res.send({ status: "coins must be a number" });

    if (coins < 0 || coins > 999999999999999) {
      return res.send({ status: "coins out of range" });
    }

    if (coins === 0) {
      await db.delete(`coins-${id}`);
    } else {
      await db.set(`coins-${id}`, coins);
    }

    res.send({ status: "success" });
  });

  /**
   * POST /api/createcoupon
   * Creates a coupon with attributes such as coins, CPU, RAM, disk, and servers.
   */
  app.post("/api/createcoupon", checkAPI, async (req, res) => {
    if (typeof req.body !== "object") return res.send({ status: "body must be an object" });

    let { code, coins = 0, ram = 0, disk = 0, cpu = 0, servers = 0 } = req.body;
    code = code ? code.slice(0, 200) : Math.random().toString(36).substring(2, 15);

    if (!code.match(/^[a-z0-9]+$/i)) return res.json({ status: "illegal characters in code" });

    if (coins < 0 || ram < 0 || disk < 0 || cpu < 0 || servers < 0) {
      return res.json({ status: "negative values not allowed" });
    }

    if (coins === 0 && ram === 0 && disk === 0 && cpu === 0 && servers === 0) {
      return res.json({ status: "cannot create empty coupon" });
    }

    await db.set(`coupon-${code}`, { coins, ram, disk, cpu, servers });

    res.json({ status: "success", code });
  });

  /**
   * POST /api/revokecoupon
   * Revokes a coupon.
   */
  app.post("/api/revokecoupon", checkAPI, async (req, res) => {
    if (typeof req.body !== "object") return res.send({ status: "body must be an object" });

    const { code } = req.body;
    if (!code) return res.json({ status: "missing code" });

    if (!code.match(/^[a-z0-9]+$/i) || !(await db.get(`coupon-${code}`))) {
      return res.json({ status: "invalid code" });
    }

    await db.delete(`coupon-${code}`);

    res.json({ status: "success" });
  });

  /**
   * POST /api/setplan
   * Sets the plan for a user.
   */
  app.post("/api/setplan", checkAPI, async (req, res) => {
    const { id, package: plan } = req.body;
    if (!id) return res.send({ status: "missing id" });

    if (typeof plan !== "string" || !readSettings().packages.list[plan]) {
      await db.delete(`package-${id}`);
    } else {
      await db.set(`package-${id}`, plan);
    }

    adminjs.suspend(id);
    res.send({ status: "success" });
  });

  /**
   * POST /api/setresources
   * Sets the resources for a user.
   */
  app.post("/api/setresources", checkAPI, async (req, res) => {
    const { id, ram, disk, cpu, servers } = req.body;
    if (!id) return res.send({ status: "missing id" });

    const currentExtra = await db.get(`extra-${id}`) || { ram: 0, disk: 0, cpu: 0, servers: 0 };
    const resources = { ram, disk, cpu, servers };
    const limits = { ram: 999999999999999, disk: 999999999999999, cpu: 999999999999999, servers: 999999999999999 };

    for (const key in resources) {
      if (resources.hasOwnProperty(key)) {
        const value = resources[key];
        if (typeof value === "number" && value >= 0 && value <= limits[key]) {
          currentExtra[key] = value;
        } else {
          return res.send({ status: `${key} size` });
        }
      }
    }

    if (Object.values(currentExtra).every(val => val === 0)) {
      await db.delete(`extra-${id}`);
    } else {
      await db.set(`extra-${id}`, currentExtra);
    }

    adminjs.suspend(id);
    res.send({ status: "success" });
  });
};