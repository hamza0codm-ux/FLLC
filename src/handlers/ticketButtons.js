// src/handlers/ticketButtons.js

import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
} from 'discord.js';

import {
  createEmbed,
  successEmbed,
} from '../utils/embeds.js';

import {
  createTicket,
  closeTicket,
  claimTicket,
  updateTicketPriority,
  getUserTicketCount,
} from '../services/ticket.js';

import {
  getGuildConfig,
} from '../services/config/guildConfig.js';

import {
  logger,
} from '../utils/logger.js';

import {
  InteractionHelper,
} from '../utils/interactionHelper.js';

import {
  checkRateLimit,
} from '../utils/rateLimiter.js';

import {
  replyUserError,
  ErrorTypes,
  handleInteractionError,
  createError,
} from '../utils/errorHandler.js';

import {
  getTicketPermissionContext,
} from '../utils/ticket/ticketPermissions.js';


/*
|--------------------------------------------------------------------------
| Guild Context
|--------------------------------------------------------------------------
*/

async function ensureGuildContext(interaction) {
  if (interaction.inGuild()) {
    return true;
  }

  if (!interaction.replied && !interaction.deferred) {
    await replyUserError(interaction, {
      type: ErrorTypes.UNKNOWN,
      message:
        'This action can only be used in a server.',
    });
  }

  return false;
}


/*
|--------------------------------------------------------------------------
| Ticket Permission Check
|--------------------------------------------------------------------------
*/

async function assertTicketPermission(
  interaction,
  client,
  actionLabel,
  options = {},
  timeoutMs = 2500
) {
  const {
    allowTicketCreator = false,
  } = options;

  let context;

  try {
    const contextPromise =
      getTicketPermissionContext({
        client,
        interaction,
      });

    const timeoutPromise =
      new Promise((_, reject) =>
        setTimeout(
          () => reject(
            new Error('Timeout')
          ),
          timeoutMs
        )
      );

    context = await Promise.race([
      contextPromise,
      timeoutPromise,
    ]);
  } catch (error) {
    if (error.message === 'Timeout') {
      throw createError(
        'Ticket permission timeout',
        ErrorTypes.RATE_LIMIT,
        'The permission check took too long. Please try again.'
      );
    }

    throw createError(
      'Ticket permission check failed',
      ErrorTypes.UNKNOWN,
      `Failed to check permissions: ${error.message}`
    );
  }

  if (!context.ticketData) {
    throw createError(
      'Not a ticket channel',
      ErrorTypes.VALIDATION,
      'This action can only be used in a valid ticket channel.'
    );
  }

  const allowed = allowTicketCreator
    ? context.canCloseTicket
    : context.canManageTicket;

  if (!allowed) {
    const permissionMessage =
      allowTicketCreator
        ? 'You must have **Manage Channels**, the configured **Ticket Staff Role**, or be the **ticket creator**.'
        : 'You must have **Manage Channels** or the configured **Ticket Staff Role**.';

    throw createError(
      'Ticket permission denied',
      ErrorTypes.PERMISSION,
      `${permissionMessage}\n\nYou cannot ${actionLabel}.`
    );
  }

  return context;
}


/*
|--------------------------------------------------------------------------
| Simple Ticket Permission Check
|--------------------------------------------------------------------------
*/

async function ensureTicketPermission(
  interaction,
  client,
  actionLabel,
  options = {}
) {
  const {
    allowTicketCreator = false,
  } = options;

  const context =
    await getTicketPermissionContext({
      client,
      interaction,
    });

  if (!context.ticketData) {
    await replyUserError(
      interaction,
      {
        type: ErrorTypes.UNKNOWN,
        message:
          'This action can only be used in a valid ticket channel.',
      }
    );

    return null;
  }

  const allowed = allowTicketCreator
    ? context.canCloseTicket
    : context.canManageTicket;

  if (!allowed) {
    const permissionMessage =
      allowTicketCreator
        ? 'You must have **Manage Channels**, the configured **Ticket Staff Role**, or be the **ticket creator**.'
        : 'You must have **Manage Channels** or the configured **Ticket Staff Role**.';

    await replyUserError(
      interaction,
      {
        type: ErrorTypes.PERMISSION,
        message:
          `${permissionMessage}\n\nYou cannot ${actionLabel}.`,
      }
    );

    return null;
  }

  return context;
}


/*
|--------------------------------------------------------------------------
| Get Ticket Panel + Ticket Type
|--------------------------------------------------------------------------
|
| Dynamic imports are intentional.
|
| ticketButtons.js is imported by the ticket panel files, so importing
| the panel files statically here can create a circular dependency.
|--------------------------------------------------------------------------
*/

async function getTicketPanelAndType(
  panelKey,
  ticketTypeKey
) {
  if (panelKey === 'normal') {
    const {
      NORMAL_TICKET_CONFIG,
      getNormalTicketType,
    } = await import(
      '../tickets/normalTickets.js'
    );

    return {
      panel: NORMAL_TICKET_CONFIG,
      ticketType:
        getNormalTicketType(
          ticketTypeKey
        ),
    };
  }

  if (panelKey === 'merch') {
    const {
      MERCH_TICKET_CONFIG,
      getMerchTicketType,
    } = await import(
      '../tickets/merchTickets.js'
    );

    return {
      panel: MERCH_TICKET_CONFIG,
      ticketType:
        getMerchTicketType(
          ticketTypeKey
        ),
    };
  }

  return {
    panel: null,
    ticketType: null,
  };
}


/*
|--------------------------------------------------------------------------
| CREATE TICKET BUTTON
|--------------------------------------------------------------------------
*/

const createTicketHandler = {
  name: 'create_ticket',

  async execute(
    interaction,
    client,
    args = []
  ) {
    try {
      if (
        !(await ensureGuildContext(
          interaction
        ))
      ) {
        return;
      }

      /*
      |--------------------------------------------------------------------------
      | Button arguments
      |--------------------------------------------------------------------------
      |
      | Normal:
      | create_ticket:normal:fruity_application
      |
      | Merch:
      | create_ticket:merch:returns
      |
      */

      const panelKey = args?.[0];
      const ticketTypeKey = args?.[1];

      if (
        !panelKey ||
        !ticketTypeKey
      ) {
        await replyUserError(
          interaction,
          {
            type: ErrorTypes.VALIDATION,
            message:
              'This ticket button is missing required information.',
          }
        );

        return;
      }

      const {
        panel,
        ticketType,
      } = await getTicketPanelAndType(
        panelKey,
        ticketTypeKey
      );

      if (!panel || !ticketType) {
        await replyUserError(
          interaction,
          {
            type: ErrorTypes.VALIDATION,
            message:
              'This ticket option is no longer available.',
          }
        );

        return;
      }

      /*
      |--------------------------------------------------------------------------
      | Rate Limit
      |--------------------------------------------------------------------------
      */

      const rateLimitKey =
        `${interaction.user.id}:create_ticket`;

      const allowed =
        await checkRateLimit(
          rateLimitKey,
          3,
          60000
        );

      if (!allowed) {
        await replyUserError(
          interaction,
          {
            type: ErrorTypes.RATE_LIMIT,
            message:
              'You are creating tickets too quickly. Please wait a minute and try again.',
          }
        );

        return;
      }

      /*
      |--------------------------------------------------------------------------
      | Ticket Creation Modal
      |--------------------------------------------------------------------------
      |
      | Do not query the database here.
      |
      | The button interaction needs to open the modal immediately.
      | Ticket-limit checking is performed when the modal is submitted.
      |--------------------------------------------------------------------------
      */

      const modal =
        new ModalBuilder()
          .setCustomId(
            `create_ticket_modal:${panelKey}:${ticketTypeKey}`
          )
          .setTitle(
            `Create ${ticketType.label} Ticket`
          );

      const reasonInput =
        new TextInputBuilder()
          .setCustomId('reason')
          .setLabel(
            'Why are you creating this ticket?'
          )
          .setStyle(
            TextInputStyle.Paragraph
          )
          .setPlaceholder(
            'Describe your issue...'
          )
          .setRequired(true)
          .setMaxLength(1000);

      const actionRow =
        new ActionRowBuilder()
          .addComponents(
            reasonInput
          );

      modal.addComponents(
        actionRow
      );

      /*
      |--------------------------------------------------------------------------
      | Register Modal Handler
      |--------------------------------------------------------------------------
      |
      | The button interaction and modal submission are separate Discord
      | interactions.
      |
      | interactionCreate.js resolves modal handlers through client.modals.
      |
      */

      if (client?.modals?.set) {
        client.modals.set(
          createTicketModalHandler.name,
          createTicketModalHandler
        );
      }

      await interaction.showModal(
        modal
      );

    } catch (error) {
      logger.error(
        'Error creating ticket modal:',
        error
      );

      if (
        !interaction.replied &&
        !interaction.deferred
      ) {
        await replyUserError(
          interaction,
          {
            type:
              error?.type ||
              ErrorTypes.UNKNOWN,
            message:
              error?.userMessage ||
              'Could not open ticket creation form.',
          }
        );
      }
    }
  },
};


/*
|--------------------------------------------------------------------------
| CREATE TICKET MODAL
|--------------------------------------------------------------------------
*/

const createTicketModalHandler = {
  name: 'create_ticket_modal',

  async execute(
    interaction,
    client
  ) {
    try {
      if (
        !(await ensureGuildContext(
          interaction
        ))
      ) {
        return;
      }

      /*
      |--------------------------------------------------------------------------
      | Read Panel + Ticket Type
      |--------------------------------------------------------------------------
      */

      const parts =
        interaction.customId.split(':');

      const panelKey =
        parts[1];

      const ticketTypeKey =
        parts[2];

      if (
        !panelKey ||
        !ticketTypeKey
      ) {
        throw createError(
          'Missing ticket modal arguments',
          ErrorTypes.VALIDATION,
          'This ticket form is missing required information.'
        );
      }

      const {
        panel,
        ticketType,
      } = await getTicketPanelAndType(
        panelKey,
        ticketTypeKey
      );

      if (!panel || !ticketType) {
        await replyUserError(
          interaction,
          {
            type: ErrorTypes.VALIDATION,
            message:
              'This ticket type is no longer available.',
          }
        );

        return;
      }

      /*
      |--------------------------------------------------------------------------
      | Defer
      |--------------------------------------------------------------------------
      */

      const deferSuccess =
        await InteractionHelper.safeDefer(
          interaction,
          {
            flags:
              MessageFlags.Ephemeral,
          }
        );

      if (!deferSuccess) {
        return;
      }

      /*
      |--------------------------------------------------------------------------
      | Maximum Open Tickets
      |--------------------------------------------------------------------------
      */

      const config =
        await getGuildConfig(
          client,
          interaction.guildId
        );

      const maxTicketsPerUser =
        Number(
          config?.maxTicketsPerUser
        ) || 3;

      const currentTicketCount =
        await getUserTicketCount(
          interaction.guildId,
          interaction.user.id
        );

      if (
        currentTicketCount >=
        maxTicketsPerUser
      ) {
        await interaction.editReply({
          embeds: [
            createEmbed({
              title:
                'Ticket Limit Reached',
              description:
                `You have reached the maximum number of open tickets (${maxTicketsPerUser}).\n\n` +
                'Please close one of your existing tickets before creating a new one.\n\n' +
                `**Current Tickets:** ${currentTicketCount}/${maxTicketsPerUser}`,
              color:
                '#e74c3c',
            }),
          ],
        });

        return;
      }

      /*
      |--------------------------------------------------------------------------
      | Reason
      |--------------------------------------------------------------------------
      */

      const reason =
        interaction.fields
          .getTextInputValue(
            'reason'
          )
          ?.trim() ||
        'No reason provided.';

      /*
      |--------------------------------------------------------------------------
      | CREATE TICKET
      |--------------------------------------------------------------------------
      |
      | services/ticket.js expects:
      |
      | createTicket(
      |   guild,
      |   member,
      |   categoryId,
      |   reason,
      |   priority,
      |   options
      | )
      |
      |--------------------------------------------------------------------------
      */

      const {
        channel,
      } = await createTicket(
        interaction.guild,
        interaction.member,
        panel.categoryId,
        reason,
        undefined,
        {
          panelType:
            panel.key ||
            panel.id ||
            panelKey,

          ticketType:
            ticketType.label,

          ticketTypeKey:
            ticketType.key ||
            ticketTypeKey,

          ticketLogsChannelId:
            panel.ticketLogsChannelId,

          transcriptLogsChannelId:
            panel.transcriptLogsChannelId,

          reviewLogsChannelId:
            panel.reviewLogsChannelId,

          staffRoleId:
            panel.staffRoleId,

          teamText:
            panel.teamText,
        }
      );

      if (!channel) {
        throw createError(
          'Ticket channel was not created',
          ErrorTypes.UNKNOWN,
          'The ticket channel could not be created. Please try again.'
        );
      }

      /*
      |--------------------------------------------------------------------------
      | Success
      |--------------------------------------------------------------------------
      */

      await interaction.editReply({
        embeds: [
          successEmbed(
            'Ticket Created',
            `Your ticket has been created in ${channel}!`
          ),
        ],
      });

    } catch (error) {
      logger.error(
        'Error creating ticket:',
        error
      );

      await handleInteractionError(
        interaction,
        error,
        {
          type: 'modal',
          handler:
            'create_ticket_modal',
          customId:
            interaction.customId,
        }
      );
    }
  },
};


/*
|--------------------------------------------------------------------------
| CLOSE TICKET BUTTON
|--------------------------------------------------------------------------
*/

const closeTicketHandler = {
  name: 'ticket_close',

  async execute(
    interaction,
    client
  ) {
    try {
      if (
        !(await ensureGuildContext(
          interaction
        ))
      ) {
        return;
      }

      await assertTicketPermission(
        interaction,
        client,
        'close this ticket',
        {
          allowTicketCreator: true,
        },
        2000
      );

      const modal =
        new ModalBuilder()
          .setCustomId(
            'ticket_close_modal'
          )
          .setTitle(
            'Close Ticket'
          );

      const reasonInput =
        new TextInputBuilder()
          .setCustomId('reason')
          .setLabel(
            'Reason for closing (optional)'
          )
          .setStyle(
            TextInputStyle.Paragraph
          )
          .setPlaceholder(
            'Add an optional reason for closing this ticket...'
          )
          .setRequired(false)
          .setMaxLength(1000);

      modal.addComponents(
        new ActionRowBuilder()
          .addComponents(
            reasonInput
          )
      );

      /*
      |--------------------------------------------------------------------------
      | Register Close Modal Handler
      |--------------------------------------------------------------------------
      */

      if (client?.modals?.set) {
        client.modals.set(
          closeTicketModalHandler.name,
          closeTicketModalHandler
        );
      }

      await interaction.showModal(
        modal
      );

    } catch (error) {
      logger.error(
        'Error closing ticket:',
        error
      );

      if (
        !interaction.replied &&
        !interaction.deferred
      ) {
        await replyUserError(
          interaction,
          {
            type:
              error?.type ||
              ErrorTypes.UNKNOWN,
            message:
              error?.userMessage ||
              'Could not open ticket close form.',
          }
        );
      }
    }
  },
};


/*
|--------------------------------------------------------------------------
| CLOSE TICKET MODAL
|--------------------------------------------------------------------------
*/

const closeTicketModalHandler = {
  name: 'ticket_close_modal',

  async execute(
    interaction,
    client
  ) {
    try {
      if (
        !(await ensureGuildContext(
          interaction
        ))
      ) {
        return;
      }

      await assertTicketPermission(
        interaction,
        client,
        'close this ticket',
        {
          allowTicketCreator: true,
        },
        2000
      );

      const deferSuccess =
        await InteractionHelper.safeDefer(
          interaction,
          {
            flags:
              MessageFlags.Ephemeral,
          }
        );

      if (!deferSuccess) {
        return;
      }

      const providedReason =
        interaction.fields
          .getTextInputValue(
            'reason'
          )
          ?.trim();

      const reason =
        providedReason ||
        'Closed via ticket button without a specific reason.';

      await closeTicket(
        interaction.channel,
        interaction.user,
        reason
      );

      await interaction.editReply({
        embeds: [
          successEmbed(
            'Ticket Closed',
            'This ticket has been closed.'
          ),
        ],
      });

    } catch (error) {
      logger.error(
        'Error submitting close ticket modal:',
        error
      );

      if (
        !interaction.replied &&
        !interaction.deferred
      ) {
        await replyUserError(
          interaction,
          {
            type:
              error?.type ||
              ErrorTypes.UNKNOWN,
            message:
              error?.userMessage ||
              'An error occurred while closing the ticket.',
          }
        );
      } else {
        try {
          await interaction.editReply({
            embeds: [
              createEmbed({
                title:
                  'Ticket Error',
                description:
                  error?.userMessage ||
                  'An error occurred while closing the ticket.',
                color:
                  '#e74c3c',
              }),
            ],
          });
        } catch {
          // Interaction may already be closed.
        }
      }
    }
  },
};


/*
|--------------------------------------------------------------------------
| CLAIM TICKET
|--------------------------------------------------------------------------
*/

const claimTicketHandler = {
  name: 'ticket_claim',

  async execute(
    interaction,
    client
  ) {
    try {
      if (
        !(await ensureGuildContext(
          interaction
        ))
      ) {
        return;
      }

      await assertTicketPermission(
        interaction,
        client,
        'claim tickets',
        {},
        2000
      );

      const deferSuccess =
        await InteractionHelper.safeDefer(
          interaction,
          {
            flags:
              MessageFlags.Ephemeral,
          }
        );

      if (!deferSuccess) {
        return;
      }

      await claimTicket(
        interaction.channel,
        interaction.user
      );

      await interaction.editReply({
        embeds: [
          successEmbed(
            'Ticket Claimed',
            'You have claimed this ticket.'
          ),
        ],
      });

    } catch (error) {
      logger.error(
        'Error claiming ticket:',
        error
      );

      if (
        !interaction.replied &&
        !interaction.deferred
      ) {
        await replyUserError(
          interaction,
          {
            type:
              error?.type ||
              ErrorTypes.UNKNOWN,
            message:
              error?.userMessage ||
              'An error occurred while claiming the ticket.',
          }
        );
      } else if (
        interaction.deferred
      ) {
        await replyUserError(
          interaction,
          {
            type:
              error?.type ||
              ErrorTypes.UNKNOWN,
            message:
              error?.userMessage ||
              'An error occurred while claiming the ticket.',
          }
        );
      }
    }
  },
};


/*
|--------------------------------------------------------------------------
| PRIORITY BUTTON
|--------------------------------------------------------------------------
|
| Clicking Priority opens:
|
| ⚪ None
| 🟢 Low
| 🟡 Medium
| 🔴 High
| 🚨 Urgent
|
*/

const priorityTicketHandler = {
  name: 'ticket_priority',

  async execute(
    interaction,
    client
  ) {
    try {
      if (
        !(await ensureGuildContext(
          interaction
        ))
      ) {
        return;
      }

      await assertTicketPermission(
        interaction,
        client,
        'change ticket priority',
        {},
        2000
      );

      const priorityMenu =
        new StringSelectMenuBuilder()
          .setCustomId(
            'ticket_priority_menu'
          )
          .setPlaceholder(
            'Select ticket priority'
          )
          .addOptions(
            {
              label: 'None',
              description:
                'Remove the current priority.',
              value: 'none',
              emoji: '⚪',
            },
            {
              label: 'Low',
              description:
                'Set the ticket to low priority.',
              value: 'low',
              emoji: '🟢',
            },
            {
              label: 'Medium',
              description:
                'Set the ticket to medium priority.',
              value: 'medium',
              emoji: '🟡',
            },
            {
              label: 'High',
              description:
                'Set the ticket to high priority.',
              value: 'high',
              emoji: '🔴',
            },
            {
              label: 'Urgent',
              description:
                'Set the ticket to urgent priority.',
              value: 'urgent',
              emoji: '🚨',
            }
          );

      const row =
        new ActionRowBuilder()
          .addComponents(
            priorityMenu
          );

      await interaction.reply({
        content:
          'Select the priority for this ticket:',
        components: [row],
        flags:
          MessageFlags.Ephemeral,
      });

    } catch (error) {
      logger.error(
        'Error opening ticket priority menu:',
        error
      );

      if (
        !interaction.replied &&
        !interaction.deferred
      ) {
        await replyUserError(
          interaction,
          {
            type:
              error?.type ||
              ErrorTypes.UNKNOWN,
            message:
              error?.userMessage ||
              'Could not open the priority menu.',
          }
        );
      }
    }
  },
};


/*
|--------------------------------------------------------------------------
| UNCLAIM TICKET
|--------------------------------------------------------------------------
*/

const unclaimTicketHandler = {
  name: 'ticket_unclaim',

  async execute(
    interaction,
    client
  ) {
    try {
      if (
        !(await ensureGuildContext(
          interaction
        ))
      ) {
        return;
      }

      await assertTicketPermission(
        interaction,
        client,
        'unclaim tickets',
        {},
        2000
      );

      const deferSuccess =
        await InteractionHelper.safeDefer(
          interaction,
          {
            flags:
              MessageFlags.Ephemeral,
          }
        );

      if (!deferSuccess) {
        return;
      }

      const {
        unclaimTicket,
      } = await import(
        '../services/ticket.js'
      );

      await unclaimTicket(
        interaction.channel,
        interaction.member
      );

      await interaction.editReply({
        embeds: [
          successEmbed(
            'Ticket Unclaimed',
            'This ticket has been unclaimed.'
          ),
        ],
      });

    } catch (error) {
      logger.error(
        'Error unclaiming ticket:',
        error
      );

      if (
        !interaction.replied &&
        !interaction.deferred
      ) {
        await replyUserError(
          interaction,
          {
            type:
              error?.type ||
              ErrorTypes.UNKNOWN,
            message:
              error?.userMessage ||
              'An error occurred while unclaiming the ticket.',
          }
        );
      } else if (
        interaction.deferred
      ) {
        await replyUserError(
          interaction,
          {
            type:
              error?.type ||
              ErrorTypes.UNKNOWN,
            message:
              error?.userMessage ||
              'An error occurred while unclaiming the ticket.',
          }
        );
      }
    }
  },
};


/*
|--------------------------------------------------------------------------
| REOPEN TICKET
|--------------------------------------------------------------------------
*/

const reopenTicketHandler = {
  name: 'ticket_reopen',

  async execute(
    interaction,
    client
  ) {
    try {
      if (
        !(await ensureGuildContext(
          interaction
        ))
      ) {
        return;
      }

      await assertTicketPermission(
        interaction,
        client,
        'reopen tickets',
        {},
        2000
      );

      const deferSuccess =
        await InteractionHelper.safeDefer(
          interaction,
          {
            flags:
              MessageFlags.Ephemeral,
          }
        );

      if (!deferSuccess) {
        return;
      }

      const {
        reopenTicket,
      } = await import(
        '../services/ticket.js'
      );

      const {
        movedToOpenCategory,
        openCategoryMoveFailed,
      } = await reopenTicket(
        interaction.channel,
        interaction.member
      );

      let reopenMessage =
        'This ticket has been reopened.';

      if (
        openCategoryMoveFailed
      ) {
        reopenMessage +=
          ' Note: Could not move the channel back to the open tickets category.';
      }

      await interaction.editReply({
        embeds: [
          successEmbed(
            'Ticket Reopened',
            reopenMessage
          ),
        ],
      });

    } catch (error) {
      logger.error(
        'Error reopening ticket:',
        error
      );

      if (
        !interaction.replied &&
        !interaction.deferred
      ) {
        await replyUserError(
          interaction,
          {
            type:
              error?.type ||
              ErrorTypes.UNKNOWN,
            message:
              error?.userMessage ||
              'An error occurred while reopening the ticket.',
          }
        );
      } else if (
        interaction.deferred
      ) {
        await replyUserError(
          interaction,
          {
            type:
              error?.type ||
              ErrorTypes.UNKNOWN,
            message:
              error?.userMessage ||
              'An error occurred while reopening the ticket.',
          }
        );
      }
    }
  },
};


/*
|--------------------------------------------------------------------------
| DELETE TICKET
|--------------------------------------------------------------------------
*/

const deleteTicketHandler = {
  name: 'ticket_delete',

  async execute(
    interaction,
    client
  ) {
    try {
      if (
        !(await ensureGuildContext(
          interaction
        ))
      ) {
        return;
      }

      await assertTicketPermission(
        interaction,
        client,
        'delete tickets',
        {},
        2000
      );

      const deferSuccess =
        await InteractionHelper.safeDefer(
          interaction,
          {
            flags:
              MessageFlags.Ephemeral,
          }
        );

      if (!deferSuccess) {
        return;
      }

      const {
        deleteTicket,
      } = await import(
        '../services/ticket.js'
      );

      await deleteTicket(
        interaction.channel,
        interaction.member
      );

      await interaction.editReply({
        embeds: [
          successEmbed(
            'Ticket Deleted',
            'This ticket will be deleted shortly.'
          ),
        ],
      });

    } catch (error) {
      logger.error(
        'Error deleting ticket:',
        error
      );

      if (
        !interaction.replied &&
        !interaction.deferred
      ) {
        await replyUserError(
          interaction,
          {
            type:
              error?.type ||
              ErrorTypes.UNKNOWN,
            message:
              error?.userMessage ||
              'An error occurred while deleting the ticket.',
          }
        );
      } else if (
        interaction.deferred
      ) {
        await replyUserError(
          interaction,
          {
            type:
              error?.type ||
              ErrorTypes.UNKNOWN,
            message:
              error?.userMessage ||
              'An error occurred while deleting the ticket.',
          }
        );
      }
    }
  },
};


/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

export default createTicketHandler;

export const ticketModalHandlers = [
  createTicketModalHandler,
  closeTicketModalHandler,
];

export {
  createTicketModalHandler,
  closeTicketModalHandler,
  closeTicketHandler,
  claimTicketHandler,
  priorityTicketHandler,
  unclaimTicketHandler,
  reopenTicketHandler,
  deleteTicketHandler,
};
