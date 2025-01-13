const { SlashCommandBuilder } = require('@discordjs/builders');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('testeinc')
    .setDescription('Envie os arquivos userPoints.json e userHistory.json em tempo real'),

  async execute(interaction) {
    const ownerId = '627116319074025473';
    if (interaction.user.id !== ownerId) {
      return interaction.reply({ content: 'Você não tem permissão para usar este comando.', ephemeral: true });
    }

    const filePaths = {
      userPoints: path.join(__dirname, 'json', 'userPoints.json'),
      charada: path.join(__dirname, 'json', 'charada.json'),
      roubar: path.join(__dirname, 'json', 'roubar.json'),
      factions: path.join(__dirname, 'json', 'factions.json'),
      apostas: path.join(__dirname, 'json', 'apostas.json'),
      purchaseHistory: path.join(__dirname, 'json', 'purchaseHistory.json'),
    };

    const filesToSend = [];

    try {
      // Verifica cada arquivo e adiciona à lista se estiver presente e não vazio
      for (const [key, filePath] of Object.entries(filePaths)) {
        if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          filesToSend.push({
            attachment: Buffer.from(fileContent, 'utf-8'),
            name: `${key}.json`,
          });
        } else {
          console.warn(`O arquivo ${key}.json não foi encontrado ou está vazio.`);
        }
      }

      if (filesToSend.length === 0) {
        return interaction.reply({ content: 'Nenhum arquivo válido foi encontrado para envio.', ephemeral: true });
      }

      await interaction.reply({
        content: 'Aqui estão os arquivos disponíveis:',
        files: filesToSend,
      });
    } catch (error) {
      console.error('Erro ao processar os arquivos:', error);
      await interaction.reply({ content: 'Ocorreu um erro ao tentar enviar os arquivos. Verifique os logs para mais detalhes.', ephemeral: true });
    }
  },
};
