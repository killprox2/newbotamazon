require('dotenv').config();
const { Client, Intents, MessageEmbed } = require('discord.js');
const puppeteer = require('puppeteer');
const winston = require('winston');

// Initialiser le client Discord
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

const categories = {
    "entretien": "Entretien",
    "electronique": "Electronique",
    "smartphone": "Smartphone",
    "electromenager": "Electroménager",
    "enfant": "Enfant",
    "jouet": "Jouet",
    "hygiene": "Hygiène",
    "bebe": "Bébé",
    "bricolage": "Bricolage",
    "jardin": "Jardin"
};

// Configurer winston pour les logs
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level.toUpperCase()}] - ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'bot_logs.log' })
    ]
});

// Fonction pour envoyer des logs dans le salon "logs"
async function sendLogToChannel(logMessage) {
    const logChannel = client.channels.cache.find(channel => channel.name === 'logs');
    if (logChannel) {
        logChannel.send(logMessage);
    } else {
        console.error('Le salon "logs" n\'a pas été trouvé.');
    }
}

client.once('ready', () => {
    logger.info('Bot is ready!');
    sendLogToChannel('Le bot a démarré et est prêt à scraper.');
    startScraping(); // Lancer le scraping dès que le bot est prêt
});

async function scrapeAmazon(category, channel) {
    logger.info(`Scraping démarré pour la catégorie ${category}.`);
    sendLogToChannel(`Scraping démarré pour la catégorie **${category}**.`);

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    let products = [];

    for (let i = 1; i <= 50; i++) {
        const url = `https://www.amazon.fr/s?k=${category}&page=${i}`;
        logger.info(`Accès à la page ${i} pour la catégorie ${category} : ${url}`);
        sendLogToChannel(`Accès à la page ${i} pour la catégorie **${category}** : ${url}`);
        
        await page.goto(url, { waitUntil: 'networkidle2' });
        
        const itemsOnPage = await page.evaluate(() => {
            let items = [];
            let productElements = document.querySelectorAll('.s-main-slot .s-result-item');

            productElements.forEach(product => {
                const title = product.querySelector('h2 a span')?.innerText;
                const link = product.querySelector('h2 a')?.href;
                const priceOld = product.querySelector('.a-price.a-text-price span')?.innerText;
                const priceNew = product.querySelector('.a-price .a-offscreen')?.innerText;

                if (title && link && priceOld && priceNew) {
                    let oldPrice = parseFloat(priceOld.replace(/[^\d,.-]/g, '').replace(',', '.'));
                    let newPrice = parseFloat(priceNew.replace(/[^\d,.-]/g, '').replace(',', '.'));
                    let discount = ((oldPrice - newPrice) / oldPrice) * 100;
                    
                    if (discount >= 40) {
                        items.push({
                            title: title,
                            link: link,
                            oldPrice: oldPrice,
                            newPrice: newPrice,
                            discount: discount.toFixed(2)
                        });
                    }
                }
            });
            return items;
        });

        logger.info(`Page ${i} de la catégorie ${category} traitée. ${itemsOnPage.length} produits trouvés avec réduction.`);
        sendLogToChannel(`Page ${i} de la catégorie **${category}** traitée. **${itemsOnPage.length}** produits trouvés avec réduction.`);
        
        products = products.concat(itemsOnPage);
        
        // Délai aléatoire pour éviter la détection du bot
        await new Promise(resolve => setTimeout(resolve, Math.random() * 5000 + 3000));
    }

    await browser.close();

    if (products.length > 0) {
        const embed = new MessageEmbed()
            .setTitle(`Produits avec réduction dans la catégorie ${categories[channel]}`)
            .setColor('#ff9900')
            .setDescription(products.map(p => `**${p.title}**\nAncien prix: ${p.oldPrice}€, Nouveau prix: ${p.newPrice}€, Réduction: ${p.discount}%\n[Lien](${p.link})`).join('\n\n'));

        const discordChannel = client.channels.cache.find(ch => ch.name === channel);
        if (discordChannel) {
            discordChannel.send({ embeds: [embed] });
            logger.info(`Produits envoyés dans le salon ${channel}.`);
            sendLogToChannel(`Produits envoyés dans le salon **${channel}**.`);
        } else {
            logger.warn(`Le salon ${channel} n'a pas été trouvé.`);
            sendLogToChannel(`Le salon **${channel}** n'a pas été trouvé.`);
        }
    } else {
        logger.warn(`Aucun produit avec réduction trouvé pour la catégorie ${category}.`);
        sendLogToChannel(`Aucun produit avec réduction trouvé pour la catégorie **${category}**.`);
    }
}

async function startScraping() {
    for (const [channel, category] of Object.entries(categories)) {
        logger.info(`Démarrage du scraping pour la catégorie ${category}.`);
        sendLogToChannel(`Démarrage du scraping pour la catégorie **${category}**.`);
        await scrapeAmazon(category, channel);
    }
}

client.login(process.env.TOKEN);
