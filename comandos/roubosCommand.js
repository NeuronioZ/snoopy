const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

const roubarDataPath = path.resolve(__dirname, 'json', 'roubar.json');
let roubarData = [];

const loadRoubarData = async () => {
  try {
    if (await fileExists(roubarDataPath)) {
      const data = await fs.readFile(roubarDataPath, 'utf-8');
      roubarData = data ? JSON.parse(data) : [];
      if (!Array.isArray(roubarData)) roubarData = [];
    }
  } catch (error) {
    console.error('Erro ao carregar os dados de roubo:', error);
    roubarData = [];
  }
};

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const createEmbedPage = (data, page, itemsPerPage) => {
  const embed = new EmbedBuilder()
    .setColor('#FFFFFF')
    .setTitle('Histórico de Roubos 💰')
    .setDescription('<:SnooCredits:1324588312945496104> ┃ Aqui estão os roubos registrados:')
    .setFooter({ text: `Página ${page + 1}` })
    .setTimestamp();

  const start = page * itemsPerPage;
  const end = start + itemsPerPage;

  data.slice(start, end).forEach((entry) => {
    embed.addFields({
      name: `Roubado por: ${entry.robberTag}`,
      value: `• **Alvo:** ${entry.targetTag}\n• **Pontos:** ${entry.points}\n• **Status:** ${entry.success ? 'Sucesso' : 'Falha'}\n• **Quando:** ${new Date(entry.timestamp).toLocaleString()}`,
    });
  });

  return embed;
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roubos')
    .setDescription('Veja os registros de roubos no servidor!'),

  async execute(interaction) {
    const userId = interaction.user.id;
    await loadRoubarData();

    if (!roubarData || roubarData.length === 0) {
      return interaction.reply({
        content: 'Nenhum roubo registrado até agora!',
        ephemeral: true,
      });
    }

    const userRoubarData = roubarData.filter((entry) => entry.target === userId);

    if (userRoubarData.length === 0) {
      return interaction.reply({
        content: 'Você não tem registros de roubo!',
        ephemeral: true,
      });
    }

    const sortedData = userRoubarData.sort((a, b) => b.timestamp - a.timestamp);
    const itemsPerPage = 5;
    let currentPage = 0;

    const enrichedData = await Promise.all(
      sortedData.map(async (entry) => ({
        ...entry,
        robberTag: await interaction.client.users.fetch(entry.robber).then((user) => user.tag),
        targetTag: await interaction.client.users.fetch(entry.target).then((user) => user.tag),
      }))
    );

    const embed = createEmbedPage(enrichedData, currentPage, itemsPerPage);

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('prev_page')
        .setLabel('⬅️ Anterior')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('next_page')
        .setLabel('Próximo ➡️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(enrichedData.length <= itemsPerPage)
    );

    const message = await interaction.reply({
      embeds: [embed],
      components: [buttons],
      fetchReply: true,
    });

    const collector = message.createMessageComponentCollector({
      filter: (btn) => btn.user.id === interaction.user.id,
      time: 60000,
    });

    collector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.customId === 'prev_page') {
        currentPage--;
      } else if (buttonInteraction.customId === 'next_page') {
        currentPage++;
      }

      buttons.components[0].setDisabled(currentPage === 0);
      buttons.components[1].setDisabled(currentPage >= Math.ceil(enrichedData.length / itemsPerPage) - 1);

      const newEmbed = createEmbedPage(enrichedData, currentPage, itemsPerPage);
      await buttonInteraction.update({ embeds: [newEmbed], components: [buttons] });
    });

    collector.on('end', () => {
      buttons.components.forEach((btn) => btn.setDisabled(true));
      message.edit({ components: [buttons] }).catch(() => {});
    });
  },
};
