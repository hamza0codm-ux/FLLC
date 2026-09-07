import createTicketHandler, {
  closeTicketHandler,
  claimTicketHandler,
  priorityTicketHandler,
  unclaimTicketHandler,
  reopenTicketHandler,
  deleteTicketHandler,
} from '../../../handlers/ticketButtons.js';

/*
|--------------------------------------------------------------------------
| Legacy ticket button compatibility
|--------------------------------------------------------------------------
|
| Older Fruity ticket panels used:
|
| normal_ticket_create:<type>
| merch_ticket_create:<type>
|
| The current handler uses:
|
| create_ticket:normal:<type>
| create_ticket:merch:<type>
|
| These aliases keep already-existing Discord panels working without
| requiring the panel message to be deleted or recreated.
|
*/

const normalTicketCreateLegacyHandler = {
  name: 'normal_ticket_create',

  async execute(interaction, client, args = []) {
    await createTicketHandler.execute(
      interaction,
      client,
      ['normal', args[0]]
    );
  },
};

const merchTicketCreateLegacyHandler = {
  name: 'merch_ticket_create',

  async execute(interaction, client, args = []) {
    await createTicketHandler.execute(
      interaction,
      client,
      ['merch', args[0]]
    );
  },
};

export default [
  /*
  |--------------------------------------------------------------------------
  | Current ticket system
  |--------------------------------------------------------------------------
  */

  createTicketHandler,

  /*
  |--------------------------------------------------------------------------
  | Legacy panel compatibility
  |--------------------------------------------------------------------------
  */

  normalTicketCreateLegacyHandler,
  merchTicketCreateLegacyHandler,

  /*
  |--------------------------------------------------------------------------
  | Ticket controls
  |--------------------------------------------------------------------------
  */

  closeTicketHandler,
  claimTicketHandler,
  priorityTicketHandler,
  unclaimTicketHandler,
  reopenTicketHandler,
  deleteTicketHandler,
];
