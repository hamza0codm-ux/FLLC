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
| Legacy Normal Ticket Button
|--------------------------------------------------------------------------
|
| Supports older panel buttons using:
|
| normal_ticket_create:<ticketType>
|
|--------------------------------------------------------------------------
*/

const normalTicketCreateLegacyHandler = {
  name: 'normal_ticket_create',

  async execute(
    interaction,
    client,
    args = []
  ) {
    await createTicketHandler.execute(
      interaction,
      client,
      [
        'normal',
        args[0],
      ]
    );
  },
};


/*
|--------------------------------------------------------------------------
| Legacy Merch Ticket Button
|--------------------------------------------------------------------------
|
| Supports older panel buttons using:
|
| merch_ticket_create:<ticketType>
|
|--------------------------------------------------------------------------
*/

const merchTicketCreateLegacyHandler = {
  name: 'merch_ticket_create',

  async execute(
    interaction,
    client,
    args = []
  ) {
    await createTicketHandler.execute(
      interaction,
      client,
      [
        'merch',
        args[0],
      ]
    );
  },
};


/*
|--------------------------------------------------------------------------
| Ticket Button Handlers
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| The current panels use:
|
| create_ticket:normal:<type>
| create_ticket:merch:<type>
|
| Therefore createTicketHandler MUST be registered with the name:
|
| create_ticket
|
|--------------------------------------------------------------------------
*/

export default [
  createTicketHandler,

  /*
  |--------------------------------------------------------------------------
  | Legacy Create Buttons
  |--------------------------------------------------------------------------
  */

  normalTicketCreateLegacyHandler,
  merchTicketCreateLegacyHandler,

  /*
  |--------------------------------------------------------------------------
  | Ticket Controls
  |--------------------------------------------------------------------------
  */

  closeTicketHandler,
  claimTicketHandler,
  priorityTicketHandler,
  unclaimTicketHandler,
  reopenTicketHandler,
  deleteTicketHandler,
];
