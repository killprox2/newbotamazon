require('dotenv').config(); // Charger les variables d'environnement

const axios = require('axios');
const cheerio = require('cheerio');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const winston = require('winston');

// Configurer les logs avec Winston
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

// Initialiser le client Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

// Associer les catégories à l'ID des salons Discord
const categoryChannels = {
    "entretien": "ID_SALON_ENTRETIEN",
    "electronique": "ID_SALON_ELECTRONIQUE",
    "smartphone": "ID_SALON_SMARTPHONE",
    "electromenager": "ID_SALON_ELECTROMENAGER",
    "enfant": "ID_SALON_ENFANT",
    "jouet": "ID_SALON_JOUET",
    "hygiene": "ID_SALON_HYGIENE",
    "bebe": "ID_SALON_BEBE",
    "bricolage": "ID_SALON_BRICOLAGE",
    "jardin": "ID_SALON_JARDIN",
    "logs": "1285977835365994506" // ID du salon pour les logs
};

// Fonction pour envoyer des logs dans le salon de logs
async function sendLogToChannel(logMessage) {
    const logChannel = client.channels.cache.get(categoryChannels.logs);
    if (logChannel) {
        logChannel.send(logMessage);
    } else {
        console.error('Le salon "logs" n\'a pas été trouvé.');
    }
}

// Fonction pour faire une requête avec ScraperAPI
async function scrapeWithScraperAPI(url) {
    const apiKey = process.env.SCRAPER_API_KEY;
    if (!apiKey) {
        throw new Error('La clé ScraperAPI n\'est pas définie dans les variables d\'environnement');
    }

    const fullUrl = `http://api.scraperapi.com/?api_key=${apiKey}&url=${encodeURIComponent(url)}`;

    try {
        const response = await axios.get(fullUrl);
        if (response.data.error) {
            throw new Error(`Erreur ScraperAPI: ${response.data.error}`);
        }
        return response.data;
    } catch (error) {
        if (error.response) {
            logger.error(`Erreur lors de la requête ScraperAPI (Statut ${error.response.status}) : ${error.response.data}`);
            sendLogToChannel(`⚠️ Erreur lors de la requête ScraperAPI (Statut ${error.response.status}) : ${error.response.data}`);
        } else if (error.request) {
            logger.error('Aucune réponse reçue de ScraperAPI.');
            sendLogToChannel('⚠️ Aucune réponse reçue de ScraperAPI.');
        } else {
            logger.error(`Erreur lors de la configuration de la requête : ${error.message}`);
            sendLogToChannel(`⚠️ Erreur lors de la configuration de la requête : ${error.message}`);
        }
        throw error;
    }
}

// Scraping avec Cheerio et ScraperAPI
async function scrapeAmazon(category, channelID) {
    logger.info(`Scraping démarré pour la catégorie ${category}.`);
    sendLogToChannel(`📄 Scraping démarré pour la catégorie **${category}**.`);

    for (let i = 1; i <= 50; i++) {
        const url = `https://www.amazon.fr/s?k=${category}&page=${i}`;
        logger.info(`Accès à la page ${i} pour la catégorie ${category} : ${url}`);
        sendLogToChannel(`🔍 Accès à la page **${i}** pour la catégorie **${category}** : [Lien](${url})`);

        try {
            // Utilisation de ScraperAPI avec Axios
            const data = await scrapeWithScraperAPI(url);

            const $ = cheerio.load(data);
            let products = [];

            $('.s-main-slot .s-result-item').each((index, element) => {
                const title = $(element).find('h2 a span').text();
                const link = $(element).find('h2 a').attr('href');
                const priceOld = $(element).find('.a-price.a-text-price span').text();
                const priceNew = $(element).find('.a-price .a-offscreen').text();

                if (title && link && priceOld && priceNew) {
                    const oldPrice = parseFloat(priceOld.replace(/[^\d,.-]/g, '').replace(',', '.'));
                    const newPrice = parseFloat(priceNew.replace(/[^\d,.-]/g, '').replace(',', '.'));
                    const discount = ((oldPrice - newPrice) / oldPrice) * 100;

                    if (discount >= 50) { // Modifié à 50% de réduction minimum
                        products.push({
                            title: title,
                            link: `https://www.amazon.fr${link}`,
                            oldPrice: oldPrice,
                            newPrice: newPrice,
                            discount: discount.toFixed(2)
                        });
                    }
                }
            });

            if (products.length > 0) {
                const embed = new EmbedBuilder()
                    .setTitle(`Produits avec réduction dans la catégorie ${category}`)
                    .setColor('#ff9900')
                    .setDescription(products.map(p => `**${p.title}**\nAncien prix: ${p.oldPrice}€, Nouveau prix: ${p.newPrice}€, Réduction: ${p.discount}%\n[Lien](${p.link})`).join('\n\n'));

                const discordChannel = client.channels.cache.get(channelID);
                if (discordChannel) {
                    discordChannel.send({ embeds: [embed] });
                    logger.info(`Produits envoyés dans le salon ${category}.`);
                    sendLogToChannel(`✅ **${products.length} produits trouvés** dans la catégorie **${category}** ont été ajoutés au salon.`);
                }
            } else {
                sendLogToChannel(`❌ Aucun produit trouvé sur la page **${i}** de la catégorie **${category}**.`);
            }

        } catch (error) {
            if (error.response) {
                logger.error(`Erreur lors de l'accès à la page ${i} pour la catégorie ${category}: Statut ${error.response.status} - ${error.response.data}`);
                sendLogToChannel(`⚠️ Erreur lors de l'accès à la page **${i}** pour la catégorie **${category}**: Statut ${error.response.status} - ${error.response.data}`);
            } else if (error.request) {
                logger.error(`Aucune réponse reçue de ScraperAPI pour la page ${i} de la catégorie ${category}`);
                sendLogToChannel(`⚠️ Aucune réponse reçue de ScraperAPI pour la page **${i}** de la catégorie **${category}**.`);
            } else {
                logger.error(`Erreur lors de la requête pour la page ${i} de la catégorie ${category}: ${error.message}`);
                sendLogToChannel(`⚠️ Erreur lors de la requête pour la page **${i}** de la catégorie **${category}**: ${error.message}`);
            }
            continue; // Passe à la page suivante en cas d'erreur
        }

        // Délai pour éviter une surcharge
        await new Promise(resolve => setTimeout(resolve, 60000)); // Augmente le délai à 60 secondes entre chaque requête
    }
}

// Démarrage du scraping
async function startScraping() {
    for (const [category, channelID] of Object.entries(categoryChannels)) {
        if (category !== "logs") {
            logger.info(`Démarrage du scraping pour la catégorie ${category}.`);
            sendLogToChannel(`Démarrage du scraping pour la catégorie **${category}**.`);
            await scrapeAmazon(category, channelID);
        }
    }
}

client.once('ready', () => {
    logger.info('Bot is ready!');
    sendLogToChannel('⚙️ Le bot a démarré et est prêt à scraper.');
    startScraping(); // Lancer le scraping dès que le bot est prêt
});

client.login(process.env.TOKEN);
