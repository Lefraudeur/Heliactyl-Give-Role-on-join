const newsettings = require('../handlers/readSettings').settings();
let currentlyonpage = {};

module.exports.load = function(app, db) {
  app.ws("/afk/ws", async (ws, req) => {
    if (!newsettings["afk page"].enabled || !req.session || !req.session.userinfo || !req.session.pterodactyl) return ws.close();

    let userId = req.session.userinfo.id;

    if (currentlyonpage[userId]) return ws.close();

    currentlyonpage[userId] = true;

    let coinLoop = setInterval(async () => {
      try {
        let userCoins = await db.get(`coins-${userId}`) || 0;
        userCoins += newsettings["afk page"].coins;

        if (userCoins > 999999999999999) {
          ws.close();
        } else {
          await db.set(`coins-${userId}`, userCoins);
        }

        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: "coin", coins: userCoins }));

      } catch (error) {
        console.error('Error updating coins:', error);
      }
    }, newsettings["afk page"].every * 1000);

    ws.on('close', () => {
      clearInterval(coinLoop);
      delete currentlyonpage[userId];
    });
  });
};