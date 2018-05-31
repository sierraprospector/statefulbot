module.exports = {
  telegram: {
    api_key: process.env.TELEGRAM_API_KEY
  },
  stripe: {
    payment_token: process.env.STRIPE_PAYMENT_TOKEN
  },
  stateful: {
    local_db: "data/bot_session.json"
  }
};

