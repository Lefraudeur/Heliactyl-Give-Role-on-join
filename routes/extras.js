const settings = require('../handlers/readSettings').settings(); 
const fetch = require('node-fetch');
const getPteroUser = require('../handlers/getPteroUser.js');

module.exports.load = async function(app, db) {
  app.get("/panel", (req, res) => res.redirect(settings.pterodactyl.domain));

  app.get("/updateinfo", async (req, res) => {
    try {
      if (!req.session.pterodactyl) return res.redirect("/login");

      const cacheaccount = await getPteroUser(req.session.userinfo.id, db);

      if (!cacheaccount) return;
      req.session.pterodactyl = cacheaccount.attributes;
      
      if (req.query.redirect && typeof req.query.redirect === "string") 
        return res.redirect("/" + req.query.redirect);
      
      res.redirect("/settings");
    } catch (error) {
      res.send("An error has occurred while attempting to update your account information and server list.");
    }
  });

  app.get("/regen", async (req, res) => {
    try {
    if (!req.session.pterodactyl) return res.redirect("/login");
    const newsettings = require('../handlers/readSettings').settings(); 
    if (newsettings.allow.regen !== true) return res.send("You cannot regenerate your password currently.");


    if (newsettings.pterodactyl.domain.slice(-1) == "/")
    newsettings.pterodactyl.domain = newsettings.pterodactyl.domain.slice(0, -1);

    let newpassword = generateRandomPassword(newsettings.passwordgenerator["length"]);
    req.session.password = newpassword;

    await fetch(
      `${settings.pterodactyl.domain}/api/application/users/${req.session.pterodactyl.id}`,
      {
        method: "patch",
        headers: {
          'Content-Type': 'application/json',
          "Authorization": `Bearer ${settings.pterodactyl.key}`
        },
        body: JSON.stringify({
          username: req.session.pterodactyl.username,
          email: req.session.pterodactyl.email,
          first_name: req.session.pterodactyl.first_name,
          last_name: req.session.pterodactyl.last_name,
          password: newpassword
        })
      }
    );
    res.redirect("/settings");
    } catch (error) {
      res.send("An error occurred while attempting to regenerate your password.");
    }
  });

  app.get("/ping", async (req, res) => {
    if (!req.session.pterodactyl) 
        return res.json({ error: true, message: `You must be logged in.` });
    try {
        let response = await fetch(`${settings.pterodactyl.domain}/api/application/nodes`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                "Authorization": `Bearer ${settings.pterodactyl.key}`,
                "Accept": "application/json" 
            }
        });

        const data = await response.json();
        const nodes = data.data;
        
        if (!nodes || !nodes.length) {
            console.error('No nodes found.');
            return;
        }

        let pingData = {};

        for (const node of nodes) {
            const { attributes } = node;
            try {
                const pingStart = performance.now();
                await fetch(`http://${attributes.ip}`); 
                const pingEnd = performance.now();
                const pingTime = pingEnd - pingStart; 
                pingData[attributes.location_id] = pingTime;
            } catch (error) {
                console.error('Error pinging node:', error);
                pingData[attributes.location_id] = -1; 
            }
        }

        return res.json({ pingData });
    } catch (error) {
        console.error('Error fetching nodes or calculating ping:', error);
        res.status(500).send("An error has occurred while processing your request.");
    }
  });
};

function generateRandomPassword(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}