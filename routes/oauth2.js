"use strict";

const settings = require('../handlers/readSettings').settings();
const log = require('../handlers/log');
const vpnCheck = require("../handlers/vpnCheck");
const getTemplate = require('../handlers/getTemplate.js').template;
const fetch = require('node-fetch');
const getPteroUser = require('../handlers/getPteroUser.js');

module.exports.load = async (app, db) => {  

  app.get("/login", async (req, res) => {
    if (req.query.redirect) req.session.redirect = `/${req.query.redirect}`;

    res.redirect(
      `https://discord.com/api/oauth2/authorize?client_id=${settings.oauth2.id}&redirect_uri=${encodeURIComponent(settings.oauth2.link + settings.oauth2.callbackpath)}&response_type=code&scope=identify%20email${
        settings.bot.joinguild.enabled ? "%20guilds.join" : ""
      }${
        settings.j4r.enabled ? "%20guilds" : ""
      }${
        settings.oauth2.prompt === false ? "&prompt=none" : (req.query.prompt === "none" ? "&prompt=none" : "")
      }`
    );
  });

  app.get("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/"));
  });

  app.get(settings.oauth2.callbackpath, async (req, res) => {
    if (!req.query.code) return res.redirect("/login");

    const code = encodeURIComponent(req.query.code.replace(/'/g, ''));
    res.send(getTemplate("Please wait...", "Logging in... Please wait, you'll be redirected soon") + `
      <script type="text/javascript" defer>
        history.pushState('/login', 'Logging in...', '/login');
        window.location.replace('/submitlogin?code=${code}');
      </script>
    `);
  });

  app.get("/submitlogin", async (req, res) => {
    if (!req.query.code) return res.send("Missing code.");
    delete req.session.redirect;

    const newsettings = require('../handlers/readSettings').settings();
    let ip = (newsettings.oauth2.ip["trust x-forwarded-for"] ? (req.headers['x-forwarded-for'] || req.connection.remoteAddress) : req.connection.remoteAddress) || "::1";
    ip = ip.replace(/::1/g, "::ffff:127.0.0.1").replace(/^.*:/, '');

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

    let tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: "POST",
      body: body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (!tokenResponse.ok) return res.redirect("/login");

    let codeinfo = await tokenResponse.json();
    let scopes = codeinfo.scope;
    let missingScopes = [];

    if (!scopes.includes("identify")) missingScopes.push("identify");
    if (!scopes.includes("email")) missingScopes.push("email");
    if (newsettings.bot.joinguild.enabled && !scopes.includes("guilds.join")) missingScopes.push("guilds.join");
    if (newsettings.j4r.enabled && !scopes.includes("guilds")) missingScopes.push("guilds");

    if (missingScopes.length) return res.send("Missing scopes: " + missingScopes.join(", "));

    let userinfoResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { "Authorization": `Bearer ${codeinfo.access_token}` }
    });

    if (!userinfoResponse.ok) return res.send("Failed to fetch user info.");    

    let userinfo = await userinfoResponse.json();

    if (!userinfo.verified) return res.send("Not verified a Discord account. Please verify the email on your Discord account.");

    // Check if whitelist is enabled and if the user is whitelisted

    if (settings.oauth2.whitelist.status && !settings.oauth2.whitelist.users.includes(userinfo.id)) 
      return res.send(getTemplate("Whitelisted", "You are not whitelisted. Please contact the administrator for more information.", true));

    // Check if blacklist is enabled and if the user is blacklisted

    if (settings.oauth2.blacklist.status && settings.oauth2.blacklist.users.includes(userinfo.id)) 
      return res.send(getTemplate("Blacklisted", "You are blacklisted. Please contact the administrator for more information.", true));

    // Check if the user is "blacklisted" ip

    if (newsettings.oauth2.ip.block.includes(ip)) 
      return res.send(getTemplate("IP Blacklisted", "You could not sign in, because your IP has been blocked from signing in.", true));
    
    // Duplicate account check based on IP

    if (newsettings.oauth2.ip["duplicate check"] && ip !== '127.0.0.1') {
      const ipuser = await db.get(`ipuser-${ip}`);
      if (ipuser && ipuser !== userinfo.id) {
        return res.status(200).send(getTemplate("Alt Account Detected", `${newsettings.name} detected that you have multiple accounts with us. We do not allow the use of multiple accounts on our services.`, true));
      } else if (!ipuser) {
        await db.set(`ipuser-${ip}`, userinfo.id);
      }
    }

    // J4R system integration

    if (newsettings.j4r.enabled) {
      let guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
        headers: { "Authorization": `Bearer ${codeinfo.access_token}` }
      });

      if (!guildsResponse.ok) return res.send(getTemplate("J4R system", "Please allow us to know what servers you are in to let the J4R system work properly.", true));

      let guildsinfo = await guildsResponse.json();
      let userj4r = await db.get(`j4rs-${userinfo.id}`) || [];
      let coins = await db.get(`coins-${userinfo.id}`) || 0;

      // Update J4R statuses

      newsettings.j4r.ads.forEach(guild => {
        if (guildsinfo.find(g => g.id === guild.id) && !userj4r.find(g => g.id === guild.id)) {
          userj4r.push({ id: guild.id, coins: guild.coins });
          coins += guild.coins;
        }
      });

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

    // Join specified guilds

    if (newsettings.bot.joinguild.enabled) {
      const guildids = Array.isArray(newsettings.bot.joinguild.guildid) ? newsettings.bot.joinguild.guildid : [newsettings.bot.joinguild.guildid];
      for (let guild of guildids) {
        await fetch(`https://discord.com/api/guilds/${guild}/members/${userinfo.id}`, {
          method: "PUT",
          headers: {
            'Content-Type': 'application/json',
            "Authorization": `Bot ${newsettings.bot.token}`
          },
          body: JSON.stringify({ access_token: codeinfo.access_token })
        });
      }
    }

    // Give a discord role on login

    if (newsettings.bot.giverole.enabled) {
      if (typeof newsettings.bot.giverole.guildid === "string" && typeof newsettings.bot.giverole.roleid === "string") {
        await fetch(`https://discord.com/api/guilds/${newsettings.bot.giverole.guildid}/members/${userinfo.id}/roles/${newsettings.bot.giverole.roleid}`, {
          method: "PUT",
          headers: {
            'Content-Type': 'application/json',
            "Authorization": `Bot ${newsettings.bot.token}`
          }
        });
      } else {
        return res.send("bot.giverole.guildid or roleid is not a string.");
      }
    }

    // Apply role packages

    if (newsettings.packages.rolePackages.roles) {
      let memberResponse = await fetch(`https://discord.com/api/v9/guilds/${newsettings.packages.rolePackages.roleServer}/members/${userinfo.id}`, {
        headers: { "Authorization": `Bot ${newsettings.bot.token}` }
      });

      if (memberResponse.ok) {
        let memberInfo = await memberResponse.json();
        let currentPackage = await db.get(`package-${userinfo.id}`);
        let rolePackages = newsettings.packages.rolePackages.roles;

        // Check if the current package is included in the role packages
        
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

    // Create Pterodactyl account if not exists

    if (!await db.get(`users-${userinfo.id}`)) {
      if (!newsettings.allow.newusers) return res.send("New users cannot signup currently.");
      
      let genpassword = null;
      if (newsettings.passwordgenerator.signup) genpassword = makeid(newsettings.passwordgenerator.length);
      let accountResponse = await fetch(`${settings.pterodactyl.domain}/api/application/users`, {
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
      });

      if (accountResponse.status === 201) {
        let accountinfo = await accountResponse.json();
        let userids = await db.get("users") || [];
        userids.push(accountinfo.attributes.id);

        await db.set("users", userids);
        await db.set(`users-${userinfo.id}`, accountinfo.attributes.id);

        req.session.newaccount = true;
        req.session.password = genpassword;
      } else {
        let accountListResponse = await fetch(`${settings.pterodactyl.domain}/api/application/users?include=servers&filter[email]=${encodeURIComponent(userinfo.email)}`, {
          method: "GET",
          headers: {
            'Content-Type': 'application/json',
            "Authorization": `Bearer ${settings.pterodactyl.key}`
          }
        });

        if (!accountListResponse.ok) return res.send("An error has occurred when attempting to create your account.");
        
        let accountlist = await accountListResponse.json();
        let user = accountlist.data.find(acc => acc.attributes.email === userinfo.email);

        if (user) {
          let userid = user.attributes.id;
          let userids = await db.get("users") || [];
          if (!userids.includes(userid)) {
            userids.push(userid);
            await db.set("users", userids);
            await db.set(`users-${userinfo.id}`, userid);
            req.session.pterodactyl = user.attributes;
          } else {
            return res.send("We have detected an account with your Discord email on it but the user id has already been claimed on another Discord account.");
          }
        } else {
          return res.send("An error has occurred when attempting to create your account.");
        }
      }
      log('signup', `${userinfo.username}#${userinfo.discriminator} logged in to the dashboard for the first time!`);
    }

    const cacheAccount = await getPteroUser(userinfo.id, db);
    if (!cacheAccount) return;

    req.session.pterodactyl = cacheAccount.attributes;
    req.session.userinfo = userinfo;
    return res.redirect("/dashboard");
  });
};

function makeid(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  let result = Array.from({ length }, () => characters.charAt(Math.floor(Math.random() * charactersLength))).join('');
  return result;
}