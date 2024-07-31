const settings = require('../handlers/readSettings').settings(); 
const fetch = require('node-fetch');
const getPteroUser = require('../handlers/getPteroUser');

module.exports.load = async function(app, db) {
  app.get("/panel", (req, res) => res.redirect(settings.pterodactyl.domain));

  app.get("/updateinfo", async (req, res) => {
    try {
      if (!req.session || !req.session.pterodactyl || !req.session.userinfo) return res.redirect("/login");

      const cacheAccount = await getPteroUser(req.session.userinfo.id, db);
      if (!cacheAccount) return;
      
      req.session.pterodactyl = cacheAccount.attributes;
      
      if (req.query.redirect && typeof req.query.redirect === "string") return res.redirect(`/${req.query.redirect}`);
      
      res.redirect("/settings?err=SUCCESS");
    } catch (error) {
      console.error("An error has occurred while attempting to update your account information and server list:", error);
      return res.redirect('/dashboard?err=INTERNALERROR')
    }
  });

  app.get("/regen", async (req, res) => {
    try {
      if (!req.session || !req.session.pterodactyl || !req.session.userinfo) return res.redirect("/login");
      if (!settings.allow.regen) return res.redirect("/settings?err=CANTREGENPASSWORD");
    
      let newpassword = generateRandomPassword(settings.passwordgenerator.length);
      req.session.password = newpassword;
  
      await fetch(`${settings.pterodactyl.domain}/api/application/users/${req.session.pterodactyl.id}`, {
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
      });
      res.redirect("/settings");
    } catch (error) {
      console.error("An error occurred while attempting to regenerate your password:", error);
      return res.redirect('/dashboard?err=INTERNALERROR')
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
};