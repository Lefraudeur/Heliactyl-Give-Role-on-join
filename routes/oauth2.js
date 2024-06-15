"use strict";

const settings = require('../handlers/readSettings').settings(); 

const indexjs = require("../index.js");
const log = require('../handlers/log');
const vpnCheck = require("../handlers/vpnCheck");
const getTemplate = require('../handlers/getTemplate.js').template;
const fetch = require('node-fetch');

if (settings.oauth2.link.slice(-1) == "/")
  settings.oauth2.link = settings.oauth2.link.slice(0, -1);

if (settings.oauth2.callbackpath.slice(0, 1) !== "/")
  settings.oauth2.callbackpath = "/" + settings.oauth2.callbackpath;

if (settings.pterodactyl && settings.pterodactyl.domain && settings.pterodactyl.domain.endsWith("/")) {
    settings.pterodactyl.domain = settings.pterodactyl.domain.slice(0, -1);
}

module.exports.load = async function (app, db) {  
  app.get("/login", async (req, res) => {
    if (req.query.redirect) req.session.redirect = "/" + req.query.redirect;
    res.redirect(
      `https://discord.com/api/oauth2/authorize?client_id=${settings.oauth2.id}&redirect_uri=${encodeURIComponent(settings.oauth2.link + settings.oauth2.callbackpath)}&response_type=code&scope=identify%20email${
          settings.bot.joinguild.enabled == true ? "%20guilds.join" : ""
      }${
          settings.j4r.enabled == true ? "%20guilds" : ""
      }${
          settings.oauth2.prompt == false ? "&prompt=none" : (req.query.prompt ? (req.query.prompt == "none" ? "&prompt=none" : "") : "")
      }`
  );
  });

app.get("/logout", (req, res) => {
  let theme = indexjs.get(req);
  req.session.destroy(() => {
    return res.redirect(theme.settings.redirect.logout || "/");
  });
});

  app.get(settings.oauth2.callbackpath, async (req, res) => {
    if (!req.query.code) return res.redirect(`/login`);
    const code = encodeURIComponent(req.query.code.replace(/'/g, ''));
    res.send(getTemplate("Please wait...", "Logging in... Please wait, you'll be redirected soon") + `
    <script type="text/javascript" defer>
      history.pushState('/login', 'Logging in...', '/login')
      window.location.replace('/submitlogin?code=${code}')
    </script>
  `);
  })
  
  app.get(`/submitlogin`, async (req, res) => {
    if (!req.query.code) return res.send("Missing code.");
    let customredirect = req.session.redirect;
    delete req.session.redirect;

    const newsettings = require('../handlers/readSettings').settings(); 

    let ip = (newsettings.oauth2.ip["trust x-forwarded-for"] ? (req.headers['x-forwarded-for'] || req.connection.remoteAddress) : req.connection.remoteAddress);
    ip = (ip ? ip : "::1").replace(/::1/g, "::ffff:127.0.0.1").replace(/^.*:/, '');

    if (newsettings.antivpn.status && ip !== '127.0.0.1' && !newsettings.antivpn.whitelistedIPs.includes(ip)) {
      const vpn = await vpnCheck(newsettings.antivpn.APIKey, db, ip, res);
      if (vpn) return;
    }

    let body = 
    "client_id=" + encodeURIComponent(settings.oauth2.id) +
    "&client_secret=" + encodeURIComponent(settings.oauth2.secret) +
    "&grant_type=authorization_code" +
    "&code=" + encodeURIComponent(req.query.code) +
    "&redirect_uri=" + encodeURIComponent(settings.oauth2.link + settings.oauth2.callbackpath);
  
    let tokenReponse = await fetch(
      'https://discord.com/api/oauth2/token',
      {
        method: "POST",
        body: body,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    if (tokenReponse.ok == true) {
      let codeinfo = JSON.parse(await tokenReponse.text());
      let scopes = codeinfo.scope;
      let missingscopes = [];

      if (scopes.replace(/identify/g, "") == scopes) missingscopes.push("identify");
      if (scopes.replace(/email/g, "") == scopes) missingscopes.push("email");
      if (newsettings.bot.joinguild.enabled == true && scopes.replace(/guilds.join/g, "") == scopes) missingscopes.push("guilds.join");
      if (newsettings.j4r.enabled && scopes.replace(/guilds/g, "") == scopes) missingscopes.push("guilds");
      if (missingscopes.length !== 0) return res.send("Missing scopes: " + missingscopes.join(", "));
      let userReponse = await fetch(
        'https://discord.com/api/users/@me',
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${codeinfo.access_token}`
          }
        }
      );

      let userinfo = JSON.parse(await userReponse.text());

      // Check if whitelist is enabled and if the user is whitelisted

      if (settings.oauth2.whitelist && settings.oauth2.whitelist.status && !settings.oauth2.whitelist.users.includes(userinfo.id)) 
        return res.send(getTemplate("Whitelisted", "You are not whitelisted. Please contact the administrator for more information.", true));

      // Check if blacklist is enabled and if the user is blacklisted

      if (settings.oauth2.blacklist.status && settings.oauth2.blacklist.users.includes(userinfo.id)) 
        return res.send(getTemplate("Blacklisted", "You are blacklisted. Please contact the administrator for more information.", true));

      let guildsReponse = await fetch('https://discord.com/api/users/@me/guilds',
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${codeinfo.access_token}`
          }
        }
      );

      let guildsinfo = await guildsReponse.json();

      if (userinfo.verified !== true) 
        return res.send("Not verified a Discord account. Please verify the email on your Discord account.");

      // Check if the user is "blacklisted" ip

      if (newsettings.oauth2.ip.block.includes(ip)) 
        return res.send(getTemplate("IP Blacklisted", "You could not sign in, because your IP has been blocked from signing in.", true));

      // Check if the user is has different accounts on the same ip (works 1 time out of 2)

      if (newsettings.oauth2.ip["duplicate check"] && ip !== '127.0.0.1') {
        const ipuser = await db.get(`ipuser-${ip}`);
        if (ipuser && ipuser !== userinfo.id) {
          return res.status(200).send(getTemplate("Alt Account Detected", `${newsettings.name} detected that you have multiple accounts with us. We do not allow the use of multiple accounts on our services.`, true));
        } else if (!ipuser) {
          await db.set(`ipuser-${ip}`, userinfo.id);
        }
      }      

        if (newsettings.j4r.enabled) {
          if (guildsinfo.message == '401: Unauthorized') return res.send("Please allow us to know what servers you are in to let the J4R system work properly. <a href='/login'>Login again</a>");
          let userj4r = await db.get(`j4rs-${userinfo.id}`) ?? [];
          await guildsinfo;

          let coins = await db.get(`coins-${userinfo.id}`) ?? 0;

          // Checking if the user has completed any new j4rs
          for (const guild of newsettings.j4r.ads) {
            if ((guildsinfo.find(g => g.id === guild.id)) && (!userj4r.find(g => g.id === guild.id))) {
              userj4r.push({
                id: guild.id,
                coins: guild.coins
              })
              coins += guild.coins
            }
          }

          // Checking if the user has left any j4r servers
          for (const j4r of userj4r) {
            if (!guildsinfo.find(g => g.id === j4r.id)) {
              userj4r = userj4r.filter(g => g.id !== j4r.id);
              coins -= j4r.coins;
            }
          }

          await db.set(`j4rs-${userinfo.id}`, userj4r);
          await db.set(`coins-${userinfo.id}`, coins);
        }

        if (newsettings.bot.joinguild.enabled == true) {
          if (typeof newsettings.bot.joinguild.guildid == "string") {
            await fetch(
              `https://discord.com/api/guilds/${newsettings.bot.joinguild.guildid}/members/${userinfo.id}`,
              {
                method: "PUT",
                headers: {
                  'Content-Type': 'application/json',
                  "Authorization": `Bot ${newsettings.bot.token}`
                },
                body: JSON.stringify({
                  access_token: codeinfo.access_token
                })
              }
            );
          } else if (typeof newsettings.bot.joinguild.guildid == "object" && Array.isArray(newsettings.bot.joinguild.guildid)) {
              for (let guild of newsettings.bot.joinguild.guildid) {
                await fetch(
                  `https://discord.com/api/guilds/${guild}/members/${userinfo.id}`,
                  {
                    method: "PUT",
                    headers: {
                      'Content-Type': 'application/json',
                      "Authorization": `Bot ${newsettings.bot.token}`
                    },
                    body: JSON.stringify({
                      access_token: codeinfo.access_token
                    })
                  }
                );
              }
          } else {
            return res.send("bot.joinguild.guildid is not an array not a string.");
          }
        }
	      
        // Give a discord role on login
        if (newsettings.bot.giverole.enabled == true){
          if (typeof newsettings.bot.giverole.guildid == "string" && typeof newsettings.bot.giverole.roleid == "string") {
            await fetch(
              `https://discord.com/api/guilds/${newsettings.bot.giverole.guildid}/members/${userinfo.id}/roles/${newsettings.bot.giverole.roleid}`,
              {
                method: "PUT",
                headers: {
                  'Content-Type': 'application/json',
                  "Authorization": `Bot ${newsettings.bot.token}`
                }
              }
            );
          } else {
            return res.send("bot.giverole.guildid or roleid is not a string.");
          }
        }

        // Applying role packages
        if (newsettings.packages.rolePackages.roles) {
          const memberResponse = await fetch(
            `https://discord.com/api/v9/guilds/${newsettings.packages.rolePackages.roleServer}/members/${userinfo.id}`, {
              headers: {
                "Authorization": `Bot ${newsettings.bot.token}`
              }
            });
          const memberInfo = await memberResponse.json();
        
          if (memberInfo.user) {
            const currentPackage = await db.get(`package-${userinfo.id}`);
          
            // Check if the current package is included in the role packages
            const rolePackages = newsettings.packages.rolePackages.roles;
            if (Object.values(rolePackages).includes(currentPackage)) {
              for (const rolePackage in rolePackages) {
                if (rolePackages[rolePackage] === currentPackage && !memberInfo.roles.includes(rolePackage)) {
                  await db.set(`package-${userinfo.id}`, newsettings.packages.default);
                }
              }
            }
            // Update package based on member roles
            for (const role of memberInfo.roles) {
              if (rolePackages[role]) {
                await db.set(`package-${userinfo.id}`, rolePackages[role]);
              }
            }
          }
        }

        if (!await db.get(`users-${userinfo.id}`)) {
          if (newsettings.allow.newusers !== true) 
            return res.send("New users cannot signup currently.");
          
          let genpassword = null;
          if (newsettings.passwordgenerator.signup == true) genpassword = makeid(newsettings.passwordgenerator["length"]);
          let accountjson = await fetch(
            `${settings.pterodactyl.domain}/api/application/users`,
            {
              method: "POST",
              headers: {
                'Content-Type': 'application/json',
                "Authorization": `Bearer ${settings.pterodactyl.key}`
              },
              body: JSON.stringify({
                username: userinfo.id,
                email: userinfo.email,
                first_name: userinfo.username,
                last_name: "#" + userinfo.discriminator,
                password: genpassword
              })
            }
          );
          if (await accountjson.status == 201) {
            let accountinfo = JSON.parse(await accountjson.text());
            let userids = await db.get("users") ? await db.get("users") : [];
            userids.push(accountinfo.attributes.id);
            await db.set("users", userids);
            await db.set(`users-${userinfo.id}`, accountinfo.attributes.id);
            req.session.newaccount = true;
            req.session.password = genpassword;
          } else {
            let accountListReponse = await fetch(
              `${settings.pterodactyl.domain}/api/application/users?include=servers&filter[email]=${encodeURIComponent(userinfo.email)}`,
              {
                method: "GET",
                headers: {
                  'Content-Type': 'application/json',
                  "Authorization": `Bearer ${settings.pterodactyl.key}`
                }
              }
            );
            let accountlist = await accountListReponse.json();
            let user = accountlist.data.filter(acc => acc.attributes.email == userinfo.email);
            if (user.length == 1) {
              let userid = user[0].attributes.id;
              let userids = await db.get("users") ? await db.get("users") : [];
              if (userids.filter(id => id == userid).length == 0) {
                userids.push(userid);
                await db.set("users", userids);
                await db.set(`users-${userinfo.id}`, userid);
                req.session.pterodactyl = user[0].attributes;
              } else {
                return res.send("We have detected an account with your Discord email on it but the user id has already been claimed on another Discord account.");
              }
            } else {
              return res.send("An error has occurred when attempting to create your account.");
            };
          };
          log('signup', `${userinfo.username}#${userinfo.discriminator} logged in to the dashboard for the first time!`);
        };

        let cacheAccount = await fetch(
          `${settings.pterodactyl.domain}/api/application/users/${(await db.get(`users-${userinfo.id}`))}?include=servers`,
          {
            method: "GET",
            headers: {
            'Content-Type': 'application/json',
            "Authorization": `Bearer ${settings.pterodactyl.key}` 
          }
          }
        );
        if (await cacheAccount.statusText == "Not Found") return res.send("An error has occurred while attempting to get your user information.");
        let cacheAccountInfo = JSON.parse(await cacheAccount.text());
        req.session.pterodactyl = cacheAccountInfo.attributes;

        req.session.userinfo = userinfo;
        let theme = indexjs.get(req);
        return res.redirect(customredirect || theme.settings.redirect.callback || "/");
    } else {
      res.redirect(`/login`);
    };
  });
};

function makeid(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  let result = Array.from({ length }, () => characters.charAt(Math.floor(Math.random() * charactersLength))).join('');
  return result;
}
