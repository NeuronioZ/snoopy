const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const userPointsPath = path.resolve(__dirname, 'json', 'userPoints.json');
let userPoints = {};

async function carregarPontos() {
  try {
    if (fs.existsSync(userPointsPath)) {
      const data = await fs.promises.readFile(userPointsPath, 'utf8');
      userPoints = data ? JSON.parse(data) : {};
    }
  } catch (error) {
    console.error('Erro ao carregar pontos:', error);
  }
}

async function salvarPontos() {
  try {
    await fs.promises.writeFile(userPointsPath, JSON.stringify(userPoints, null, 2));
  } catch (error) {
    console.error('Erro ao salvar pontos:', error);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reaction')
    .setDescription('Crie um evento de reação onde o primeiro a reagir ganha pontos!'),

  async execute(interaction) {
    const { user, channel } = interaction;

    if (!interaction.member.roles.cache.has('1242981733792743474')) {
      return interaction.reply({ content: '❌ Você não tem permissão para usar este comando.', ephemeral: true });
    }

    try {
      await carregarPontos();

      const reactionEmbed = new EmbedBuilder()
        .setColor('#FFFFFF')
        .setTitle('Evento Reação! <:snoopy_ok:1323869918369939576>')
        .setDescription('<:white_dot:1323871280021110835> O primeiro que reagir essa mensagem.. Ganha **10** pontos!')
        .setFooter({ text: 'Até a próxima!', iconURL: 'https://i.ibb.co/2kCbXx7/snoopy.png' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('reaction_button')
          .setLabel('Heh')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('<:snoopy_coffee:1323869950775132180>')
      );

      const message = await channel.send({
        embeds: [reactionEmbed],
        components: [row],
      });

      const filter = i => i.customId === 'reaction_button' && !i.user.bot;
      const collector = message.createMessageComponentCollector({ filter, max: 1, time: 60000 });

      collector.on('collect', async (interaction) => {
        const winner = interaction.user;
        userPoints[winner.id] = (userPoints[winner.id] || 0) + 10;
        await salvarPontos();

        await interaction.reply({
          content: `<@${winner.id}> foi o primeiro a reagir e ganhou 10 pontos! <:snoopy_snooze:1323869958735921183>`,
          ephemeral: false,
        });

        row.components[0].setDisabled(true);
        await message.edit({ components: [row] });
      });

      collector.on('end', (_, reason) => {
        if (reason === 'time') {
          message.edit({ content: 'O evento acabou! Ninguém reagiu a tempo.', components: [] });
        }
      });
    } catch (error) {
      console.error('Erro ao executar o comando reaction:', error);
      await interaction.reply({
        content: '❌ Algo deu errado. Tente novamente mais tarde.',
        ephemeral: true,
      });
    }
  },
};

carregarPontos();
