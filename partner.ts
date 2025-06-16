import { Client, Collection, GuildMember, Invite, TextChannel } from "npm:discord.js";
import { getMemberFromBBNId, getPartnerFromInvite, updateLastInvite } from "./db.ts";
import { defaultEmbed } from "./helper.ts";
import { guildID, logChannelID } from "./const.ts";

export class PartnerManager {

    client: Client;
    constructor(client: Client) {
        this.client = client;
    }

    invites: Collection<string, Invite> = new Collection();
    async cacheInvites() {
        const guild = await this.client.guilds.fetch(guildID);
        const invites = await guild.invites.fetch({
            cache: false
        });
        this.invites = invites;
        console.log('Cached invites');
    }

    async getLastInvite() {
        const guild = await this.client.guilds.fetch(guildID);
        const invites = await guild.invites.fetch({
            cache: false
        });
        const invite = invites.find(i => this.invites.get(i.code)!.uses! !== i.uses!);
        if (!invite) return null;
        return invite.code;
    }

    async onMember(member: GuildMember, action: 'join' | 'leave') {
        let invitetext = '';
        const lastinvite = await this.getLastInvite();
        if (lastinvite) {
            const partner = await getPartnerFromInvite(lastinvite);
            if (partner) {
                updateLastInvite(partner.owner);
                const partnermember = await getMemberFromBBNId(partner.owner);
                invitetext = partnermember ? `<@${partnermember}> (BBN ID: ${partner.owner}) using code ${lastinvite}` : `No member found for partner ${partner.owner} using code ${lastinvite}`;
            }
            else invitetext = `No partner found using code ${lastinvite}`;
        }
        else invitetext = 'No invite found';

        const embed = defaultEmbed(member.user);
        embed.setTitle(`${member.user.tag} ${action === 'join' ? 'joined' : 'left'}`)
            .setColor(action === 'join' ? '#FEE75C' : '#F57F7F')
            .setDescription(invitetext);
        member.guild.channels.fetch(logChannelID).then(channel => (channel as TextChannel).send({ embeds: [ embed ] }));
    }
}