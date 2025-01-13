const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

const userPointsPath = path.resolve(__dirname, 'json', 'userPoints.json');
const factionsPath = path.resolve(__dirname, 'json', 'factions.json');
let userPoints = {};
let factions = {};

const loadData = async () => {
  try {
    const data = await fs.readFile(userPointsPath, 'utf-8');
    userPoints = data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Erro ao carregar os dados de pontos:', error);
    userPoints = {};
  }
};

const loadFactions = async () => {
  try {
    const data = await fs.readFile(factionsPath, 'utf-8');
    factions = data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Erro ao carregar os dados de facções:', error);
    factions = {};
  }
};

const saveData = async () => {
  try {
    await fs.writeFile(userPointsPath, JSON.stringify(userPoints, null, 2));
    await fs.writeFile(factionsPath, JSON.stringify(factions, null, 2));
  } catch (error) {
    console.error('Erro ao salvar os dados:', error);
  }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('faccao')
    .setDescription('Crie sua facção por 300 pontos')
    .addBooleanOption(option => option.setName('confirmar').setDescription('Você quer criar uma facção?').setRequired(true)),

  async execute(interaction) {
    const userId = interaction.user.id;
    const confirmar = interaction.options.getBoolean('confirmar');
    const faccaoCusto = 300;

    await loadData();
    await loadFactions();

    if ((userPoints[userId] || 0) < faccaoCusto) {
      return interaction.reply({ content: 'Você precisa de pelo menos 300 pontos para criar uma facção!', ephemeral: true });
    }

    if (factions[userId]) {
      return interaction.reply({ content: 'Você já é dono de uma facção!', ephemeral: true });
    }

    if (confirmar) {
      userPoints[userId] -= faccaoCusto;
      await saveData();

      const embed = new EmbedBuilder()
        .setTitle('Confirmação de Criação de Facção')
        .setDescription('Digite o nome da sua facção!')
        .setColor('#FFFFFF')
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      const filter = response => response.author.id === interaction.user.id;
      const collector = interaction.channel.createMessageCollector({ filter, time: 90000 });

      let step = 0;
      let nomeFacao = '';
      let descricaoFacao = '';
      let imagemFacao = '';

      collector.on('collect', async (message) => {
        if (step === 0) {
          nomeFacao = message.content;
          step++;
          await message.reply('Agora, envie a descrição da sua facção.');
        } else if (step === 1) {
          descricaoFacao = message.content;
          step++;
          await message.reply('Por fim, envie uma URL de imagem para representar sua facção ou digite "pular".');
        } else if (step === 2) {
          imagemFacao = message.content.toLowerCase() === 'pular' ? null : message.content;

          factions[userId] = {
            nome: nomeFacao,
            descricao: descricaoFacao,
            imagem: imagemFacao,
            membros: [userId],
            lider: userId
          };
          await saveData();

          const finalEmbed = new EmbedBuilder()
            .setTitle(`Facção "${nomeFacao}" criada com sucesso!`)
            .setDescription(descricaoFacao)
            .setColor('#FFFFFF')
            .setTimestamp();

          if (imagemFacao) {
            finalEmbed.setImage(imagemFacao);
          }

          await message.reply({ embeds: [finalEmbed] });
          collector.stop();
        }
      });

      collector.on('end', collected => {
        if (collected.size < 3) {
          interaction.followUp('Tempo esgotado! Não foi possível criar sua facção.');
        }
      });
    } else {
      interaction.reply({ content: 'Você cancelou a criação da facção.', ephemeral: true });
    }
  },
};
