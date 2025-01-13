const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

const factionsPath = path.resolve(__dirname, 'json', 'factions.json');
const userPointsPath = path.resolve(__dirname, 'json', 'userPoints.json');

let factions = {};
let userPoints = {};

let currentPage = 0;
const pageSize = 5;

const loadData = async (filePath) => {
  try {
    if (await fileExists(filePath)) {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) || {};
    }
    return {};
  } catch (error) {
    console.error(`Erro ao carregar dados de ${filePath}:`, error);
    return {};
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

module.exports = {
  data: new SlashCommandBuilder()
    .setName('faccoes')
    .setDescription('Exibe um placar das facções com a quantidade de membros e o total de pontos de cada facção.'),

  async execute(interaction) {
    factions = await loadData(factionsPath);
    userPoints = await loadData(userPointsPath);

    if (Object.keys(factions).length === 0) {
      return interaction.reply({
        content: 'Nenhuma facção foi cadastrada ainda!',
        ephemeral: true,
      });
    }

    const factionScores = Object.values(factions).map((faction) => {
      const totalPoints = faction.membros.reduce((acc, memberId) => {
        return acc + (userPoints[memberId] || 0);
      }, 0);
      return {
        name: faction.nome,
        membersCount: faction.membros.length,
        totalPoints,
        leader: faction.lider,
      };
    });

    const sortedFactionScores = factionScores.sort((a, b) => b.totalPoints - a.totalPoints);

    const totalPages = Math.ceil(sortedFactionScores.length / pageSize);
    const pageStart = currentPage * pageSize;
    const pageEnd = pageStart + pageSize;
    const currentPageFacções = sortedFactionScores.slice(pageStart, pageEnd);

    const embed = new EmbedBuilder()
      .setColor('#FFFFFF')
      .setTitle('Placar das Facções 🃏')
      .setDescription('<:Exclamation:1324588791989669929> ┃ Aqui mostra todas as facções e seus pontos!')
      .setTimestamp();

    currentPageFacções.forEach((faction, index) => {
      embed.addFields(
        { 
          name: `${pageStart + index + 1}. ${faction.name}`, 
          value: `Membros: ${faction.membersCount}\nPontos Totais: ${faction.totalPoints}\nLíder: ${faction.leader ? `<@${faction.leader}>` : 'Sem líder'}`, 
          inline: false 
        }
      );
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('previous_page')
        .setLabel('◀️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage === 0),
      new ButtonBuilder()
        .setCustomId('next_page')
        .setLabel('▶️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage === totalPages - 1)
    );

    await interaction.reply({ embeds: [embed], components: [row] });

    const filter = (i) => i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60 * 1000 });

    collector.on('collect', async (i) => {
      try {
        if (i.customId === 'previous_page' && currentPage > 0) {
          currentPage--;
        } else if (i.customId === 'next_page' && currentPage < totalPages - 1) {
          currentPage++;
        }

        factions = await loadData(factionsPath);
        userPoints = await loadData(userPointsPath);

        const pageStart = currentPage * pageSize;
        const pageEnd = pageStart + pageSize;
        const currentPageFacções = sortedFactionScores.slice(pageStart, pageEnd);

        const embed = new EmbedBuilder()
          .setColor('#FFFFFF')
          .setTitle('Placar das Facções 🃏')
          .setDescription('<:Exclamation:1324588791989669929> ┃ Aqui mostra todas as facções e seus pontos!')
          .setTimestamp();

        currentPageFacções.forEach((faction, index) => {
          embed.addFields(
              { 
                name: `${pageStart + index + 1}. ${faction.name}`, 
                value: `Membros: ${faction.membersCount}\nPontos Totais: ${faction.totalPoints}\nLíder: ${faction.leader ? `<@${faction.leader}>` : 'Sem líder'}`, 
                inline: false 
              }
            );          
        });

        await i.update({ embeds: [embed], components: [row] });
      } catch (error) {
        console.error('Erro ao atualizar interação:', error);
      }
    });
  },
};
