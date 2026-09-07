import { Events } from "discord.js";

import { logger, startupLog } from "../utils/logger.js";
import config from "../config/application.js";

import { reconcileReactionRoleMessages } from "../services/reactionRoleService.js";

import {
  reconcileTicketPanels,
  reconcileVerificationPanels,
  reconcileReactionRolePanelHealth,
} from "../services/panelHealthService.js";

import { reconcileLevelRoles } from "../services/leveling/levelRoleSyncService.js";
import { initRiffyAfterReady } from "../services/music/riffySetup.js";

import {
  reconcileNormalTicketPanel,
} from "../tickets/normalTickets.js";

import {
  reconcileMerchTicketPanel,
} from "../tickets/merchTickets.js";

export default {
  name: Events.ClientReady,
  once: true,

  async execute(client) {
    startupLog(`Ready! Logged in as ${client.user.tag}`);
    startupLog(`Serving ${client.guilds.cache.size} guild(s)`);
    startupLog(`Loaded ${client.commands.size} commands`);

    try {
      client.user.setPresence(config.bot.presence);
    } catch (error) {
      logger.error("Failed to set bot presence:", error);
    }

   /*
|--------------------------------------------------------------------------
| NORMAL TICKET PANEL
|--------------------------------------------------------------------------
*/

try {
  startupLog(
    'Checking Normal ticket panel...'
  );

  const normalTicketPanel =
    await reconcileNormalTicketPanel(client);

  if (normalTicketPanel.created) {
    startupLog(
      `Normal ticket panel created. Message ID: ${normalTicketPanel.messageId}`
    );
  } else if (normalTicketPanel.edited) {
    startupLog(
      `Normal ticket panel configuration changed — existing message edited. Message ID: ${normalTicketPanel.messageId}`
    );
  } else if (normalTicketPanel.recovered) {
    startupLog(
      `Normal ticket panel already existed — message ID recovered: ${normalTicketPanel.messageId}`
    );
  } else {
    startupLog(
      `Normal ticket panel unchanged. Message ID: ${normalTicketPanel.messageId}`
    );
  }
} catch (error) {
  logger.error(
    'Failed to reconcile Normal ticket panel:',
    error
  );
}

/*
|--------------------------------------------------------------------------
| MERCH TICKET PANEL
|--------------------------------------------------------------------------
*/

try {
  startupLog(
    'Checking Merch ticket panel...'
  );

  const merchTicketPanel =
    await reconcileMerchTicketPanel(client);

  if (merchTicketPanel.created) {
    startupLog(
      `Merch ticket panel created. Message ID: ${merchTicketPanel.messageId}`
    );
  } else if (merchTicketPanel.edited) {
    startupLog(
      `Merch ticket panel configuration changed — existing message edited. Message ID: ${merchTicketPanel.messageId}`
    );
  } else if (merchTicketPanel.recovered) {
    startupLog(
      `Merch ticket panel already existed — message ID recovered: ${merchTicketPanel.messageId}`
    );
  } else {
    startupLog(
      `Merch ticket panel unchanged. Message ID: ${merchTicketPanel.messageId}`
    );
  }
} catch (error) {
  logger.error(
    'Failed to reconcile Merch ticket panel:',
    error
  );
}
    /*
    |--------------------------------------------------------------------------
    | MUSIC
    |--------------------------------------------------------------------------
    */

    try {
      if (client.config?.features?.music) {
        initRiffyAfterReady(client);
      }
    } catch (error) {
      logger.error(
        "Failed to initialize music:",
        error
      );
    }

    /*
    |--------------------------------------------------------------------------
    | REACTION ROLES
    |--------------------------------------------------------------------------
    */

    try {
      const reconciliationSummary =
        await reconcileReactionRoleMessages(client);

      startupLog(
        `Reaction role reconciliation: scanned ${reconciliationSummary.scannedMessages}, removed ${reconciliationSummary.removedMessages}, errors ${reconciliationSummary.errors}`
      );
    } catch (error) {
      logger.error(
        "Reaction role reconciliation failed:",
        error
      );
    }

    /*
    |--------------------------------------------------------------------------
    | EXISTING TICKET PANEL HEALTH
    |--------------------------------------------------------------------------
    */

    try {
      const ticketPanelSummary =
        await reconcileTicketPanels(client);

      startupLog(
        `Ticket panel health: scanned ${ticketPanelSummary.scannedGuilds} guilds, healthy ${ticketPanelSummary.healthyPanels}, deleted ${ticketPanelSummary.deletedPanels}, missing channel ${ticketPanelSummary.missingChannels}, recovered ${ticketPanelSummary.recoveredIds}, errors ${ticketPanelSummary.errors}`
      );
    } catch (error) {
      logger.error(
        "Ticket panel health reconciliation failed:",
        error
      );
    }

    /*
    |--------------------------------------------------------------------------
    | VERIFICATION PANELS
    |--------------------------------------------------------------------------
    */

    try {
      const verificationPanelSummary =
        await reconcileVerificationPanels(client);

      startupLog(
        `Verification panel health: scanned ${verificationPanelSummary.scannedGuilds} guilds, healthy ${verificationPanelSummary.healthyPanels}, deleted ${verificationPanelSummary.deletedPanels}, missing channel ${verificationPanelSummary.missingChannels}, recovered ${verificationPanelSummary.recoveredIds}, errors ${verificationPanelSummary.errors}`
      );
    } catch (error) {
      logger.error(
        "Verification panel health reconciliation failed:",
        error
      );
    }

    /*
    |--------------------------------------------------------------------------
    | REACTION ROLE PANEL HEALTH
    |--------------------------------------------------------------------------
    */

    try {
      const reactionRolePanelSummary =
        await reconcileReactionRolePanelHealth(client);

      startupLog(
        `Reaction role panel health: scanned ${reactionRolePanelSummary.scannedPanels} panels, healthy ${reactionRolePanelSummary.healthyPanels}, deleted ${reactionRolePanelSummary.deletedPanels}, missing channel ${reactionRolePanelSummary.missingChannels}, recovered ${reactionRolePanelSummary.recoveredIds}, errors ${reactionRolePanelSummary.errors}`
      );
    } catch (error) {
      logger.error(
        "Reaction role panel health reconciliation failed:",
        error
      );
    }

    /*
    |--------------------------------------------------------------------------
    | LEVEL ROLES
    |--------------------------------------------------------------------------
    */

    try {
      const levelRoleSummary =
        await reconcileLevelRoles(client);

      startupLog(
        `Level role sync: scanned ${levelRoleSummary.scannedGuilds} guilds, pruned ${levelRoleSummary.prunedRewardEntries} stale rewards, re-awarded ${levelRoleSummary.rolesReAwarded} roles, errors ${levelRoleSummary.errors}`
      );
    } catch (error) {
      logger.error(
        "Level role sync failed:",
        error
      );
    }

    startupLog("Startup reconciliation complete.");
  },
};
