const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const userPointsPath = path.resolve(__dirname, 'json', 'userPoints.json');
const charadaPath = path.resolve(__dirname, 'json', 'charada.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('charada')
    .setDescription('Lance uma charada com uma palavra secreta.')
    .addStringOption(option =>
      option.setName('mensagem')
        .setDescription('Pergunta da charada.')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('word')
        .setDescription('Palavra secreta da charada.')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('pontos')
        .setDescription('Quantidade de SnooCredits que o vencedor irá ganhar.')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('dica')
        .setDescription('Dica opcional para a charada. Se não quiser, deixe em branco.')
        .setRequired(false)),

  async execute(interaction) {
    const { options, user, channel } = interaction;
    const requiredRoleIds = ['1242981733792743474', '1242982998052311151', '1242981380967764030'];

    try {
      const member = await interaction.guild.members.fetch(user.id);
      const hasRequiredRole = requiredRoleIds.some(roleId => member.roles.cache.has(roleId));

      if (!hasRequiredRole) {
        return interaction.reply({
          content: '❌ Você não tem permissão para usar esse comando.',
          ephemeral: true,
        });
      }

      const normalizeText = text =>
        text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '');

      const secretWord = normalizeText(options.getString('word'));
      const messageToSend = options.getString('mensagem');
      let points = options.getInteger('pontos');
      const hint = options.getString('dica') || 'Não tem dica..';

      // Expressão regular para verificar links de imagem
      const imageRegex = /(https?:\/\/[^\s]+(\.(?:jpg|jpeg|png|gif|bmp|webp)))$/i;
      const imageUrl = messageToSend.match(imageRegex) ? messageToSend.match(imageRegex)[0] : null;

      const charadaEmbed = new EmbedBuilder()
        .setColor('#FFFFFF')
        .setTitle('Evento Advinhar!! <:snoopy_coffee:1323869950775132180>')
        .setDescription(`<:white_dot:1323871280021110835> "${messageToSend}"`)
        .addFields(
          { name: '<:white_dash:1323871271297089627> Dica:', value: hint },
          { name: '<:white_dash:1323871271297089627> SnooCredits:', value: `Essa charada vale **${points} ponto(s)** hein?!` },
          { name: '<:White_heart:1323871248886927461> Feita por:', value: `<@${user.id}>` }
        )
        .setFooter({ text: 'Boa sorte tá?!', iconURL: 'https://i.ibb.co/2kCbXx7/snoopy.png' })
        .setTimestamp();

      // Se houver um link de imagem, adicionar à embed
      if (imageUrl) {
        charadaEmbed.setImage(imageUrl);
      } else {
        charadaEmbed.setImage('https://i.ibb.co/jrk5xyH/f033b9ef0ac9c207e43eff37bc28c648.png');
      }

      await channel.send({ embeds: [charadaEmbed] });

      const filter = message => {
        const userResponse = normalizeText(message.content);
        return userResponse === secretWord && !message.author.bot;
      };

      const collector = channel.createMessageCollector({ filter, time: 60000 });

      collector.on('collect', async message => {
        try {
          const userPoints = await readData(userPointsPath);
          const userId = message.author.id;

          const member = await interaction.guild.members.fetch(userId);
          const hasDoublePointsRole = member.roles.cache.has('1322606733801033779');
          
          if (hasDoublePointsRole) {
            points *= 2;
          }

          userPoints[userId] = (userPoints[userId] || 0) + points;

          await writeData(userPointsPath, userPoints);
          await incrementCharadaCount(userId);

          const successEmbed = new EmbedBuilder()
            .setColor('#FFFFFF')
            .setTitle('Advinhada! <:snoopy_ok:1323869918369939576>')
            .setDescription(`<:white_dot:1323871280021110835> Parabéns, <@${message.author.id}>! Você ganhou **${points}** ponto(s)!`)
            .addFields(
              { name: '<:white_star:1323871287625383956> SnooCredits Totais:', value: `${userPoints[userId]}` }
            )
            .setFooter({ text: 'Até a próxima!', iconURL: 'https://i.ibb.co/2kCbXx7/snoopy.png' })
            .setTimestamp();

          await channel.send({ embeds: [successEmbed] });
          collector.stop();
        } catch (error) {
          console.error(error);
        }
      });

      collector.on('end', (_, reason) => {
        if (reason === 'time') {
          channel.send('O tempo acabou! Nínguem acertou.. <:snoopy_confused:1323870014247403601>');
        }
      });
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: '❌ Algo deu errado. Tente novamente mais tarde.',
        ephemeral: true,
      });
    }
  },
};

async function readData(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const data = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(data || '{}');
    }
    return {};
  } catch {
    return {};
  }
}

async function writeData(filePath, data) {
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function incrementCharadaCount(userId) {
  const charadaData = await readData(charadaPath);
  charadaData[userId] = (charadaData[userId] || 0) + 1;
  await writeData(charadaPath, charadaData);
}
