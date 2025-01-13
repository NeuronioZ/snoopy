const { SlashCommandBuilder } = require('@discordjs/builders');
const { ButtonStyle, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

const factionsPath = path.resolve(__dirname, 'json', 'factions.json');
let factions = {};

const loadFactions = async () => {
  try {
    const data = await fs.readFile(factionsPath, 'utf-8');
    factions = data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Erro ao carregar as facções:', error);
    factions = {};
  }
};

const saveFactions = async () => {
  try {
    await fs.writeFile(factionsPath, JSON.stringify(factions, null, 2));
  } catch (error) {
    console.error('Erro ao salvar as facções:', error);
  }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sairfac')
    .setDescription('Saia da sua facção atual!'),

  async execute(interaction) {
    const userId = interaction.user.id;
    await loadFactions();

    const faccao = Object.values(factions).find(f => f.membros.includes(userId));

    if (!faccao) {
      return interaction.reply({ content: 'Você não está em nenhuma facção!', ephemeral: true });
    }

    if (faccao.lider === userId) {
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`confirmarSair_${userId}`)
            .setLabel('Confirmar saída e deletar facção')
            .setStyle(ButtonStyle.Danger)
        );

      return interaction.reply({
        content: 'Você é o líder da facção! Se sair, a facção será deletada. Deseja confirmar?',
        components: [row],
        ephemeral: true,
      });
    }

    faccao.membros = faccao.membros.filter(id => id !== userId);
    await saveFactions();

    return interaction.reply({ content: `Você saiu da facção **${faccao.nome}**.`, ephemeral: true });
  },

  async handleButton(interaction) {
    if (!interaction.isButton()) return;

    const [action, userId] = interaction.customId.split('_');
    if (action !== 'confirmarSair') return;

    await loadFactions();

    const faccao = Object.values(factions).find(f => f.lider === userId);

    if (!faccao || faccao.lider !== interaction.user.id) {
      return interaction.reply({ content: 'Você não é o líder de nenhuma facção ou não tem permissão para isso.', ephemeral: true });
    }

    delete factions[faccao.nome];
    await saveFactions();

    return interaction.update({
      content: `A facção **${faccao.nome}** foi deletada e você saiu dela com sucesso.`,
      components: [],
      ephemeral: true,
    });
  },
};
