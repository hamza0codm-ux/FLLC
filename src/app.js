import 'dotenv/config';
import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { REST } from '@discordjs/rest';
import express from 'express';
import cron from 'node-cron';

import config from './config/application.js';
import { initializeDatabase } from './utils/database.js';
import { getGuildConfig } from './services/config/guildConfig.js';
import { reconcileAbsencePanel } from './services/absenceService.js';
import {
    getServerCounters,
    saveServerCounters,
    updateCounter,
} from './services/serverstatsService.js';
import { logger, startupLog, shutdownLog } from './utils/logger.js';
import { checkBirthdays } from './services/birthdayService.js';
import { checkGiveaways } from './services/giveawayService.js';
import {
    loadCommands,
    registerCommands as registerSlashCommands,
} from './handlers/loaders/commandLoader.js';
import {
    runSafeTask,
    handleTaskError,
    ErrorCodes,
} from './utils/errorHandler.js';
import { reconcileSocialsPanel } from './services/socialsPanelService.js';
import { initializeMusic } from './services/music/riffySetup.js';
import { shutdownMusic } from './services/music/playerHandler.js';

import { reconcileNormalTicketPanel } from './tickets/normalTickets.js';
import { reconcileMerchTicketPanel } from './tickets/merchTickets.js';

import pkg from '../package.json' with { type: 'json' };
import {
    EXPECTED_SCHEMA_VERSION,
    EXPECTED_SCHEMA_LABEL,
} from './config/database/schemaVersion.js';

class TitanBot extends Client {
    constructor() {
        super({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildBans,
            ],
        });

        this.config = config;
        this.commands = new Collection();
        this.events = new Collection();
        this.buttons = new Collection();
        this.selectMenus = new Collection();
        this.modals = new Collection();
        this.cooldowns = new Collection();
        this.db = null;
        this.rest = new REST({ version: '10' }).setToken(
            config.bot.token,
        );
    }

    async start() {
        try {
            startupLog('Starting TitanBot...');
            await new Promise(resolve => setTimeout(resolve, 1000));

            startupLog('Initializing database...');

            const dbInstance = await initializeDatabase();
            this.db = dbInstance.db;

            // Check database status and report
            const dbStatus = this.db.getStatus();

            if (dbStatus.isDegraded) {
                logger.warn('');
                logger.warn(
                    '╔═══════════════════════════════════════════════════════╗',
                );
                logger.warn(
                    '║ ⚠️  DATABASE RUNNING IN DEGRADED MODE                 ║',
                );
                logger.warn(
                    '║                                                       ║',
                );
                logger.warn(
                    '║ Connection: In-Memory Storage (PostgreSQL unavailable)║',
                );
                logger.warn(
                    '║ Data Persistence: DISABLED - data lost on restart    ║',
                );
                logger.warn(
                    '║ Action Required: Fix PostgreSQL and restart bot      ║',
                );
                logger.warn(
                    '╚═══════════════════════════════════════════════════════╝',
                );
                logger.warn('');
            } else {
                startupLog(
                    `✅ Database Status: ${dbStatus.connectionType} (fully operational)`,
                );
            }

            startupLog('Starting web server...');
            this.startWebServer();

            startupLog('Loading commands...');
            await loadCommands(this);
            startupLog(`Commands loaded: ${this.commands.size}`);

            startupLog('Loading handlers...');
            await this.loadHandlers();
            startupLog('Handlers loaded');

            initializeMusic(this);

            startupLog('Logging into Discord...');
            await this.login(this.config.bot.token);
            startupLog('Discord login successful');

            /*
             * ============================================================
             * FRUITY NORMAL TICKET PANEL
             * ============================================================
             */

            try {
                startupLog('Checking Fruity Normal Ticket panel...');

                const normalTicketResult =
                    await reconcileNormalTicketPanel(this);

                if (normalTicketResult?.action === 'created') {
                    startupLog(
                        `✅ Fruity Normal Ticket panel created (${normalTicketResult.messageId})`,
                    );
                } else if (
                    normalTicketResult?.action === 'updated'
                ) {
                    startupLog(
                        `✅ Fruity Normal Ticket panel updated (${normalTicketResult.messageId})`,
                    );
                } else if (
                    normalTicketResult?.action === 'unchanged'
                ) {
                    startupLog(
                        `✅ Fruity Normal Ticket panel already exists (${normalTicketResult.messageId})`,
                    );
                } else {
                    logger.warn(
                        `⚠️ Fruity Normal Ticket panel returned an unexpected result: ${JSON.stringify(
                            normalTicketResult,
                        )}`,
                    );
                }
            } catch (error) {
                logger.error(
                    '❌ Failed to create/update Fruity Normal Ticket panel:',
                    error,
                );
            }

            /*
             * ============================================================
             * FRUITY MERCH TICKET PANEL
             * ============================================================
             */

            try {
                startupLog('Checking Fruity Merch Ticket panel...');

                const merchTicketResult =
                    await reconcileMerchTicketPanel(this);

                if (merchTicketResult?.action === 'created') {
                    startupLog(
                        `✅ Fruity Merch Ticket panel created (${merchTicketResult.messageId})`,
                    );
                } else if (
                    merchTicketResult?.action === 'updated'
                ) {
                    startupLog(
                        `✅ Fruity Merch Ticket panel updated (${merchTicketResult.messageId})`,
                    );
                } else if (
                    merchTicketResult?.action === 'unchanged'
                ) {
                    startupLog(
                        `✅ Fruity Merch Ticket panel already exists (${merchTicketResult.messageId})`,
                    );
                } else {
                    logger.warn(
                        `⚠️ Fruity Merch Ticket panel returned an unexpected result: ${JSON.stringify(
                            merchTicketResult,
                        )}`,
                    );
                }
            } catch (error) {
                logger.error(
                    '❌ Failed to create/update Fruity Merch Ticket panel:',
                    error,
                );
            }

            /*
             * ============================================================
             * ABSENCE PANEL
             * ============================================================
             */

            try {
                startupLog('Checking Fruity Absence panel...');

                const absenceResult =
                    await reconcileAbsencePanel(this);

                if (absenceResult.action === 'created') {
                    startupLog(
                        `✅ Fruity Absence panel created (${absenceResult.messageId})`,
                    );
                } else if (
                    absenceResult.action === 'unchanged'
                ) {
                    startupLog(
                        `✅ Fruity Absence panel already exists (${absenceResult.messageId})`,
                    );
                } else {
                    logger.error(
                        `❌ Failed to reconcile Fruity Absence panel: ${
                            absenceResult.error ||
                            'Unknown error'
                        }`,
                    );
                }
            } catch (error) {
                logger.error(
                    '❌ Failed to create/update Fruity Absence panel:',
                    error,
                );
            }

            /*
             * ============================================================
             * SOCIALS PANEL
             * ============================================================
             */

            try {
                startupLog('Checking Fruity Socials panel...');

                const socialsResult =
                    await reconcileSocialsPanel(this);

                if (socialsResult.action === 'created') {
                    startupLog(
                        `✅ Fruity Socials panel created (${socialsResult.messageId})`,
                    );
                } else if (
                    socialsResult.action === 'unchanged'
                ) {
                    startupLog(
                        `✅ Fruity Socials panel already exists (${socialsResult.messageId})`,
                    );
                } else {
                    logger.error(
                        `❌ Failed to reconcile Fruity Socials panel: ${
                            socialsResult.error ||
                            'Unknown error'
                        }`,
                    );
                }
            } catch (error) {
                logger.error(
                    '❌ Failed to create/update Fruity Socials panel:',
                    error,
                );
            }

            startupLog('Registering slash commands globally...');

            await this.registerCommands();

            startupLog(
                'Slash commands registration complete',
            );

            const databaseMode = dbStatus.isDegraded
                ? 'Optional in-memory mode (data resets after restart)'
                : 'Connected (persistent data enabled)';

            const handlerSummary = `${this.buttons.size} buttons, ${this.selectMenus.size} menus, ${this.modals.size} modals`;

            startupLog(
                `ONLINE ✅ | ${this.commands.size} commands loaded | ${handlerSummary} | Database: ${databaseMode}`,
            );

            this.setupCronJobs();
        } catch (error) {
            logger.error('Failed to start bot:', error);
            process.exit(1);
        }
    }

    startWebServer() {
        const app = express();

        const configuredPort = Number(
            this.config.api?.port ||
                process.env.PORT ||
                3000,
        );

        const maxPortRetryAttempts = Number(
            process.env.PORT_RETRY_ATTEMPTS || 5,
        );

        const host = process.env.WEB_HOST || '0.0.0.0';
        const corsOrigin =
            this.config.api?.cors?.origin || '*';

        app.use((req, res, next) => {
            const allowedOrigins = Array.isArray(corsOrigin)
                ? corsOrigin
                : [corsOrigin];

            const origin = req.headers.origin;

            if (
                allowedOrigins.includes('*') ||
                allowedOrigins.includes(origin)
            ) {
                res.header(
                    'Access-Control-Allow-Origin',
                    origin || '*',
                );
            }

            res.header(
                'Access-Control-Allow-Methods',
                'GET, POST, OPTIONS',
            );

            res.header(
                'Access-Control-Allow-Headers',
                'Content-Type, Authorization',
            );

            if (req.method === 'OPTIONS') {
                return res.sendStatus(200);
            }

            next();
        });

        const requestCounts = new Map();

        const windowMs =
            this.config.api?.rateLimit?.windowMs ||
            60000;

        const maxRequests =
            this.config.api?.rateLimit?.max || 100;

        app.use((req, res, next) => {
            const ip = req.ip;
            const now = Date.now();
            const windowStart = now - windowMs;

            if (!requestCounts.has(ip)) {
                requestCounts.set(ip, []);
            }

            const times = requestCounts
                .get(ip)
                .filter(t => t > windowStart);

            if (times.length >= maxRequests) {
                return res
                    .status(429)
                    .json({
                        error: 'Too many requests',
                    });
            }

            times.push(now);
            requestCounts.set(ip, times);

            next();
        });

        app.get('/health', (req, res) => {
            const dbStatus =
                this.db?.getStatus?.() || {
                    isDegraded: 'unknown',
                };

            const status = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                database: {
                    connected:
                        dbStatus.connectionType !== 'none',
                    connectionType:
                        dbStatus.connectionType,
                    degraded:
                        dbStatus.isDegraded,
                },
                discord: {
                    ready: this.isReady(),
                    guilds: this.guilds.cache.size,
                },
                version: pkg.version,
                schema: {
                    expectedVersion:
                        EXPECTED_SCHEMA_VERSION,
                    expectedLabel:
                        EXPECTED_SCHEMA_LABEL,
                },
            };

            res.json(status);
        });

        app.get('/api/status', (req, res) => {
            const dbStatus =
                this.db?.getStatus?.() || {
                    isDegraded: 'unknown',
                    connectionType: 'unknown',
                };

            res.json({
                online: this.isReady(),
                guilds: this.guilds.cache.size,
                users: this.guilds.cache.reduce(
                    (total, guild) =>
                        total + guild.memberCount,
                    0,
                ),
                database: {
                    connectionType:
                        dbStatus.connectionType,
                    degraded:
                        dbStatus.isDegraded,
                },
                uptime: process.uptime(),
                version: pkg.version,
            });
        });

        app.get('/api/guilds', (req, res) => {
            if (!this.isReady()) {
                return res
                    .status(503)
                    .json({
                        error: 'Discord client is not ready',
                    });
            }

            const guilds = this.guilds.cache.map(
                guild => ({
                    id: guild.id,
                    name: guild.name,
                    memberCount:
                        guild.memberCount,
                    icon: guild.iconURL({
                        size: 128,
                    }),
                }),
            );

            res.json(guilds);
        });

        app.get('/api/guilds/:guildId', async (req, res) => {
            try {
                if (!this.isReady()) {
                    return res
                        .status(503)
                        .json({
                            error: 'Discord client is not ready',
                        });
                }

                const guild =
                    this.guilds.cache.get(
                        req.params.guildId,
                    );

                if (!guild) {
                    return res
                        .status(404)
                        .json({
                            error: 'Guild not found',
                        });
                }

                const guildConfig =
                    await getGuildConfig(
                        this,
                        guild.id,
                    );

                res.json({
                    id: guild.id,
                    name: guild.name,
                    memberCount:
                        guild.memberCount,
                    icon: guild.iconURL({
                        size: 256,
                    }),
                    config: guildConfig,
                });
            } catch (error) {
                logger.error(
                    'Error fetching guild information:',
                    error,
                );

                res.status(500).json({
                    error: 'Failed to fetch guild information',
                });
            }
        });

        let currentPort = configuredPort;
        let attempt = 0;

        const tryListen = () => {
            attempt++;

            const server = app
                .listen(currentPort, host, () => {
                    this.webServer = server;

                    startupLog(
                        `Web server listening on ${host}:${currentPort}`,
                    );
                })
                .on('error', error => {
                    if (
                        error.code === 'EADDRINUSE' &&
                        attempt <
                            maxPortRetryAttempts
                    ) {
                        logger.warn(
                            `Port ${currentPort} is already in use. Trying another port...`,
                        );

                        currentPort++;

                        setTimeout(
                            tryListen,
                            500,
                        );
                    } else {
                        logger.error(
                            'Failed to start web server:',
                            error,
                        );
                    }
                });
        };

        tryListen();
    }

    async loadHandlers() {
        startupLog('Loading handlers...');

        const handlers = [
            {
                path: 'events',
                type: 'default',
                required: true,
            },
            {
                path: 'interactions',
                type: 'default',
                required: true,
            },
        ];

        for (const handler of handlers) {
            try {
                startupLog(
                    `Loading handler: ${handler.path}`,
                );

                const module = await import(
                    `./handlers/loaders/${handler.path}.js`
                );

                const loaderFn =
                    handler.type.startsWith('named:')
                        ? module[
                              handler.type.split(':')[1]
                          ]
                        : module.default;

                if (typeof loaderFn === 'function') {
                    await loaderFn(this);

                    startupLog(
                        `✅ Loaded ${handler.path}`,
                    );
                } else {
                    throw new Error(
                        `Invalid loader export from ${handler.path}`,
                    );
                }
            } catch (error) {
                if (handler.required) {
                    logger.error(
                        `❌ Failed to load required handler ${handler.path}:`,
                        error.message,
                    );

                    throw error;
                } else if (
                    error.code !== 'MODULE_NOT_FOUND'
                ) {
                    logger.warn(
                        `⚠️ Failed to load optional handler ${handler.path}:`,
                        error.message,
                    );
                }
            }
        }
    }

    async registerCommands() {
        try {
            await registerSlashCommands(this, {
                clientId:
                    this.config.bot.clientId,
            });
        } catch (error) {
            logger.error(
                'Error registering commands:',
                error,
            );
        }
    }

    setupCronJobs() {
        cron.schedule(
            '0 0 * * *',
            runSafeTask(
                'birthday_check',
                () => checkBirthdays(this),
            ),
        );

        cron.schedule(
            '* * * * *',
            runSafeTask(
                'giveaway_check',
                () => checkGiveaways(this),
            ),
        );

        cron.schedule(
            '*/15 * * * *',
            runSafeTask(
                'counter_update',
                () => this.updateAllCounters(),
            ),
        );
    }

    async updateAllCounters() {
        if (!this.db) {
            logger.warn(
                'Database not available for counter updates',
            );

            return;
        }

        for (const [guildId, guild] of this.guilds.cache) {
            try {
                const counters =
                    await getServerCounters(
                        this,
                        guildId,
                    );

                const validCounters = [];
                const orphanedCounters = [];

                for (const counter of counters) {
                    if (
                        counter &&
                        counter.type &&
                        counter.channelId &&
                        counter.enabled !== false
                    ) {
                        const channel =
                            guild.channels.cache.get(
                                counter.channelId,
                            );

                        if (channel) {
                            validCounters.push(counter);

                            await updateCounter(
                                this,
                                guild,
                                counter,
                            );
                        } else {
                            orphanedCounters.push(
                                counter,
                            );

                            logger.info(
                                `Removing orphaned counter ${counter.id} (type: ${counter.type}, deleted channel: ${counter.channelId}) from guild ${guildId}`,
                            );
                        }
                    }
                }

                if (orphanedCounters.length > 0) {
                    await saveServerCounters(
                        this,
                        guildId,
                        validCounters,
                    );

                    logger.info(
                        `Cleaned up ${orphanedCounters.length} orphaned counter(s) from guild ${guildId} during scheduled update`,
                    );
                }
            } catch (error) {
                logger.error(
                    `Error updating counters for guild ${guildId}:`,
                    error,
                );
            }
        }
    }

    async shutdown(reason = 'UNKNOWN') {
        shutdownLog(
            `Bot is shutting down (${reason})...`,
        );

        logger.info(`\n${'='.repeat(60)}`);

        logger.info(
            `🛑 Graceful Shutdown Initiated (${reason})`,
        );

        logger.info(`${'='.repeat(60)}`);

        try {
            logger.info('Stopping cron jobs...');

            cron.getTasks().forEach(task =>
                task.stop(),
            );

            logger.info('✅ Cron jobs stopped');

            logger.info(
                'Stopping music players...',
            );

            await shutdownMusic(this);

            logger.info(
                '✅ Music players stopped',
            );

            if (this.webServer) {
                logger.info(
                    'Closing web server...',
                );

                await new Promise(resolve =>
                    this.webServer.close(resolve),
                );

                logger.info(
                    '✅ Web server closed',
                );
            }

            if (this.db && this.db.db) {
                logger.info(
                    'Closing database connection...',
                );

                try {
                    if (this.db.db.pool) {
                        await this.db.db.pool.end();

                        logger.info(
                            '✅ Database connection closed',
                        );
                    }
                } catch (error) {
                    logger.warn(
                        'Error closing database pool:',
                        error.message,
                    );
                }
            }

            logger.info(
                'Destroying Discord client...',
            );

            if (this.isReady()) {
                try {
                    this.destroy();

                    logger.info(
                        '✅ Discord client destroyed',
                    );
                } catch (error) {
                    logger.warn(
                        'Discord client destroy warning (non-critical):',
                        error.message,
                    );
                }
            }

            logger.info(
                '✅ Graceful shutdown complete',
            );

            shutdownLog(
                'Bot stopped successfully.',
            );

            process.exit(0);
        } catch (error) {
            logger.error(
                'Error during graceful shutdown:',
                error,
            );

            process.exit(1);
        }
    }
}

try {
    const bot = new TitanBot();

    const setupShutdown = () => {
        process.on('SIGTERM', () =>
            bot.shutdown('SIGTERM'),
        );

        process.on('SIGINT', () =>
            bot.shutdown('SIGINT'),
        );

        process.on(
            'uncaughtException',
            error => {
                handleTaskError(
                    'uncaught_exception',
                    error,
                    { fatal: true },
                );

                bot.shutdown(
                    'UNCAUGHT_EXCEPTION',
                );
            },
        );

        process.on(
            'unhandledRejection',
            reason => {
                const code = reason?.code;

                if (
                    code === 10062 ||
                    code === 40060 ||
                    code === 50027
                ) {
                    logger.warn(
                        'Recoverable Discord interaction rejection:',
                        reason?.message || reason,
                    );

                    return;
                }

                if (
                    reason?.message?.includes(
                        'Queue is empty',
                    )
                ) {
                    return;
                }

                handleTaskError(
                    'unhandled_rejection',
                    reason instanceof Error
                        ? reason
                        : new Error(
                              String(reason),
                          ),
                    {
                        errorCode:
                            ErrorCodes.UNHANDLED_REJECTION,
                    },
                );
            },
        );
    };

    setupShutdown();

    bot.start().catch(error => {
        logger.error(
            'Fatal error during bot startup:',
            error,
        );

        bot.shutdown('STARTUP_ERROR');
    });
} catch (error) {
    logger.error(
        'Fatal error during bot startup:',
        error,
    );

    process.exit(1);
}

export default TitanBot;
