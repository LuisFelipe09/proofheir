// @ts-nocheck

/**
 * @type {import('next').NextConfig}
 **/
const nextConfig = {
    // Empty turbopack config to silence Next.js 16 error (we use webpack with ignore-loader)
    turbopack: {},

    // Exclude problematic packages from Server Components bundling
    serverExternalPackages: [
        'pino',
        'pino-pretty',
        'thread-stream',
        '@walletconnect/ethereum-provider',
        '@walletconnect/utils',
        '@walletconnect/logger',
    ],

    webpack: (config, { isServer }) => {
        // Mark test files from thread-stream and pino as external to prevent bundling
        config.externals = config.externals || [];

        // Add externals for problematic test modules
        const originalExternals = config.externals;
        config.externals = async (context) => {
            const { request } = context;

            // Ignore test files from thread-stream and pino
            if (request && (
                request.includes('thread-stream') && request.includes('/test/') ||
                request.includes('pino') && request.includes('/test/')
            )) {
                return 'commonjs ' + request;
            }

            // Call original externals
            if (typeof originalExternals === 'function') {
                return originalExternals(context);
            }
            if (Array.isArray(originalExternals)) {
                for (const external of originalExternals) {
                    if (typeof external === 'function') {
                        const result = await external(context);
                        if (result) return result;
                    }
                }
            }
            return undefined;
        };

        // Ignore test files with ignore-loader as fallback
        config.module.rules.push({
            test: /thread-stream.*test.*\.m?js$/,
            loader: 'ignore-loader',
        });
        config.module.rules.push({
            test: /pino.*test.*\.m?js$/,
            loader: 'ignore-loader',
        });

        return config;
    },
};

module.exports = nextConfig;
