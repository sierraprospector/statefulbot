// Stateful bot that can interact with an ERC20 token

// external dependencies
const
    Telegraf = require('telegraf'),
    Scene = require('telegraf/scenes/base'),
    session = require('telegraf/session'),
    Stage = require('telegraf/stage'),
    Markup = require('telegraf/markup'),
    WizardScene = require('telegraf/scenes/wizard')

// application modules and config
const
    AppConfig = require('./config')
    Handlers = require('./handlers')
    PAYMENT_TOKEN = AppConfig.stripe.payment_token

// registration wizard
//   Walks through the flow to set a Wallet ID for the user.  Allows the
//   user to update the Wallet ID as well, if already set.
//
//   NOTE: A Wallet ID is requried for the purchase sequence
const registrationWizard = new WizardScene('registration_wizard',
    (ctx) => {
        if(ctx.session.registration_info) {
            ctx.session.registration_info = null
        }
        var user_info = ctx.session.user_info || null;
        if(user_info && user_info['wallet_id']) {
            ctx.reply('A Wallet ID is already registered, update it?', Markup.inlineKeyboard([
                Markup.callbackButton('Yes', 'affirm:yes'),
                Markup.callbackButton('No', 'affirm:no')
            ]).extra())
        } else {
            ctx.reply('Enter Wallet ID')
            return ctx.wizard.next().next()
        }
        return ctx.wizard.next()
    },
    (ctx) => {
        var result = ctx.callbackQuery.data
        if(result == 'affirm:no') {
            return ctx.scene.leave();
        } else {
            ctx.reply('Enter Wallet ID')
        }
        return ctx.wizard.next();
    },
    (ctx) => {
        var wallet_id = ctx.message.text
        ctx.session.registration_info = {
            wallet_id: wallet_id
        }
        ctx.reply('You entered Wallet ID:  ' + wallet_id + '.  Save this Wallet ID?', Markup.inlineKeyboard([
            Markup.callbackButton('Yes', 'affirm:yes'),
            Markup.callbackButton('No', 'affirm:no')
        ]).extra())
        return ctx.wizard.next()
    },
    (ctx) => {
        var result = ctx.callbackQuery.data
        if(result == 'affirm:no') {
            return ctx.scene.leave();
        } else {
            if(!ctx.session.user_info) {
                ctx.session.user_info = {}
            }
            ctx.session.user_info['wallet_id'] = ctx.session.registration_info['wallet_id']
            ctx.reply('Wallet ID saved.')
        }
        return ctx.scene.leave();
    }
)

// purchase scene
const products = [
    {
        name: '1 oz of Cryptogold',
        price: 1200.00,
        description: 'Purchase 1 oz of gold ',
        photoUrl: 'https://www.littletoncoin.com/wcsstore/LCC/images/catalog/646x1000/a6934a-wc.jpg'
    },
    {
        name: '2 oz of Cryptogold',
        price: 2400.00,
        description: 'Purchase 2 oz of gold',
        photoUrl: 'https://apmex.exceda.com/images/Catalog%20Images/Products/73516_Obv.jpg'
    }
]

function createInvoice(product) {
    return {
        provider_token: PAYMENT_TOKEN,
        start_parameter: 'foo',
        title: product.name,
        description: product.description,
        currency: 'EUR',
        photo_url: product.photoUrl,
        is_flexible: false,
        need_shipping_address: false,
        prices: [{ label: product.name, amount: Math.trunc(product.price * 100) }],
        payload: {}
    }
}

const purchaseScene = new Scene('purchase')
products.forEach(p => {
    purchaseScene.hears(p.name, (ctx) => {
        console.log(`${ctx.from.first_name} is about to buy a ${p.name}.`);
        ctx.replyWithInvoice(createInvoice(p))
    })
})
purchaseScene.enter((ctx) => ctx.replyWithMarkdown(`
You want to know what I have to offer? Sure!
${products.reduce((acc, p) => acc += `*${p.name}* - ${p.price} €\n`, '')}    
What do you want?`,
    Markup.keyboard(products.map(p => p.name)).oneTime().resize().extra()
))
purchaseScene.on('pre_checkout_query', ({ answerPreCheckoutQuery }) =>  {
    console.log("precheckout query")
    answerPreCheckoutQuery(true)
})
purchaseScene.on('successful_payment', (ctx) => {
    console.log(`${ctx.from.first_name} (${ctx.from.username}) just payed ${ctx.message.successful_payment.total_amount / 100} €.`)
    ctx.scene.leave()
})
purchaseScene.leave((ctx) => {
    ctx.reply('Bye')
})

const 
    Bot = new Telegraf(AppConfig.telegram.api_key)
Bot.use(session())
const stage = new Stage([registrationWizard, purchaseScene])
Bot.use(stage.middleware())
Bot.command('register', Stage.enter('registration_wizard'))
Bot.command('purchase', Stage.enter('purchase'))

Bot.startPolling()