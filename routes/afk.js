let currentlyonpage = {};

module.exports.load = async function(app, db) {

  app.ws("/afk/ws", async (ws, req, res) => {

    if (!req.session.pterodactyl || !req.session) return res.redirect("/login");

    const newsettings = require('../handlers/readSettings').settings(); 

    if (newsettings["afk page"].enabled !== true || !req.session || !req.session.userinfo)
      return ws.close();

    if (currentlyonpage[req.session.userinfo.id])
      return ws.close();

    currentlyonpage[req.session.userinfo.id] = true;

    let coinloop = setInterval(
      async function() {
        let usercoins = await db.get(`coins-${req.session.userinfo.id}`);
        usercoins = usercoins ? usercoins : 0;
        usercoins = usercoins + newsettings["afk page"].coins;
        if (usercoins > 999999999999999) 
          return ws.close();
        await db.set(`coins-${req.session.userinfo.id}`, usercoins);  

        if (ws.readyState === ws.OPEN)
          ws.send(JSON.stringify({"type":"coin"}));
        
      }, newsettings["afk page"].every * 1000
    );

    ws.on('close', async () => {
      clearInterval(coinloop);
      delete currentlyonpage[req.session.userinfo.id];
    }); 
  });
};