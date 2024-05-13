const settings = require('../handlers/readSettings').settings(); 
const stripe = require('stripe')(settings.stripe.key);

module.exports.load = async function(app, db) {
  app.get("/buycoins", async(req, res) => {
    if (!req.session.pterodactyl) return res.redirect("/login");
      
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
  				currency: 'eur',
  				source: token,
  				description: 'Transaction: ' + settings.stripe.coins * req.query.amt,
			  });
        
          if(charge.status != "succeeded") return res.redirect("/buy?error=INVALIDCARDINFORMATION.");
      		let ccoins = await db.get(`coins-${req.session.userinfo.id}`)
            ccoins += settings.stripe.coins * req.query.amt;
      		await db.set(`coins-${req.session.userinfo.id}`, ccoins)
  });
};
