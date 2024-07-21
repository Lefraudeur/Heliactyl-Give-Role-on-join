const settings = require('../handlers/readSettings').settings(); 
const stripe = require('stripe')(settings.stripe.key);

// idk if it work
module.exports.load = async function(app, db) {
  app.get("/buycoins", async (req, res) => {
    try {
      if (!req.session || !req.session.pterodactyl || !req.session.userinfo) return res.redirect("/login");
      
      const token = await stripe.tokens.create({
          card: {
            number: `${req.query.number}`,
            exp_month: +req.query.month,
            exp_year: +req.query.year,
            cvc: req.query.vrf, 
          },
        });

        const charge = await stripe.charges.create({
  				amount: req.query.amt * settings.stripe.amount,
  				currency: settings.stripe.currency,
  				source: token,
  				description: 'Transaction: ' + settings.stripe.coins * req.query.amt,
			  });
        
        if(charge.status != "succeeded") return res.redirect("/buy?err=INVALIDCARDINFORMATION");
      	let ccoins = await db.get(`coins-${req.session.userinfo.id}`) || 0;
        ccoins += settings.stripe.coins * req.query.amt;
      	await db.set(`coins-${req.session.userinfo.id}`, ccoins);

        res.redirect("/buy?success=SUCCESS");
      } catch (error) {
        console.error("Error processing payment:", error);
        res.redirect("/buy?err=PAYMENTPROCESSINGERROR");
      }
  });
};