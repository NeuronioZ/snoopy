const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs/promises');
const path = require('path');

const userPointsPath = path.resolve(__dirname, 'json', 'userPoints.json');
const apostaPath = path.resolve(__dirname, 'json', 'apostas.json');
const callTimePath = path.resolve(__dirname, 'json', 'callTime.json');
const roubarPath = path.resolve(__dirname, 'json', 'roubar.json');
const charadasPath = path.resolve(__dirname, 'json', 'charada.json');
const faccoesPath = path.resolve(__dirname, 'json', 'factions.json');

const readJsonFile = async (filePath) => {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error(`Erro ao ler ${filePath}:`, error);
    if (error.code === 'ENOENT') {
      await fs.writeFile(filePath, JSON.stringify([], null, 2));
      return [];
    }
    return [];
  }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Mostra suas estatísticas'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const userPointsData = await readJsonFile(userPointsPath);
    const callTimeData = await readJsonFile(callTimePath);
    const apostaData = await readJsonFile(apostaPath);
    const roubarData = await readJsonFile(roubarPath);
    const charadasData = await readJsonFile(charadasPath);
    const faccoesData = await readJsonFile(faccoesPath);

    const pontos = userPointsData[userId] || 0;
    let tempoEmCall = callTimeData[userId] || 0;

    let apostasGanhas = 0;
    let apostasPerdidas = 0;
    let pontosGanhadosApostando = 0;
    const apostas = new Set();

    if (Array.isArray(apostaData.history)) {
      apostaData.history.forEach(aposta => {
        const apostaKey = `${aposta.apostador}-${aposta.adversario}-${aposta.quantia}`;
        apostas.add(apostaKey);
        if (aposta.vencedor === userId) {
          apostasGanhas++;
          pontosGanhadosApostando += aposta.quantia || 0;
        } else if (aposta.perdedor === userId) {
          apostasPerdidas++;
        }
      });
    }

    const totalApostas = apostas.size;

    let roubos = 0;
    let falhasNoRoubo = 0;
    if (Array.isArray(roubarData)) {
      roubarData.forEach(roubo => {
        if (roubo.robber === userId) {
          roubos++;
          if (!roubo.success) {
            falhasNoRoubo++;
          }
        }
      });
    }

    const charadasAcertadas = charadasData[userId] || 0;

    const tempoEmCallMinutos = (tempoEmCall / 1000 / 60).toFixed(2);
    let tempoEmCallFormatado;
    if (tempoEmCallMinutos >= 60) {
      const tempoEmCallHoras = (tempoEmCall / 1000 / 60 / 60).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      tempoEmCallFormatado = `${tempoEmCallHoras} horas`;
    } else {
      tempoEmCallFormatado = `${parseFloat(tempoEmCallMinutos).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} minutos`;
    }

    tempoEmCall += 10000;
    callTimeData[userId] = tempoEmCall;
    await fs.writeFile(callTimePath, JSON.stringify(callTimeData, null, 2));

    let faccaoNome = 'Nada';
    for (const faccaoId in faccoesData) {
      const faccao = faccoesData[faccaoId];
      if (faccao.membros.includes(userId) || faccao.lider === userId) {
        faccaoNome = faccao.nome;
        break;
      }
    }

    const embed = new EmbedBuilder()
      .setColor('#FFFFFF')
      .setTitle(`<a:exclamation_white:1323871260274593843> Estatísticas de ${interaction.user.username}`)
      .setDescription(`<:Exclamation:1324588791989669929> ┃ Aqui estão suas estatísticas detalhadas, ${interaction.user.username}!`)
      .addFields(
        { name: '<:white_star:1323871287625383956> Pontos', value: pontos.toLocaleString('pt-BR'), inline: true },
        { name: '<:white_star:1323871287625383956> Tempo em Call', value: tempoEmCallFormatado, inline: true },
        { name: '<:white_star:1323871287625383956> Apostas Ganhas', value: apostasGanhas.toLocaleString('pt-BR'), inline: true },
        { name: '<:white_star:1323871287625383956> Apostas Perdidas', value: apostasPerdidas.toLocaleString('pt-BR'), inline: true },
        { name: '<:white_star:1323871287625383956> Pontos Ganhos Apostando', value: pontosGanhadosApostando.toLocaleString('pt-BR'), inline: true },
        { name: '<:white_star:1323871287625383956> Roubos Realizados', value: roubos.toLocaleString('pt-BR'), inline: true },
        { name: '<:white_star:1323871287625383956> Falhas no Roubo', value: falhasNoRoubo.toLocaleString('pt-BR'), inline: true },
        { name: '<:white_star:1323871287625383956> Charadas Acertadas', value: charadasAcertadas.toLocaleString('pt-BR'), inline: true },
        { name: '<:white_star:1323871287625383956> Facção', value: faccaoNome, inline: true }
      )
      .setThumbnail(interaction.user.displayAvatarURL())
      .setFooter({ text: `ID do Usuário: ${userId}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    interaction.reply({ embeds: [embed] });

    // Salvando as mudanças no arquivo
    await fs.writeFile(roubarPath, JSON.stringify(roubarData, null, 2));
  }
};
