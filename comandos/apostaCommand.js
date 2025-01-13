const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs/promises');
const path = require('path');

const userPointsPath = path.resolve(__dirname, 'json', 'userPoints.json');
const cooldownsPath = path.resolve(__dirname, 'json', 'cooldowns.json');
const apostasPath = path.resolve(__dirname, 'json', 'apostas.json');
const botId = '1312620873743863949';

async function ensureFileExists(filePath, defaultData) {
    try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.access(filePath);
    } catch (error) {
        await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2));
    }
}

async function updateJSONFile(filePath, data) {
    try {
        await ensureFileExists(filePath, data);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`Erro ao salvar dados em ${filePath}:`, error);
        throw new Error('Erro ao salvar dados.');
    }
}

async function registerAposta(vencedorId, perdedorId, quantia) {
    let apostasData = {};
    await ensureFileExists(apostasPath, {});
    try {
        apostasData = await fs.readFile(apostasPath, 'utf-8').then(JSON.parse);
    } catch (error) {
        await updateJSONFile(apostasPath, {});
    }

    const aposta = {
        vencedor: vencedorId,
        perdedor: perdedorId,
        quantia,
        data: new Date().toISOString(),
    };

    apostasData.history = apostasData.history || [];
    apostasData.history.push(aposta);
    await updateJSONFile(apostasPath, apostasData);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('aposta')
        .setDescription('Faça uma aposta com alguém!')
        .addUserOption(option =>
            option.setName('adversario')
                .setDescription('Usuário com quem deseja apostar.')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('quantia')
                .setDescription('Quantidade de SnooCredits para apostar.')
                .setRequired(true)),
    async execute(interaction) {
        const apostador = interaction.user;
        const adversario = interaction.options.getUser('adversario');
        const quantia = interaction.options.getInteger('quantia');
        const botUserId = interaction.client.user.id;
        const timestamp = Date.now();

        if (quantia <= 0) {
            return interaction.reply({
                content: '<:Exclamation:1324588791989669929> ┃ A quantia mínima para uma aposta deve ser maior que 0 SnooCredits!',
                ephemeral: true
            });
        }

        if (apostador.id === adversario.id) {
            return interaction.reply({ content: '<:Exclamation:1324588791989669929> ┃ Você não pode apostar contra si mesmo!', ephemeral: true });
        }

        try {
            let userPointsData = {};
            let cooldownsData = {};

            await ensureFileExists(userPointsPath, {});
            await ensureFileExists(cooldownsPath, {});

            userPointsData = await fs.readFile(userPointsPath, 'utf-8').then(JSON.parse).catch(() => {});
            cooldownsData = await fs.readFile(cooldownsPath, 'utf-8').then(JSON.parse).catch(() => {});

            if (cooldownsData[apostador.id] && timestamp - cooldownsData[apostador.id] < 3000) {
                return interaction.reply({ content: '<:Exclamation:1324588791989669929> ┃ Espere 3 segundos antes de realizar outra aposta.', ephemeral: true });
            }

            const apostadorPontos = userPointsData[apostador.id] || 0;
            const adversarioPontos = userPointsData[adversario.id] || 0;

            if (apostadorPontos < quantia) {
                return interaction.reply({ content: '<:Exclamation:1324588791989669929> ┃ Você não tem SnooCredits suficientes para essa aposta!', ephemeral: true });
            }

            if (adversario.id === botUserId) {
                if (adversarioPontos < quantia) {
                    return interaction.reply({ content: '<:Exclamation:1324588791989669929> ┃ O bot não tem SnooCredits suficientes para essa aposta!', ephemeral: true });
                }

                const vencedor = Math.random() < 0.90 ? adversario : apostador;
                const perdedor = vencedor.id === apostador.id ? adversario : apostador;

                if (userPointsData[perdedor.id] - quantia < 0) {
                    return interaction.reply({ content: '<:Exclamation:1324588791989669929> ┃ O saldo do perdedor é insuficiente para essa aposta!', ephemeral: true });
                }

                userPointsData[vencedor.id] = (userPointsData[vencedor.id] || 0) + quantia;
                userPointsData[perdedor.id] = (userPointsData[perdedor.id] || 0) - quantia;

                const casaPontos = Math.floor(quantia * 0.1);
                userPointsData[botUserId] = (userPointsData[botUserId] || 0) + casaPontos;

                await Promise.all([
                    updateJSONFile(userPointsPath, userPointsData),
                    updateJSONFile(cooldownsPath, { ...cooldownsData, [apostador.id]: timestamp }),
                ]);

                await registerAposta(vencedor.id, perdedor.id, quantia);

                const embed = new EmbedBuilder()
                    .setTitle('Resultado da Aposta <:snoopy_cheerful:1324588321287966803>')
                    .setDescription(`<a:exclamation_white:1323871260274593843> <@${vencedor.id}> venceu a aposta contra <@${perdedor.id}>`)
                    .addFields(
                        { name: '<:white_dot:1323871280021110835> SnooCredits Apostados', value: quantia.toString(), inline: true },
                        { name: '<:white_dot:1323871280021110835> Saldo do Vencedor', value: userPointsData[vencedor.id].toString(), inline: true },
                        { name: '<:white_dot:1323871280021110835> Saldo do Perdedor', value: userPointsData[perdedor.id].toString(), inline: true },
                        { name: '<:white_dot:1323871280021110835> Saldo da Casa (Bot)', value: userPointsData[botUserId].toString(), inline: true },
                    )
                    .setColor('#FFFFFF')
                    .setTimestamp();

                return interaction.reply({ embeds: [embed] });
            } else {
                if (adversarioPontos < quantia) {
                    return interaction.reply({ content: '<:Exclamation:1324588791989669929> ┃ Seu adversário não tem SnooCredits suficientes para essa aposta!', ephemeral: true });
                }

                const embed = new EmbedBuilder()
                    .setTitle('Aposta <:snoopy_starstruck:1324588330364436492>')
                    .setDescription(`<a:exclamation_white:1323871260274593843> <@${apostador.id}> desafiou <@${adversario.id}> para uma aposta de **${quantia}** SnooCredits!`)
                    .setColor('#FFFFFF')
                    .setTimestamp();

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('aceitar_aposta')
                            .setLabel('Aceitar')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('recusar_aposta')
                            .setLabel('Recusar')
                            .setStyle(ButtonStyle.Danger),
                    );

                const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

                const filter = i => ['aceitar_aposta', 'recusar_aposta'].includes(i.customId) && i.user.id === adversario.id;
                const collector = message.createMessageComponentCollector({ filter, time: 30000 });

                collector.on('collect', async i => {
                    if (i.customId === 'aceitar_aposta') {
                        collector.stop();

                        const vencedor = Math.random() < 0.5 ? adversario : apostador;
                        const perdedor = vencedor.id === apostador.id ? adversario : apostador;

                        if (userPointsData[perdedor.id] - quantia < 0) {
                            return i.update({ content: '<:Exclamation:1324588791989669929> ┃ O saldo do perdedor é insuficiente para essa aposta!', embeds: [], components: [] });
                        }

                        userPointsData[vencedor.id] = (userPointsData[vencedor.id] || 0) + quantia;
                        userPointsData[perdedor.id] = (userPointsData[perdedor.id] || 0) - quantia;

                        await Promise.all([
                            updateJSONFile(userPointsPath, userPointsData),
                            updateJSONFile(cooldownsPath, { ...cooldownsData, [apostador.id]: timestamp }),
                        ]);

                        await registerAposta(vencedor.id, perdedor.id, quantia);

                        const resultEmbed = new EmbedBuilder()
                            .setTitle('Resultado da Aposta <:snoopy_cheerful:1324588321287966803>')
                            .setDescription(`<a:exclamation_white:1323871260274593843> <@${vencedor.id}> venceu a aposta contra <@${perdedor.id}>`)
                            .addFields(
                                { name: '<:white_dot:1323871280021110835> SnooCredits Apostados', value: quantia.toString(), inline: true },
                                { name: '<:white_dot:1323871280021110835> Saldo do Vencedor', value: userPointsData[vencedor.id].toString(), inline: true },
                                { name: '<:white_dot:1323871280021110835> Saldo do Perdedor', value: userPointsData[perdedor.id].toString(), inline: true },
                            )
                            .setColor('#FFFFFF')
                            .setTimestamp();

                        return i.update({ embeds: [resultEmbed], components: [] });
                    } else if (i.customId === 'recusar_aposta') {
                        collector.stop();
                        return i.update({ content: '<:Exclamation:1324588791989669929> ┃ A aposta foi recusada!', embeds: [], components: [] });
                    }
                });

                collector.on('end', collected => {
                    if (!collected.size) {
                        return message.edit({ content: 'A aposta foi recusada por inatividade.', components: [] });
                    }
                });
            }
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: 'Houve um erro ao processar a aposta.', ephemeral: true });
        }
    },
};
