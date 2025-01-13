const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

const userPointsFile = path.resolve(__dirname, 'json', 'userPoints.json');
const userHistoryFile = path.resolve(__dirname, 'json', 'purchaseHistory.json');
let userPoints = {};
let userHistory = {};

const loadUserPoints = async () => {
  try {
    await fs.access(userPointsFile);
    const data = await fs.readFile(userPointsFile, 'utf-8');
    userPoints = JSON.parse(data);
  } catch {
    userPoints = {};
    await saveUserPoints();
  }
};

const loadUserHistory = async () => {
  try {
    await fs.access(userHistoryFile);
    const data = await fs.readFile(userHistoryFile, 'utf-8');
    userHistory = JSON.parse(data);
  } catch {
    userHistory = {};
    await saveUserHistory();
  }
};

const saveUserPoints = async () => {
  try {
    await fs.writeFile(userPointsFile, JSON.stringify(userPoints, null, 2));
  } catch (error) {
    console.error('Erro ao salvar os pontos dos usuários:', error);
  }
};

const saveUserHistory = async () => {
  try {
    await fs.writeFile(userHistoryFile, JSON.stringify(userHistory, null, 2));
  } catch (error) {
    console.error('Erro ao salvar o histórico de compras:', error);
  }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('historico')
    .setDescription('Mostra o histórico de compras do usuário.')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Escolha o usuário para ver o histórico')
        .setRequired(false)),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('usuario') || interaction.user;

    await loadUserPoints();
    await loadUserHistory();

    const userPurchases = userHistory[targetUser.id] || [];

    if (userPurchases.length === 0) {
      return interaction.reply({
        content: `${targetUser.username} ainda não fez nenhuma compra.`,
        ephemeral: true,
      });
    }

    const purchasesPerPage = 5;
    let currentPage = 0;

    const getPaginatedHistory = (page) => {
      const start = page * purchasesPerPage;
      const end = start + purchasesPerPage;
      return userPurchases.slice(start, end);
    };

    const generateHistoryEmbed = (page) => {
      const purchases = getPaginatedHistory(page);

      const historyEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(`🎄 Histórico de Compras de ${targetUser.username} 🎄`)
        .setDescription('Aqui está o histórico de compras: 🎁')
        .setThumbnail('https://link-para-imagem-natalina.com')
        .setTimestamp()
        .setFooter({
          text: 'Feliz Natal! 🎅',
          iconURL: 'https://link-para-imagem-do-papai-noel.com',
        });

      purchases.forEach((purchase, index) => {
        historyEmbed.addFields({
          name: `🎁 Compra #${page * purchasesPerPage + index + 1}`,
          value: `**Produto:** ${purchase.product}\n**Data:** ${purchase.date}\n**Preço:** ${purchase.price} pontos`,
        });
      });

      return historyEmbed;
    };

    const generateNavigationButtons = (page) => {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('prev')
          .setLabel('⬅️ Anterior')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId('next')
          .setLabel('➡️ Próximo')
          .setStyle(ButtonStyle.Primary)
          .setDisabled((page + 1) * purchasesPerPage >= userPurchases.length)
      );

      return row;
    };

    const historyEmbed = generateHistoryEmbed(currentPage);
    const navigationButtons = generateNavigationButtons(currentPage);

    const message = await interaction.reply({
      embeds: [historyEmbed],
      components: [navigationButtons],
      ephemeral: true,
    });

    const collector = message.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 60000,
    });

    collector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.customId === 'prev') currentPage--;
      else if (buttonInteraction.customId === 'next') currentPage++;

      const updatedEmbed = generateHistoryEmbed(currentPage);
      const updatedButtons = generateNavigationButtons(currentPage);

      await buttonInteraction.update({
        embeds: [updatedEmbed],
        components: [updatedButtons],
      });
    });

    collector.on('end', async () => {
      await message.edit({
        components: [],
      });
    });
  },
};
