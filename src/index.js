#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	CallToolRequestSchema,
	ErrorCode,
	ListToolsRequestSchema,
	McpError,
} from '@modelcontextprotocol/sdk/types.js';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { search } from '@buger/probe';
import simpleGit from 'simple-git';
import { loadConfig } from './config.js';

// Get the package.json to determine the version
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.resolve(__dirname, '..', 'package.json');

// Get version from package.json
let packageVersion = '0.1.0';
try {
	if (fs.existsSync(packageJsonPath)) {
		console.error(`Found package.json at: ${packageJsonPath}`);
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
		if (packageJson.version) {
			packageVersion = packageJson.version;
			console.error(`Using version from package.json: ${packageVersion}`);
		}
	}
} catch (error) {
	console.error(`Error reading package.json:`, error);
}

// Load configuration
const config = loadConfig();

// Git instance for the data directory
const git = simpleGit(config.dataDir);

// Auto-update timer
let updateTimer = null;

/**
 * @typedef {Object} SearchDocsArgs
 * @property {string|string[]} query - The search query using Elasticsearch syntax. Focus on keywords.
 */

class DocsMcpServer {
	constructor() {
		/**
		 * @type {Server}
		 * @private
		 */
		this.server = new Server(
			{
				name: '@buger/probe-docs-mcp', // Keep server name static
				version: packageVersion,
			},
			{
				capabilities: {
					tools: {},
				},
			}
		);

		this.setupToolHandlers();

		// Error handling
		this.server.onerror = (error) => console.error('[MCP Error]', error);
		process.on('SIGINT', async () => {
			if (updateTimer) clearTimeout(updateTimer);
			await this.server.close();
			process.exit(0);
		});
	}

	/**
	 * Set up the tool handlers for the MCP server
	 * @private
	 */
	setupToolHandlers() {
		this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
			tools: [
				{
					name: config.toolName, // Use configured tool name
					description: config.toolDescription, // Use configured description
					inputSchema: {
						type: 'object',
						properties: {
							query: {
								type: 'string',
								description: 'Elasticsearch query string. Focus on keywords and use ES syntax (e.g., "install AND guide", "configure OR setup", "api NOT internal").',
							},
							page: {
								type: 'number',
								description: 'Optional page number for pagination of results (e.g., 1, 2, 3...). Default is 1.',
								default: 1, // Set a default value
							}
						},
						required: ['query'] // 'page' is optional
					},
				},
			],
		}));

		this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
			// Check against the configured tool name
			if (request.params.name !== config.toolName) {
				throw new McpError(
					ErrorCode.MethodNotFound,
					`Unknown tool: ${request.params.name}. Expected: ${config.toolName}`
				);
			}

			try {
				// Log the incoming request for debugging
				console.error(`Received request for tool: ${request.params.name}`);
				console.error(`Request arguments: ${JSON.stringify(request.params.arguments)}`);

				// Ensure arguments is an object
				if (!request.params.arguments || typeof request.params.arguments !== 'object') {
					throw new Error("Arguments must be an object");
				}

				const args = request.params.arguments;

				// Validate required fields
				if (!args.query) {
					throw new Error("Query is required in arguments");
				}

				const result = await this.executeDocsSearch(args);

				return {
					content: [
						{
							type: 'text',
							text: result,
						},
					],
				};
			} catch (error) {
				console.error(`Error executing ${request.params.name}:`, error);
				return {
					content: [
						{
							type: 'text',
							text: `Error executing ${request.params.name}: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				};
			}
		});
	}

	/**
	 * Execute a documentation search
	 * @param {SearchDocsArgs} args - Search arguments
	 * @returns {Promise<string>} Search results
	 * @private
	 */
	async executeDocsSearch(args) {
		try {
			// Always use the configured data directory
			const searchPath = config.dataDir;

			// Create a clean options object
			const options = {
				path: searchPath,
				query: args.query,
				maxTokens: 10000 // Set default maxTokens
				// Removed filesOnly, maxResults, session
			};

			console.error("Executing search with options:", JSON.stringify(options, null, 2));

			// Call search with the options object
			const result = await search(options);
			return result;
		} catch (error) {
			console.error('Error executing docs search:', error);
			throw new McpError(
				ErrorCode.MethodNotFound,
				`Error executing docs search: ${error.message || String(error)}`
			);
		}
	}

	/**
	 * Check for updates in the Git repository and pull changes.
	 * @private
	 */
	async checkForUpdates() {
		if (!config.gitUrl) return; // Only update if gitUrl is configured

		console.log('Checking for documentation updates...');
		try {
			// Check if it's a valid Git repository
			const isRepo = await git.checkIsRepo();
			if (!isRepo) {
				console.error(`Data directory ${config.dataDir} is not a Git repository. Skipping update.`);
				return;
			}

			// Fetch updates from remote
			await git.fetch();

			// Check status
			const status = await git.status();

			if (status.behind > 0) {
				console.log(`Local branch is ${status.behind} commits behind origin/${status.tracking}. Pulling updates...`);
				await git.pull('origin', config.gitRef);
				console.log('Documentation updated successfully.');
			} else {
				console.log('Documentation is up-to-date.');
			}
		} catch (error) {
			console.error('Error checking for updates:', error);
		} finally {
			// Schedule the next check
			if (config.autoUpdateInterval > 0) {
				updateTimer = setTimeout(() => this.checkForUpdates(), config.autoUpdateInterval * 60 * 1000);
			}
		}
	}

	async run() {
		try {
			console.error("Starting Docs MCP server...");
			console.error(`Using data directory: ${config.dataDir}`);
			console.error(`MCP Tool Name: ${config.toolName}`);
			console.error(`MCP Tool Description: ${config.toolDescription}`);
			if (config.gitUrl) {
				console.error(`Using Git repository: ${config.gitUrl} (ref: ${config.gitRef})`);
				console.error(`Auto-update interval: ${config.autoUpdateInterval} minutes`);
			} else if (config.includeDir) {
				console.error(`Using static directory: ${config.includeDir}`);
			}

			// Initial check for updates if using Git
			if (config.gitUrl && config.autoUpdateInterval > 0) {
				await this.checkForUpdates(); // Run initial check, then schedule next
			}

			// Connect the server to the transport
			const transport = new StdioServerTransport();
			await this.server.connect(transport);
			console.error('Docs MCP server running on stdio');
		} catch (error) {
			console.error('Error starting server:', error);
			process.exit(1);
		}
	}
}

const server = new DocsMcpServer();
server.run().catch(console.error);