const settings = require('../handlers/readSettings').settings(); 
const fetch = require('node-fetch');
const getPteroUser = require('../handlers/getPteroUser.js');

module.exports.load = async function(app, db) {
  app.get("/panel", (req, res) => res.redirect(settings.pterodactyl.domain));

  app.get("/updateinfo", async (req, res) => {
    try {
      if (!req.session.pterodactyl || !req.session) return res.redirect("/login");

      const cacheAccount = await getPteroUser(req.session.userinfo.id, db);

      if (!cacheAccount) return;
      req.session.pterodactyl = cacheAccount.attributes;
      
      if (req.query.redirect && typeof req.query.redirect === "string") return res.redirect("/" + req.query.redirect);
      
      res.redirect("/settings?err=SUCCESS");
    } catch (error) {
      res.send("An error has occurred while attempting to update your account information and server list.");
    }
  });

  app.get("/regen", async (req, res) => {
    try {
      if (!req.session.pterodactyl || !req.session) return res.redirect("/login");
      const newsettings = require('../handlers/readSettings').settings(); 
      if (!newsettings.allow.regen) return res.send("You cannot regenerate your password currently.");
      
      
      if (newsettings.pterodactyl.domain.slice(-1) == "/")
      newsettings.pterodactyl.domain = newsettings.pterodactyl.domain.slice(0, -1);
    
      let newpassword = generateRandomPassword(newsettings.passwordgenerator["length"]);
      req.session.password = newpassword;
  
      await fetch(
        `${settings.pterodactyl.domain}/api/application/users/${req.session.pterodactyl.id}`,
        {
          method: "PATCH",
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
};

function generateRandomPassword(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}