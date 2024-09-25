const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
});

client.login(process.env.TOKEN);

// Rôles et salons
const channels = {
    amazon: '1255863140974071893',
    logs: '1285977835365994506', // ID du salon où les logs seront envoyés
};

// Fonction pour envoyer des messages dans le salon de logs
function sendLogMessage(content) {
    const logChannel = client.channels.cache.get(channels.logs);
    if (logChannel) {
        logChannel.send(content);
    } else {
        console.log('Salon de logs introuvable.');
    }
}

// Logs au démarrage du bot
client.once('ready', async () => {
    console.log('Bot is online!');
    sendLogMessage('✅ Bot démarré et prêt à l\'emploi.');

    // Lancer la recherche des deals immédiatement au démarrage
    sendLogMessage('🔄 Lancement immédiat de la recherche de deals Amazon...');
    await checkAmazonDeals();
});

// Fonction pour envoyer un produit en embed dans un salon Discord
async function sendProductEmbed(productData, channelID) {
    const embed = new EmbedBuilder()
        .setTitle(productData.name)
        .setURL(productData.url)
        .setImage(productData.image)
        .addFields(
            { name: 'Prix', value: `${productData.price_string}`, inline: true },
            { name: 'Prix d\'origine', value: productData.original_price ? `${productData.original_price.price_string}` : 'N/A', inline: true },
            { name: 'Évaluations', value: `${productData.total_reviews} avis`, inline: true },
            { name: 'Note', value: `${productData.stars} ⭐`, inline: true },
            { name: 'Prime', value: productData.has_prime ? 'Oui' : 'Non', inline: true },
            { name: 'Amazon Choice', value: productData.is_amazon_choice ? 'Oui' : 'Non', inline: true }
        )
        .setFooter({ text: 'Produit Amazon' });

    const discordChannel = client.channels.cache.get(channelID);
    if (discordChannel) {
        await discordChannel.send({ embeds: [embed] });
        sendLogMessage(`📌 Produit ajouté : ${productData.name} - ${productData.price_string}`);
    } else {
        console.log('Salon Discord introuvable.');
    }
}

// Scraping avec ScraperAPI
async function fetchDealsFromScraperAPI(searchQuery, channelID) {
    try {
        sendLogMessage('🔎 Recherche de produits Amazon avec ScraperAPI...');

        const response = await axios.get('https://api.scraperapi.com/structured/amazon/search', {
            params: {
                api_key: process.env.SCRAPER_API_KEY, // Remplace par ta clé ScraperAPI
                query: searchQuery
            }
        });

        const products = response.data.results; // Extraction des résultats de ScraperAPI

        if (products && products.length > 0) {
            sendLogMessage(`📦 ${products.length} produits trouvés sur Amazon.`);
            products.forEach(product => {
                sendProductEmbed(product, channelID);
            });
        } else {
            sendLogMessage('❌ Aucun produit trouvé sur Amazon.');
        }
    } catch (error) {
        console.error('Erreur lors de la récupération des produits sur Amazon:', error);
        sendLogMessage('⚠️ Erreur lors de la recherche des produits sur Amazon.');
    }
}

// Fonction de scraping Amazon via ScraperAPI
async function checkAmazonDeals() {
    await fetchDealsFromScraperAPI('boxing gloves', channels.amazon); // Remplace 'boxing gloves' par ton critère de recherche
}

// Planification des recherches (exécute toutes les heures)
setInterval(() => {
    sendLogMessage('🔄 Lancement de la recherche de deals Amazon...');
    checkAmazonDeals();
}, 3600000); // Toutes les heures

