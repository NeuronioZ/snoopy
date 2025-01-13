const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs/promises');
const path = require('path');

const userPointsPath = path.resolve(__dirname, 'json', 'userPoints.json');
const cooldownsPath = path.resolve(__dirname, 'json', 'cooldowns.json');
const doublePointsRoleId = '1322606733801033779'; 
const COOLDOWN_TIME = 5 * 60 * 60 * 1000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resgatar')
    .setDescription('Resgate entre 5 a 35 pontos a cada 5 horas.'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const member = interaction.member;

    try {
      const [userPointsData, cooldownsData] = await Promise.all([
        fs.readFile(userPointsPath, 'utf-8').catch(() => '{}'),
        fs.readFile(cooldownsPath, 'utf-8').catch(() => '{}')
      ]);

      let pointsData = {}, cooldownData = {};
      try {
        pointsData = JSON.parse(userPointsData);
      } catch { /* ignore */ }
      try {
        cooldownData = JSON.parse(cooldownsData);
      } catch { /* ignore */ }

      const currentTime = Date.now();
      if (cooldownData[userId] && currentTime - cooldownData[userId] < COOLDOWN_TIME) {
        const remainingTime = COOLDOWN_TIME - (currentTime - cooldownData[userId]);
        const remainingHours = Math.floor(remainingTime / (1000 * 60 * 60));
        const remainingMinutes = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60));
        return interaction.reply({
          content: `❌ Você precisa esperar mais **${remainingHours} horas e ${remainingMinutes} minutos** para resgatar novamente.`,
          ephemeral: true,
        });
      }

      let points = Math.floor(Math.random() * (35 - 5 + 1)) + 5;
      if (member && member.roles && member.roles.cache && member.roles.cache.has(doublePointsRoleId)) {
        points *= 2;
      }

      pointsData[userId] = (pointsData[userId] || 0) + points;

      await Promise.all([
        fs.writeFile(userPointsPath, JSON.stringify(pointsData, null, 2)),
        fs.writeFile(cooldownsPath, JSON.stringify({ ...cooldownData, [userId]: currentTime }, null, 2))
      ]);

      const embed = new EmbedBuilder()
        .setTitle('Resgate Bem-Sucedido! <:snoopy_ok:1323869918369939576>')
        .setDescription(
          member && member.roles && member.roles.cache && member.roles.cache.has(doublePointsRoleId)
            ? `<:white_dot:1323871280021110835> Você recebeu **${points} pontos!** Como possui o cargo especial, você ganhou pontos em dobro!`
            : `<:white_star:1323871287625383956> Você recebeu **${points} pontos!**`
        )
        .addFields({
          name: '<:white_star:1323871287625383956> Seu Novo Saldo',
          value: `**${pointsData[userId]}**`,
        })
        .setColor('#FFFFFF')
        .setImage('https://i.ibb.co/jrk5xyH/f033b9ef0ac9c207e43eff37bc28c648.png')
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      return interaction.reply({ content: 'Ocorreu um erro ao processar o resgate.', ephemeral: true });
    }
  },
};
