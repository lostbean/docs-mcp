# Probe Docs MCP Server

This project provides a flexible Model Context Protocol (MCP) server, powered by [Probe](https://probeai.dev/), designed to make documentation or codebases searchable by AI assistants.

**Use Cases:**

*   **Chat with any GitHub Repository:** Point the server to a public or private Git repository to enable natural language queries about its contents.
*   **Search Your Documentation:** Integrate your project's documentation (from a local directory or Git) for easy searching.
*   **Build Custom MCP Servers:** Use this project as a template to create your own official MCP servers tailored to specific documentation sets or even codebases.

The content source (documentation or code) can be **pre-built** into the package during the `npm run build` step, or configured **dynamically** at runtime using local directories or Git repositories.

## Features

- **Powered by Probe:** Leverages the [Probe](https://probeai.dev/) search engine for efficient and relevant results.
- **Flexible Content Sources:** Include a specific local directory or clone a Git repository.
- **Pre-build Content:** Optionally bundle documentation/code content directly into the package.
- **Dynamic Configuration:** Configure content sources, Git settings, and MCP tool details via config file, CLI arguments, or environment variables.
- **Automatic Git Updates:** Keep content fresh by automatically pulling changes from a Git repository at a configurable interval.
- **Customizable MCP Tool:** Define the name and description of the search tool exposed to AI assistants.
- **AI Integration:** Seamlessly integrates with AI assistants supporting the Model Context Protocol (MCP).

## Installation

```bash
# Clone the repository
git clone https://github.com/buger/probe.git
cd probe/examples/docs-mcp

# Install dependencies
npm install
```

## Configuration

Create a `docs-mcp.config.json` file in the root directory to define the **default** content source and MCP tool details used during the build and at runtime (unless overridden by CLI arguments or environment variables).

### Example 1: Using a Local Directory

```json
{
  "includeDir": "/Users/username/projects/my-project/docs", // Path to your local documentation folder
  "toolName": "search_my_project_docs", // Custom tool name for AI assistants
  "toolDescription": "Search the documentation for My Project.", // Custom tool description
  "ignorePatterns": [ // Optional: Patterns to exclude when copying
    "node_modules",
    ".git",
    "build",
    "*.log"
  ]
}
```

### Example 2: Using a Git Repository

```json
{
  "gitUrl": "https://github.com/your-org/your-codebase.git", // URL of the repository to search
  "gitRef": "develop", // Optional: Specify a branch or tag (default: main)
  "autoUpdateInterval": 15, // Optional: Check for updates every 15 minutes (0 to disable, default: 5)
  "toolName": "search_codebase", // Custom tool name
  "toolDescription": "Search the main company codebase.", // Custom tool description
  "ignorePatterns": [ // Optional: Patterns to ignore during search indexing (applied after clone)
    "*.test.js",
    "dist/",
    "__snapshots__"
  ]
}
```

### Configuration Options

- `includeDir`: **(Build/Runtime)** Absolute path to a local directory whose contents will be copied to the `data` directory during build, or used directly at runtime if `dataDir` is not specified. Use this OR `gitUrl`.
- `gitUrl`: **(Build/Runtime)** URL of the Git repository to clone into the `data` directory during build, or used directly at runtime if `dataDir` is not specified. Use this OR `includeDir`.
- `gitRef`: **(Build/Runtime)** The branch, tag, or commit hash to checkout from the `gitUrl` (default: `main`).
- `autoUpdateInterval`: **(Runtime)** Interval in minutes to automatically check for updates if using `gitUrl` (0 to disable, default: 5). Requires `git` command to be available.
- `dataDir`: **(Runtime)** Path to the directory containing the content to be searched at runtime. Overrides content sourced from `includeDir` or `gitUrl` defined in the config file or built into the package. Useful for pointing the server to live data without rebuilding.
- `toolName`: **(Build/Runtime)** The name of the MCP tool exposed by the server (default: `search_docs`). Choose a descriptive name relevant to the content.
- `toolDescription`: **(Build/Runtime)** The description of the MCP tool shown to AI assistants (default: "Search documentation using the probe search engine.").
- `ignorePatterns`: **(Build/Runtime)** An array of glob patterns.
    - If using `includeDir` during build: Files matching these patterns are excluded when copying to `data`. `.gitignore` rules are also respected.
    - If using `gitUrl` or `dataDir` at runtime: Files matching these patterns within the `data` directory are ignored by the search indexer.

**Precedence:**

1.  **Runtime Configuration (Highest):** CLI arguments (`--dataDir`, `--gitUrl`, etc.) and Environment Variables (`DATA_DIR`, `GIT_URL`, etc.) override all other settings. CLI arguments take precedence over Environment Variables.
2.  **Build-time Configuration:** Settings in `docs-mcp.config.json` (`includeDir`, `gitUrl`, `toolName`, etc.) define defaults used during `npm run build` and also serve as runtime defaults if not overridden.
3.  **Default Values (Lowest):** Internal defaults are used if no configuration is provided (e.g., `toolName: 'search_docs'`, `autoUpdateInterval: 5`).

Note: If both `includeDir` and `gitUrl` are provided in the *same* configuration source (e.g., both in the config file, or both as CLI args), `gitUrl` takes precedence.

## Building (Pre-building Content)

Build the package to prepare the `data` directory based on the configuration in `docs-mcp.config.json`:

```bash
npm run build
```

This will:
1. Create a default configuration file if it doesn't exist.
2. If `gitUrl` is set, clone the repository to the `data` directory.
3. If `includeDir` is set, copy the directory to `data` (respecting .gitignore).
4. Make the executable script executable.
5. The `data` directory is now **pre-built** and will be included if you publish the package.

## Running

Start the MCP server. It will use the pre-built `data` directory and configured tool details by default.

```bash
npm start
```

Or use the executable directly:

```bash
./bin/probe-docs-mcp
```

### Dynamic Configuration at Runtime

You can override the default configuration when running the server:

```bash
# Run using a specific Git repo branch and custom tool name
npm start -- --gitUrl=https://github.com/some-org/some-repo.git --gitRef=feature/new-api --toolName=search_api_preview

# Run using a specific local directory at runtime (overrides built-in data)
npm start -- --dataDir=/Users/username/work/current-project/docs --toolName=search_current_project

# Equivalent using the executable directly
./bin/probe-docs-mcp --dataDir=/Users/username/work/current-project/docs --toolName=search_current_project
```

If using a Git repository with `autoUpdateInterval > 0`, the server will automatically check for updates for the specified `dataDir`.

## Environment Variables

You can also configure the server using environment variables:

- `INCLUDE_DIR`: Corresponds to `includeDir` config/CLI option. Primarily affects build.
- `GIT_URL`: Corresponds to `gitUrl` config/CLI option.
- `GIT_REF`: Corresponds to `gitRef` config/CLI option.
- `AUTO_UPDATE_INTERVAL`: Corresponds to `autoUpdateInterval` config/CLI option.
- `DATA_DIR`: Corresponds to `dataDir` CLI option (runtime only).
- `TOOL_NAME`: Corresponds to `toolName` config/CLI option.
- `TOOL_DESCRIPTION`: Corresponds to `toolDescription` config/CLI option.

Example:

```bash
# Run pointing to a specific runtime data directory and custom tool name
DATA_DIR=/mnt/shared/live-docs TOOL_NAME=search_live_shared_docs npm start

# Run using a different Git repo, disable updates
GIT_URL=https://github.com/another-org/another-repo.git AUTO_UPDATE_INTERVAL=0 npm start
```

## Using with AI Assistants

This MCP server exposes a search tool to connected AI assistants via the Model Context Protocol. The tool's name and description are configurable (see Configuration section). It searches the content within the currently active `data` directory (determined by build settings, config file, CLI args, or environment variables).

**Tool Parameters:**

- `query`: A natural language query or keywords describing what to search for (e.g., "how to configure the gateway", "database connection example", "user authentication"). The server uses Probe's search capabilities to find relevant content. (Required)

**Example Tool Call (using default tool name):**

```json
{
  "tool_name": "search_docs", // Or your custom tool name
  "arguments": {
    "query": "how to set up database connection pooling"
  }
}
```

**Example Tool Call (using custom tool name `search_codebase`):**

```json
{
  "tool_name": "search_codebase",
  "arguments": {
    "query": "find the implementation of the user login function"
  }
}
```

## Publishing as an npm Package

To publish this as an npm package with pre-built documentation:

1. Configure `docs-mcp.config.json` with the desired default source and tool details.
2. Build the package: `npm run build` (This populates the `data` directory).
3. Update the `package.json` with your package name and version.
4. Publish to npm: `npm publish` (The `data` directory will be included).

After publishing, users can install and use your package:

```bash
# Install the package
npm install -g your-package-name

# Run using the pre-built data and default tool name
your-package-name

# Run using a different Git repo dynamically and custom tool name
your-package-name --gitUrl=https://github.com/your-org/your-docs-repo.git --toolName=search_custom
```

## License

MIT