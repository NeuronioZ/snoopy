const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const userPointsPath = path.resolve(__dirname, 'json', 'userPoints.json');
const requiredRoleIds = ['1242981733792743474', '1242982998052311151', '1242981380967764030'];
const specialRoleId = '1322606733801033779';

let userPoints = {};

async function carregarPontos() {
  try {
    if (fs.existsSync(userPointsPath)) {
      const data = await fs.promises.readFile(userPointsPath, 'utf8');
      userPoints = data ? JSON.parse(data) : {};
    }
  } catch (error) {
    console.error('Erro ao carregar pontos:', error);
    throw new Error('Não foi possível carregar os pontos.');
  }
}

async function salvarPontos() {
  try {
    await fs.promises.writeFile(userPointsPath, JSON.stringify(userPoints, null, 2));
  } catch (error) {
    console.error('Erro ao salvar pontos:', error);
    throw new Error('Não foi possível salvar os pontos.');
  }
}

async function verificarPermissao(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  return requiredRoleIds.some(roleId => member.roles.cache.has(roleId));
}

function criarEmbedEvento(phrase, points) {
  return new EmbedBuilder()
    .setColor('#FFFFFF')
    .setTitle('Evento Drop! <:snoopy_ok:1323869918369939576>')
    .setDescription(`<:white_dot:1323871280021110835> Digite a frase correta **"${phrase}"** o mais rápido possível para ganhar pontos!`)
    .addFields(
      { name: '<:white_star:1323871287625383956> Pontos:', value: `Este evento vale **${points} ponto(s)**!` }
    )
    .setImage('https://i.ibb.co/jrk5xyH/f033b9ef0ac9c207e43eff37bc28c648.png')
    .setFooter({ text: 'Seja rápido! Hehe', iconURL: 'https://i.ibb.co/2kCbXx7/snoopy.png' })
    .setTimestamp();
}

function criarEmbedFinal(winner, reason) {
  let finalMessage = reason === 'time' ? 'O tempo acabou! Nenhum vencedor foi encontrado. <:snoopy_tear:1323869994425254018>' : winner ? `<:white_dot:1323871280021110835> Eba! Parabéns ao vencedor: <@${winner}>!` : '<:white_dot:1323871280021110835> O tempo acabou! Nenhum vencedor foi encontrado.';

  return new EmbedBuilder()
    .setColor('#FFFFFF')
    .setTitle('Evento Concluído! <:snoopy_snooze:1323869958735921183>')
    .setDescription(finalMessage)
    .setFooter({ text: 'Valeu por participar!', iconURL: 'https://i.ibb.co/2kCbXx7/snoopy.png' })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('drop')
    .setDescription('Inicie um evento onde o mais rápido ganha pontos ao digitar a frase correta!')
    .addStringOption(option => option.setName('frase').setDescription('Frase que os participantes devem digitar.').setRequired(true))
    .addIntegerOption(option => option.setName('pontos').setDescription('Quantidade de pontos que o vencedor irá ganhar.').setRequired(true)),

  async execute(interaction) {
    const { options, user, channel } = interaction;

    try {
      await carregarPontos();

      if (!await verificarPermissao(interaction)) {
        return interaction.reply({ content: '❌ Você não tem permissão para usar esse comando.', ephemeral: true });
      }

      const phrase = options.getString('frase');
      const points = options.getInteger('pontos');

      const dropEmbed = criarEmbedEvento(phrase, points);
      await channel.send({ embeds: [dropEmbed] });

      const filter = message => message.content === phrase && !message.author.bot;
      const collector = channel.createMessageCollector({ filter, max: 1, time: 60000 });

      let winner = null;

      collector.on('collect', async message => {
        const responseTime = Date.now() - interaction.createdTimestamp;
        const isPhraseLong = phrase.length > 9;

        if (isPhraseLong && responseTime < 100) {
          const warningEmbed = new EmbedBuilder()
            .setColor('#FF9800')
            .setTitle('⚠️ Resposta Suspeita ⚠️')
            .setDescription(`<@${message.author.id}>, sua resposta foi muito rápida e pode ter sido copiada e colada.\n\n⚠️ Certifique-se de digitar a frase manualmente para participar!`)
            .setFooter({ text: 'Jogue limpo!', iconURL: 'https://i.ibb.co/2kCbXx7/snoopy.png' })
            .setTimestamp();

          await channel.send({ embeds: [warningEmbed] });
          return;
        }

        winner = message.author.id;

        const hasSpecialRole = message.member.roles.cache.has(specialRoleId);
        const userPointsToAdd = hasSpecialRole ? points * 2 : points;

        userPoints[message.author.id] = (userPoints[message.author.id] || 0) + userPointsToAdd;

        await salvarPontos();
        await message.react('<:snoopy_ok:1323869918369939576>');
      });

      collector.on('end', (_, reason) => {
        const finalEmbed = criarEmbedFinal(winner, reason);
        channel.send({ embeds: [finalEmbed] });
      });
    } catch (error) {
      console.error('Erro ao executar o comando drop:', error);
      await interaction.reply({ content: '❌ Algo deu errado. Tente novamente mais tarde.', ephemeral: true });
    }
  },
};

carregarPontos();
