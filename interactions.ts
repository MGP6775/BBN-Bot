import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChannelType, EmbedBuilder, GuildMember, GuildMemberRoleManager, Interaction, ModalBuilder, PermissionsBitField, TextChannel, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder, VoiceChannel } from "discord.js"
import DB from "./db";

export async function handleInteraction(interaction: Interaction, db: DB) {

    if (interaction.isButton()) {
        switch (interaction.customId) {
            case "lock": {
                lockVoice(interaction, true)
                break;
            }
            case "unlock": {
                lockVoice(interaction, false)
                break;
            }
            case "create_ticket": {
                const ticket_modal = new ModalBuilder()
                    .setTitle("Kindly enter this information.")
                    .setCustomId("ticket_modal");

                const user_reason = new TextInputBuilder()
                    .setCustomId("ticket_reason")
                    .setLabel(`Why do you want to open a ticket?`)
                    .setRequired(true)
                    .setStyle(TextInputStyle.Paragraph);

                const row_user_reason = new ActionRowBuilder<TextInputBuilder>().addComponents(user_reason);
                ticket_modal.addComponents(row_user_reason);

                await interaction.showModal(ticket_modal);
                break;
            }
            case "close_ticket": {
                let channel = interaction.channel as TextChannel;
                interaction.reply({
                    content: `> We're closing your ticket. Please be patient.`,
                });

                if (![ "401817301919465482", "261083609148948488" ].includes(interaction.user.id)) {
                    channel.setParent("1124263122895646802", { lockPermissions: true, reason: "Ticket closed by " + interaction.user.tag })
                    break;
                }
                const messages = await channel.messages.fetch();
                let member;
                try {
                    member = await interaction.guild?.members.fetch(channel.name.split("-")[ 1 ]);
                } catch (e) { }
                const transcript: any = {
                    messages: [],
                    closed: "Ticket closed by " + interaction.user.tag,
                    with: `${member ? member.user.tag : "Unknown User"} (${channel.name.split("-")[ 1 ]})`
                };
                for (const message of messages.values()) {
                    const obj: any = {
                        author: message.author.tag,
                        authorid: message.author.id,
                        content: message.content,
                        timestamp: message.createdTimestamp,
                        avatar: message.author.displayAvatarURL(),
                    };
                    if (message.attachments.size > 0) {
                        obj.attachments = message.attachments.map((a) => a.url);
                    }
                    if (message.embeds.length > 0) {
                        obj.embed = message.embeds[ 0 ].toJSON();
                    }
                    transcript.messages.push(obj);
                }
                await db.saveTranscript(transcript)
                await channel.delete();
                break;
            }
        }
    }

    if (interaction.isUserSelectMenu() && interaction.guild && interaction.customId === 'verify_modal') {
        const member = interaction.guild.members.cache.get(interaction.values[ 0 ])
        const role = interaction.guild.roles.cache.get("757983851032215673")

        if (member && role) {
            if (member.roles.cache.has(role.id)) {
                member.roles.remove(role, "Unverified by " + interaction.user.tag)
                interaction.reply("Successfully unverified <@" + interaction.values[ 0 ] + ">!")
            } else {
                member.roles.add(role, "Verified by " + interaction.user.tag)
                interaction.reply("Successfully verified <@" + interaction.values[ 0 ] + ">!")
            }
        } else {
            interaction.reply("An error occured while assigning the role to <@" + interaction.values[ 0 ] + ">")
        }
    }

    if (interaction.isModalSubmit()) {
        const ticket_user_reason = interaction.fields.getTextInputValue("ticket_reason");
        const dbuser = await db.finduser(interaction.user.id);
        let ticketname = `ticket-${interaction.user.id}`;
        await interaction.guild!.channels
            .create({
                name: ticketname,
                type: ChannelType.GuildText,
                topic: `ticket of ${interaction.user.tag}`,
                parent: "1081347349462405221",

            })
            .then(async (ch: TextChannel) => {
                const fields = [
                    {
                        name: `Reason:`,
                        value: `> ${ticket_user_reason}`,
                    }
                ];
                let embed = new EmbedBuilder()
                    .setColor("#5539cc")
                    .setTitle(`Ticket of ${interaction.user.username}`)
                    .addFields(fields);
                if (dbuser) {
                    const login = await db.lastLogin(interaction.user.id) || [];
                    embed.addFields({
                        name: `User ID:`,
                        value: `> ${dbuser.toHexString()}`,
                    }, {
                        name: `Server URLs:`,
                        value: `> ${await db.getServerURLs(interaction.user.id)}`,
                    }, {
                        name: `Last Login:`,
                        value: '```' + JSON.stringify(login[ 0 ]) + '```',
                    });
                    embed.setFooter({
                        text: login[ 1 ] ?? "No Login" as string,
                        iconURL: interaction.user.displayAvatarURL(),
                    })
                    embed.setTimestamp(new Date(new Date().toLocaleString('en-US', { timeZone: login[ 2 ] ?? "UTC" })))
                }


                setTimeout(() => {
                    ch.permissionOverwrites.create(interaction.user.id, {
                        "ViewChannel": true
                    }).then((channel) => {

                    }, (err) => {
                        console.log(err);
                    });
                }, 1000);

                let btnrow = new ActionRowBuilder<ButtonBuilder>().addComponents([
                    new ButtonBuilder()
                        .setCustomId(`close_ticket`)
                        .setStyle(ButtonStyle.Danger)
                        .setLabel(`Close Ticket`),
                ]);
                ch.send({
                    content: `${interaction.member} || <@&1120392307087261787>`,
                    embeds: [ embed ],
                    components: [ btnrow ],
                });
                interaction.reply({
                    content: `> Successfully created your ticket here: ${ch}`,
                    ephemeral: true,
                });
            });
    }

    if (!interaction.isChatInputCommand()) return

    if (interaction.commandName === 'setup') {
        // const channel = interaction.guild?.channels.cache.get("757992735171936347") as TextChannel

        // const embed = new EmbedBuilder()
        //     .setTitle("Voicelocker")
        //     .setDescription("🔒 - Lock Voice Channel\n\n🔓 - Unlock Voice Channel")
        //     .setFooter({ text: "Provided by BBN", iconURL: "https://bbn.one/images/avatar.png" })
        //     .setColor('#f55a00')

        // const builder = new ActionRowBuilder<ButtonBuilder>().addComponents([
        //     new ButtonBuilder()
        //         .setCustomId(`lock`)
        //         .setStyle(ButtonStyle.Success)
        //         .setEmoji("🔒")
        //         .setLabel(`Lock`),
        //     new ButtonBuilder()
        //         .setCustomId(`unlock`)
        //         .setStyle(ButtonStyle.Danger)
        //         .setEmoji("🔓")
        //         .setLabel(`Unlock`),
        // ])

        // channel.send({
        //     embeds: [ embed ],
        //     components: [ builder ]
        // })

        // interaction.reply("message sent!")

        // code
        let ticketChannel = interaction.guild!.channels.cache.get("1081337337704886392") as TextChannel;
        if (!ticketChannel) return;

        let embed = new EmbedBuilder()
            .setColor("#f55a00")
            .setTitle(`BBN - Ticket Support`)
            .setDescription(`If you have a problem or question regarding BBN, create a ticket and we will get back to you as soon as possible.\ To create a ticket click the button below.`)
            .setFooter({ text: "Provided by BBN", iconURL: "https://bbn.one/images/avatar.png" })
        let btnrow = new ActionRowBuilder<ButtonBuilder>().addComponents([
            new ButtonBuilder()
                .setCustomId("create_ticket")
                .setStyle(ButtonStyle.Success)
                .setLabel("Create Ticket")

        ]);
        await ticketChannel.send({
            embeds: [ embed ],
            components: [ btnrow ],
        });

        interaction.reply({
            content: `Ticket System Setup in ${ticketChannel}`,
        });
    }

    if (interaction.commandName === 'escalate') {
        if (!(interaction.member?.roles as GuildMemberRoleManager).cache.has("1120392307087261787")) {
            interaction.reply("You do not have permission to escalate this ticket.");
            return;
        }
        // check if ticket channel
        if (!(interaction.channel?.type === ChannelType.GuildText && interaction.channel?.parent?.id === "1081347349462405221")) {
            interaction.reply("This command can only be used in a ticket channel.");
            return;
        }
        // move to escalation category
        interaction.channel?.setParent("1120395441138315345", {
            lockPermissions: false,
            reason: "Ticket escalated",
        });
        interaction.reply({
            allowedMentions: { roles: [ '757969277063266407' ] },
            content: "Ticket escalated. || <@&757969277063266407>"
        });
    }

    if (interaction.commandName === 'verify') {
        const verify_modal = new UserSelectMenuBuilder()
            .setCustomId("verify_modal")

        const row_username = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(verify_modal)

        await interaction.reply({ content: 'Which user do you want to verify?', components: [ row_username ], ephemeral: true })
    }

    if (interaction.commandName == "daily") {
        // Check if the user has already claimed their daily reward
        db.getLastDaily(interaction.user.id).then(async result => {
            if (result !== null) {
                // Calculate the time difference in hours
                const timeDiff = (Date.now() - result) / 3600000;
                if (timeDiff < 24) {
                    // Calculate the number of hours
                    return interaction.reply(`You have already claimed your daily reward. Please wait ${Math.ceil(24 - timeDiff)} hours before claiming again.`);
                }
            }

            // Give the user their daily reward
            const reward = 10 + (Math.floor(Math.random() * 10));
            const res = (await db.addCoins(interaction.user.id, reward));
            if (res === null) {
                interaction.reply("We couldn't find your account. Please [log in via Discord here](<https://bbn.one/api/@bbn/auth/redirect/discord?goal=/hosting>)");
                return;
            }
            await db.setLastDaily(interaction.user.id, Date.now());
            interaction.reply(`You have received ${reward} coins as your daily reward!`);
        });
    }

    if (interaction.commandName == "balance") {
        // Retrieve the user's balance from the database
        const possiblemember = interaction.options.getMentionable("user", false);
        let id = interaction.user.id;
        if (possiblemember) {
            if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
                interaction.reply("You do not have permission to view other users' balances.");
                return;
            }
            const member = possiblemember as GuildMember;
            id = member.id;
        }
        await db.getCoins(id).then(result => {
            if (result !== null) {
                interaction.reply(`You currently have ${result} coins.`);
            } else {
                interaction.reply("We couldn't find your account. Please [log in via Discord here](<https://bbn.one/api/@bbn/auth/redirect/discord?goal=/hosting>)");
            }
        });
    }

    if (interaction.commandName == "addcoins") {
        if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
            interaction.reply("You do not have permission to add coins.");
            return;
        }
        const member = interaction.options.getMentionable("user", true) as GuildMember;
        const coins = interaction.options.getInteger("coins", true);
        const res = await db.addCoins(member.id, coins);
        if (res === null) {
            interaction.reply("We couldn't find the account in our database");
            return;
        }
        interaction.reply(`Added ${coins} coins to ${member.user.username}'s balance.`);
    }

    if (interaction.commandName == "removecoins") {
        if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
            interaction.reply("You do not have permission to remove coins.");
            return;
        }
        const member = interaction.options.getMentionable("user", true) as GuildMember;
        const coins = interaction.options.getInteger("coins", true);
        const res = await db.removeCoins(member.id, coins);
        if (res === null) {
            interaction.reply("We couldn't find the account in our database");
            return;
        }
        interaction.reply(`Removed ${coins} coins from ${member.user.username}'s balance.`);
    }


}

function lockVoice(interaction: ButtonInteraction, lock: boolean) {
    const channel = (interaction.member as GuildMember).voice.channel as VoiceChannel

    if (channel) {
        channel!.setUserLimit(lock ? channel.members.size : 0)
        interaction.reply({ content: lock ? "Successfully locked your voice channel!" : "Successfully unlocked your voice channel!", ephemeral: true })
    } else
        interaction.reply({ content: "You have to be in a voice channel!", ephemeral: true })
}