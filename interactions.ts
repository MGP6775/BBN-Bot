import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChannelType, EmbedBuilder, GuildMember, GuildMemberRoleManager, Interaction, Message, MessageFlags, ModalBuilder, PermissionsBitField, TextChannel, TextInputBuilder, TextInputStyle, User, UserSelectMenuBuilder, VoiceChannel } from "npm:discord.js"
import { saveTranscript, findUser, lastLogin, getServerURLs, getLastDaily, addCoins, setLastDaily, getCoins, removeCoins, addPartner, removePartner, getPartners, getMemberFromBBNId } from "./db.ts";
import { createTicketChannelID, firstLevelSupportCategoryID, getStartedChannelID, ownerRoleID, secondLevelSupportCategoryID, supportRole, supportRoles, verified } from "./const.ts";

export async function handleInteraction(interaction: Interaction) {
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
                const channel = interaction.channel as TextChannel;
                interaction.reply({
                    content: `> We're closing your ticket. Please be patient. Ticket closed by ${interaction.user.tag}`,
                });

                const messages: Message[] = [];

                let message = await channel.messages
                    .fetch({ limit: 1 })
                    .then(messagePage => (messagePage.size === 1 ? messagePage.at(0) : null));

                while (message) {
                    await channel.messages
                        .fetch({ limit: 100, before: message.id })
                        .then(messagePage => {
                            messagePage.forEach(msg => messages.push(msg));
                            message = 0 < messagePage.size ? messagePage.at(messagePage.size - 1) : null;
                        });
                }
                let member;
                try {
                    member = await interaction.guild?.members.fetch(channel.name.split("-")[ 1 ]);
                    // deno-lint-ignore no-empty
                } catch (_) { }
                // deno-lint-ignore no-explicit-any
                const transcript: any = {
                    messages: [],
                    closed: `Ticket closed by ${interaction.user.tag}`,
                    with: `${member ? member.user.tag : "Unknown User"} (${channel.name.split("-")[ 1 ]})`
                };
                for (const message of messages.values()) {
                    // deno-lint-ignore no-explicit-any
                    const obj: any = {
                        author: message.author.tag,
                        authorid: message.author.id,
                        content: message.content,
                        timestamp: message.createdTimestamp,
                        avatar: message.author.displayAvatarURL(),
                    };
                    if (message.attachments.size > 0) {
                        obj.attachments = message.attachments.map(a => a.url);
                    }
                    if (message.embeds.length > 0) {
                        obj.embed = message.embeds[ 0 ].toJSON();
                    }
                    transcript.messages.push(obj);
                }
                await saveTranscript(transcript)
                await channel.delete();
                break;
            }
        }
    }

    if (interaction.isUserSelectMenu() && interaction.guild && interaction.customId === 'verify_modal') {
        const member = interaction.guild.members.cache.get(interaction.values[ 0 ])
        const role = interaction.guild.roles.cache.get(verified)

        if (member && role) {
            if (member.roles.cache.has(role.id)) {
                member.roles.remove(role, `Unverified by ${interaction.user.tag}`)
                interaction.reply(`Successfully unverified <@${interaction.values[ 0 ]}>!`)
            } else {
                member.roles.add(role, `Verified by ${interaction.user.tag}`)
                interaction.reply(`Successfully verified <@${interaction.values[ 0 ]}>!`)
            }
        } else {
            interaction.reply(`An error occured while assigning the role to <@${interaction.values[ 0 ]}>`)
        }
    }

    if (interaction.isModalSubmit()) {
        try {
            const ticket_user_reason = interaction.fields.getTextInputValue("ticket_reason");
            const dbuser = await findUser(interaction.user.id);
            const ticketname = `ticket-${interaction.user.id}`;

            const fields = [
                {
                    name: `Reason:`,
                    value: `> ${ticket_user_reason}`,
                }
            ];
            const embed = new EmbedBuilder()
                .setColor("#5539cc")
                .setTitle(`Ticket of ${interaction.user.username}`)
                .addFields(fields);
            if (dbuser) {
                const login = await lastLogin(interaction.user.id) || [];
                embed.addFields({
                    name: `User ID:`,
                    value: `> ${dbuser.toHexString()}`,
                }, {
                    name: `Server URLs:`,
                    value: `> ${await getServerURLs(interaction.user.id)}`,
                }, {
                    name: `Last Login:`,
                    value: `\`\`\`${JSON.stringify(login[ 0 ] ?? "none")}\`\`\``,
                });
                embed.setFooter({
                    text: login[ 1 ] ?? "No Login",
                    iconURL: interaction.user.displayAvatarURL(),
                })
                embed.setTimestamp(new Date(new Date().toLocaleString('en-US', { timeZone: login[ 2 ] ?? "UTC" })))
            }
            const btnrow = new ActionRowBuilder<ButtonBuilder>().addComponents([
                new ButtonBuilder()
                    .setCustomId(`close_ticket`)
                    .setStyle(ButtonStyle.Danger)
                    .setLabel(`Close Ticket`),
            ]);
            const possibleChannel = interaction.guild?.channels.cache.find(ch => ch.name === ticketname) as TextChannel;
            if (possibleChannel) {
                await possibleChannel.permissionOverwrites.create(interaction.user.id, {
                    "ViewChannel": true
                });
                await possibleChannel.send({
                    content: `${interaction.member} || <@&${supportRole}>`,
                    embeds: [ embed ],
                    components: [ btnrow ],
                });
                await interaction.reply({
                    content: `> You already have a ticket here: ${possibleChannel}`,
                    ephemeral: true,
                });
                return;
            }
            const ch = await interaction.guild!.channels.create({
                name: ticketname,
                type: ChannelType.GuildText,
                topic: `ticket of ${interaction.user.tag}`,
                parent: firstLevelSupportCategoryID,
            });

            setTimeout(() => {
                ch.permissionOverwrites.create(interaction.user.id, {
                    "ViewChannel": true
                });
            }, 5000);

            await ch.send({
                content: `${interaction.member} || <@&${supportRole}>`,
                embeds: [ embed ],
                components: [ btnrow ],
            });
            await interaction.reply({
                content: `> Successfully created your ticket here: ${ch}`,
                ephemeral: true,
            });

        } catch (e) {
            await interaction.reply({
                content: `> Error while creating your ticket. Please try again later.`,
                ephemeral: true,
            });
            console.error(e);
        }
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
        const ticketChannel = interaction.guild!.channels.cache.get(createTicketChannelID) as TextChannel;
        if (!ticketChannel) return;

        const embed = new EmbedBuilder()
            .setColor("#f55a00")
            .setTitle(`BBN - Ticket Support`)
            .setDescription(`If you have a problem or question regarding BBN, create a ticket and we will get back to you as soon as possible.\ To create a ticket click the button below.`)
            .setFooter({ text: "Provided by BBN", iconURL: "https://bbn.one/images/avatar.png" })
        const btnrow = new ActionRowBuilder<ButtonBuilder>().addComponents([
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
        if (!Array.from((interaction.member?.roles as GuildMemberRoleManager).cache.keys()).some(role => supportRoles.includes(role))) {
            interaction.reply("You do not have permission to escalate this ticket.");
            return;
        }
        // check if ticket channel
        if (!(interaction.channel?.type === ChannelType.GuildText && interaction.channel?.parent?.id === "1081347349462405221")) {
            interaction.reply("This command can only be used in a ticket channel.");
            return;
        }
        // move to escalation category
        interaction.channel?.setParent(secondLevelSupportCategoryID, {
            lockPermissions: false,
            reason: "Ticket escalated",
        });
        interaction.reply({
            allowedMentions: { roles: [ ownerRoleID ] },
            content: `Ticket escalated. || <@&${ownerRoleID}>`
        });
    }

    if (interaction.commandName === 'deescalate') {
        if (!Array.from((interaction.member?.roles as GuildMemberRoleManager).cache.keys()).some(role => supportRoles.includes(role))) {
            interaction.reply("You do not have permission to deescalate this ticket.");
            return;
        }
        // check if ticket channel
        if (!(interaction.channel?.type === ChannelType.GuildText && interaction.channel?.parent?.id === secondLevelSupportCategoryID)) {
            interaction.reply("This command can only be used in a ticket channel.");
            return;
        }
        // move to first level category
        interaction.channel?.setParent(firstLevelSupportCategoryID, {
            lockPermissions: false,
            reason: "Ticket deescalated",
        });
        interaction.reply({
            allowedMentions: { roles: [ supportRole ] },
            content: `Ticket deescalated. || <@&${supportRole}>`
        });
    }

    if (interaction.commandName === 'verify') {
        const verify_modal = new UserSelectMenuBuilder()
            .setCustomId("verify_modal")

        const row_username = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(verify_modal)

        await interaction.reply({ content: 'Which user do you want to verify?', components: [ row_username ], ephemeral: true })
    }

    if (interaction.commandName == "daily") {
        getLastDaily(interaction.user.id).then(async result => {
            if (result !== null) {
                const timeDiff = (Date.now() - result) / 3600000;
                if (timeDiff < 24) {
                    return interaction.reply(`You have already claimed your daily reward. Please wait ${Math.ceil(24 - timeDiff)} hours before claiming again.`);
                }
            }

            let reward = 10 + (Math.floor(Math.random() * 10));
            if ((await interaction.guild!.members.fetch(interaction.user.id)).premiumSince || (await interaction.guild!.members.fetch(interaction.user.id)).roles.cache.has(supportRole))
                reward *= 10;
            const res = await addCoins(interaction.user.id, reward);
            if (res === null) {
                interaction.reply("We couldn't find your account. Please [log in via Discord here](<https://bbn.one/api/@bbn/auth/redirect/discord?goal=/hosting>)");
                return;
            }
            await setLastDaily(interaction.user.id, Date.now());
            interaction.reply(`You have received ${reward} coins as your daily reward!`);
        });
    }

    if (interaction.commandName == "balance") {
        const possibleUser = interaction.options.getMentionable("user", false) as User;
        let { id } = interaction.user;
        if (possibleUser) {
            if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
                interaction.reply("You do not have permission to view other users' balances.");
                return;
            }
            id = possibleUser.id;
        }
        await getCoins(id).then(result => {
            if (result === null) {
                interaction.reply("We couldn't find your account. Please [log in via Discord here](<https://bbn.one/api/@bbn/auth/redirect/discord?goal=/hosting>)");
            } else {
                interaction.reply(`You currently have ${result} coins.`);
            }
        });
    }

    if (interaction.commandName == "addcoins") {
        if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
            interaction.reply("You do not have permission to add coins.");
            return;
        }
        const user = interaction.options.getMentionable("user", true) as User;
        const coins = interaction.options.getInteger("coins", true);
        const res = await addCoins(user.id, coins);
        if (res === null) {
            interaction.reply("We couldn't find the account in our database");
            return;
        }
        interaction.reply(`Added ${coins} coins to ${user.username}'s balance.`);
    }

    if (interaction.commandName == "removecoins") {
        if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
            interaction.reply("You do not have permission to remove coins.");
            return;
        }
        const user = interaction.options.getMentionable("user", true) as User;
        const coins = interaction.options.getInteger("coins", true);
        const res = await removeCoins(user.id, coins);
        if (res === null) {
            interaction.reply("We couldn't find the account in our database");
            return;
        }
        interaction.reply(`Removed ${coins} coins from ${user.username}'s balance.`);
    }

    if (interaction.commandName == "addpartner") {
        if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
            interaction.reply("You do not have permission to add partners.");
            return;
        }

        const user = interaction.options.getMentionable("user", true) as User;
        const dbmember = await findUser(user.id);
        if (!dbmember) {
            interaction.reply("We couldn't find an bbn account in our database");
            return;
        }

        const cpu = interaction.options.getInteger("cpu", true);
        const ram = interaction.options.getInteger("ram", true);
        const storage = interaction.options.getInteger("storage", true);
        const slots = interaction.options.getInteger("slots", true);
        const invite = await interaction.guild?.invites.create(getStartedChannelID, {
            maxAge: 0,
            unique: true,
            reason: "Partner invite",
        });
        if (!invite) {
            interaction.reply("We couldn't create an invite for the partner");
            return;
        }
        addPartner(dbmember, cpu, ram, storage, slots, invite.code);
        interaction.reply(`Added ${user.username} as a partner.\n\nFollowing resources got added: \nCPU: ${cpu} \nMemory: ${ram} \nStorage: ${storage} \nSlots: ${slots} \nInvite code: https://discord.gg/${invite.code}`);
    }

    if (interaction.commandName == "removepartner") {
        if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
            interaction.reply("You do not have permission to remove partners.");
            return;
        }
        const user = interaction.options.getMentionable("user", true) as User;
        const dbmember = await findUser(user.id);
        if (!dbmember) {
            interaction.reply("We couldn't find an bbn account in our database");
            return;
        }
        removePartner(dbmember);
        interaction.reply(`Removed ${user.username} as a partner.`);
    }

    if (interaction.commandName == "partners") {
        if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
            interaction.reply("You do not have permission to list partners.");
            return;
        }
        let out = "Owner - CPU, RAM, Storage, Slots, Invitecode, last invite, uses\n";
        const partners = await getPartners();

        await interaction.deferReply();

        out += (await Promise.all(partners.map(async partner =>
            `<@${await getMemberFromBBNId(partner.owner)}> \`${partner.owner}\` - \`${partner.cpu}\` \`${partner.memory}\` \`${partner.disk}\` \`${partner.slots}\` \`${partner.invite}\` <t:${Math.round(partner.lastinvite / 1000)}:R> \`${(await interaction.guild?.invites.fetch(partner.invite)!).uses}\``))).join("\n");

        const embed = new EmbedBuilder()
            .setTitle(`Partners`)
            .setDescription(out)
        interaction.editReply({ embeds: [ embed ] });
    }

    if (interaction.commandName == "servers") {
        if (interaction.member) {
            if (interaction.member.roles instanceof GuildMemberRoleManager) {
                if (!Array.from(interaction.member.roles.cache.keys()).some(role => supportRoles.includes(role))) {
                    interaction.reply("You do not have permission to list servers.");
                    return;
                }
            } else {
                if (!interaction.member.roles.some(role => supportRoles.includes(role))) {
                    interaction.reply("You do not have permission to list servers.");
                    return;

                }
            }
        }
        const possiblemember = interaction.options.getMentionable("user", true);
        if (!possiblemember) {
            interaction.reply("Please mention a user.");
            return;
        }
        const member = possiblemember as GuildMember;
        const servers = await getServerURLs(member.id);
        if (servers === null) {
            interaction.reply("No account found for this user.");
            return;
        }
        if (servers.length === 0) {
            interaction.reply("This user has no servers.");
            return;
        }
        interaction.reply(`Servers of ${member.user.username}:\n${servers.map(server => `<${server}>`).join("\n")}`);
    }

    if (interaction.commandName === "steam") {
        const access_token = interaction.options.getString("accesstoken");
        if (!access_token) {
            interaction.channel?.isSendable() && interaction.channel.send("Please provide a valid access token.");
            return;
        }
        const web_token = interaction.options.getString("webtoken");
        fetch(`https://api.steampowered.com/IFamilyGroupsService/GetFamilyGroupForUser/v1/?access_token=${access_token}`)
            .then(res => res.json())
            .then(data => data.response.family_groupid)
            .then(family_group_id => fetch(`https://api.steampowered.com/IFamilyGroupsService/GetSharedLibraryApps/v1/?access_token=${access_token}&include_own=true&family_groupid=${family_group_id}`))
            .then(res => res.json())
            .then(data => {
                if (data.response && data.response.apps) {
                    const apps = (data.response.apps as { owner_steamids: string[], exclude_reason: number }[]).filter(app => app.exclude_reason === 0);
                    return apps.map((app) => app.owner_steamids).reduce((prev, curr) => {
                        curr.forEach(id => {
                            prev.sum[ id ] = (prev.sum[ id ] || 0) + 1;
                        })
                        if (curr.length === 1) {
                            prev.unique[ curr[ 0 ] ] = (prev.unique[ curr[ 0 ] ] || 0) + 1;
                        }
                        return prev;
                    }, { sum: {} as Record<string, number>, unique: {} as Record<string, number>, apps: apps.length });
                } else {
                    throw new Error("Malformed response: " + JSON.stringify(data));
                }
            })
            .then(owners => fetchSteamnames(web_token, owners))
            .then(owners => {
                interaction.channel?.isSendable() && interaction.channel.send(`Here are stats about your steam family <@${interaction.member?.user.id}>:\n\n${Object.entries(owners.sum).map(([ name, count ]) => `${name}: ${count} (${owners.unique[ name ] ?? 0} unique)`).join("\n")}\nTotal: ${owners.apps} Games\nGames with only one owner: ${Object.values(owners.unique).reduce((a, b) => a + b)}`);
            })
            .catch(err => {
                console.error(err);
                interaction.channel?.isSendable() && interaction.channel.send("An error occurred while fetching the shared AppIDs.");
            });
        interaction.reply({flags: MessageFlags.Ephemeral, content: "Fetching shared AppIDs..."});
    }
}

async function fetchSteamnames(web_token: string | null, owners: { sum: Record<string, number>, unique: Record<string, number>, apps: number }) {
    if (!web_token) return owners;
    const req = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${web_token}&steamids=${Object.keys(owners.sum).join(",")}`);
    const data = await req.json()
    if (data.response && data.response.players) {
        owners.sum = Object.fromEntries(Object.entries(owners.sum).map(([ key, value ]) => [ data.response.players.find((player: any) => player.steamid === key)?.personaname ?? key, value ]))
        owners.unique = Object.fromEntries(Object.entries(owners.unique).map(([ key, value ]) => [ data.response.players.find((player: any) => player.steamid === key)?.personaname ?? key, value ]))
    }
    return owners;
}

function lockVoice(interaction: ButtonInteraction, lock: boolean) {
    const channel = (interaction.member as GuildMember).voice.channel as VoiceChannel

    if (channel) {
        channel!.setUserLimit(lock ? channel.members.size : 0)
        interaction.reply({ content: lock ? "Successfully locked your voice channel!" : "Successfully unlocked your voice channel!", ephemeral: true })
    } else
        interaction.reply({ content: "You have to be in a voice channel!", ephemeral: true })
}