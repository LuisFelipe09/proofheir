//@ts-check

/**
 * @type {import('next').NextConfig}
 **/
const nextConfig = {
    // Exclude problematic packages from Server Components bundling
    serverExternalPackages: [
        'pino',
        'thread-stream',
        '@walletconnect/ethereum-provider',
        '@walletconnect/utils',
        '@walletconnect/logger',
    ],

    webpack: (config, { isServer }) => {
        // Only ignore test directories in thread-stream and pino packages
        // NOT viem (which has legitimate test actions for anvil)
        config.module.rules.push({
            test: /[\\/]node_modules[\\/]\.pnpm[\\/](thread-stream|pino).*[\\/]test[\\/].*\.(js|mjs|cjs)$/,
            loader: 'ignore-loader',
        });

        return config;
    },
};

module.exports = nextConfig;
