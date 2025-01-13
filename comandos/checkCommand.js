const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const userPointsFile = path.resolve(__dirname, 'json', 'userPoints.json');
const userHistoryFile = path.resolve(__dirname, 'json', 'userHistory.json');

const loadFile = async (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      const data = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    }
    return {};
  } catch (error) {
    console.error(`Erro ao carregar o arquivo: ${filePath}`, error);
    return {};
  }
};

const saveFile = async (filePath, data) => {
  try {
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Erro ao salvar o arquivo: ${filePath}`, error);
  }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('check')
    .setDescription('Verifique a validade de um token e obtenha informações sobre a compra.')
    .addStringOption(option =>
      option.setName('token')
        .setDescription('Insira o token a ser verificado')
        .setRequired(true)),

  async execute(interaction) {
    const tokenInput = interaction.options.getString('token');
    const tokens = await loadFile(userHistoryFile);

    if (tokens[tokenInput]) {
      const tokenInfo = tokens[tokenInput];

      if (tokenInfo.used) {
        return await interaction.reply({
          content: `Esse token já foi usado.\nUsuário: <@${tokenInfo.userId}>\nProduto: ${tokenInfo.product}`,
          ephemeral: true
        });
      }

      let user;
      try {
        user = await interaction.client.users.fetch(tokenInfo.userId);
      } catch (error) {
        return await interaction.reply({
          content: 'Não foi possível encontrar o usuário associado ao token.',
          ephemeral: true
        });
      }

      await interaction.reply({
        content: `Token válido!\n\n**Usuário:** ${user.tag} (<@${tokenInfo.userId}>)\n**Produto:** ${tokenInfo.product}\n\nEsse token ainda não foi utilizado.`,
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: `Esse token não é válido ou não existe. Token: \`${tokenInput}\``,
        ephemeral: true
      });
    }
  }
};
