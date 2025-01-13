const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('infofac')
    .setDescription('Exibe informações sobre uma facção')
    .addStringOption(option =>
      option
        .setName('nome')
        .setDescription('Nome da facção')
        .setRequired(true)
    ),

  async execute(interaction) {
    const facNome = interaction.options.getString('nome').toLowerCase();
    const factionsPath = path.resolve(__dirname, 'json', 'factions.json');
    const userPointsPath = path.resolve(__dirname, 'json', 'userPoints.json');
    const dominatePath = path.resolve(__dirname, 'json', 'dominar.json'); // Caminho para o arquivo de áreas dominadas

    try {
      const [factionsData, userPointsData, dominateData] = await Promise.all([
        fs.readFile(factionsPath, 'utf-8'),
        fs.readFile(userPointsPath, 'utf-8'),
        fs.readFile(dominatePath, 'utf-8') // Carregar dados de áreas dominadas
      ]);

      const factions = JSON.parse(factionsData);
      const userPoints = JSON.parse(userPointsData);
      const areas = JSON.parse(dominateData);

      const faction = Object.values(factions).find(fac => fac.nome.toLowerCase() === facNome);
      if (!faction) {
        if (!interaction.replied) {
          return interaction.reply({ content: 'Facção não encontrada!', ephemeral: true });
        }
        return;
      }

      const { nome, descricao, imagem, membros, lider } = faction;

      const liderTag = await getMemberTag(interaction, lider);
      const membrosList = await Promise.all(membros.map(memberId => getMemberTag(interaction, memberId)));

      const totalPoints = membros.reduce((acc, memberId) => acc + (userPoints[memberId] || 0), 0);
      const membrosCount = membrosList.length;

      // Encontrar áreas dominadas pela facção
      const dominatedAreas = Object.entries(areas)
        .filter(([area, data]) => data.faction === nome) // Filtra as áreas dominadas pela facção
        .map(([area]) => area.replace(/_/g, ' ')); // Converte o nome da área para um formato legível

      const areasText = dominatedAreas.length > 0 ? dominatedAreas.join('\n') : 'Nenhuma área dominada';

      const embed = {
        color: 0xffffff,
        title: `<a:exclamation_white:1323871260274593843> Informações da Facção: ${nome}`,
        description: descricao,
        thumbnail: {
          url: imagem || interaction.client.user.displayAvatarURL(),
        },
        fields: [
          { name: `<:white_star:1323871287625383956> ┃ Membros (${membrosCount}) / 15`, value: membrosList.join('\n') || 'Nenhum membro', inline: true },
          { name: '<:white_star:1323871287625383956> ┃ Líder', value: liderTag, inline: true },
          { name: '<:white_star:1323871287625383956> ┃ Pontos Totais', value: totalPoints.toString(), inline: true },
          { name: '<:white_star:1323871287625383956> ┃ Áreas Dominadas', value: areasText, inline: false },
        ],
      };

      if (!interaction.replied) {
        await interaction.reply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Erro ao buscar informações da facção:', error);
      if (!interaction.replied) {
        interaction.reply({ content: 'Ocorreu um erro ao buscar as informações da facção.', ephemeral: true });
      }
    }
  },
};

async function getMemberTag(interaction, memberId) {
  try {
    const member = await interaction.guild.members.fetch(memberId);
    return `<@${member.id}>`;
  } catch {
    return 'Desconhecido';
  }
}
