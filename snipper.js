require('dotenv').config();
const axios = require('axios');
const clc = require('cli-color');
const prompt = require('prompt-sync')();
const { OpenSeaPort } = require('opensea-js');
const { Network } = require('opensea-js/lib/types');
const MnemonicWalletSubprovider = require('@0x/subproviders').MnemonicWalletSubprovider;
const RPCSubprovider = require('web3-provider-engine/subproviders/rpc');
const Web3ProviderEngine = require('web3-provider-engine');

const mnemonic = prompt('Please enter your mnemonic:  ');

if (!mnemonic.length) {
    console.log(clc.red(`You haven't entered your mnemonic, exiting the program...`));
    return;
}

const BASE_DERIVATION_PATH = `44'/60'/0'/0`;
const mnemonicWalletSubprovider = new MnemonicWalletSubprovider({
    mnemonic,
    baseDerivationPath: BASE_DERIVATION_PATH
});

const infuraRpcSubprovider = new RPCSubprovider({
    rpcUrl: `https://mainnet.infura.io/v3/${process.env.INFURA_ID}`
});

const providerEngine = new Web3ProviderEngine();
providerEngine.addProvider(mnemonicWalletSubprovider);
providerEngine.addProvider(infuraRpcSubprovider);
providerEngine.start();

const seaport = new OpenSeaPort(
    providerEngine, {
        networkName: Network.Main,
        apiKey: process.env.OPENSEA_API_KEY,
    },
    (arg) => console.log(arg)
);

const collectionSlug = prompt('Please enter the slug of nft collection:  ');

if (!collectionSlug.length) {
    console.log(clc.red(`You haven't entered collection slug, exiting the program...`));
    return;
}

// keep global since holders fetching is done through pagination
// and errors might occur with status 429
let allHolders = [];
let nextCursor = '';

// keep track when looping through holders
let currentHolderIdx = 0;

async function main() {
    const floorPrice = await getFloorPriceBySlug(collectionSlug);
    await getAllHoldersFromCollection(collectionSlug);
    console.log(`There are ${clc.yellow(allHolders.length)} holders`);
    // await sendOfferToHolder(floorPrice);
    await sendOfferToEveryHolder(floorPrice);
}

main();

async function getFloorPriceBySlug(slug) {
    try {
        const res = await axios.get(`https://api.opensea.io/api/v1/collection/${slug}/stats`);
        console.log(`Floor price is ${clc.yellow(res.data.stats.floor_price)} ETH`);

        return res.data.stats.floor_price;
    } catch (err) {
        console.log(clc.red(err));
        return 0;
    }
}

async function getAllHoldersFromCollection(slug) {
    try {
        let res = await axios.get(`https://api.opensea.io/api/v1/assets`, {
            params: {
                limit: '50',
                include_orders: 'false',
                collection_slug: slug,
                cursor: nextCursor
            },
            headers: {
                'X-API-KEY': process.env.OPENSEA_API_KEY
            }
        });

        let holdersList = {
            list: res.data.assets.map(asset => ({
                tokenAddress: asset.asset_contract.address,
                tokenId: asset.token_id,
                ownerAddress: asset.owner.address
            })),
            next: res.data.next
        };

        allHolders = [...allHolders, ...holdersList.list];

        if (res.data.next) {
            nextCursor = holdersList.next;
            await getAllHoldersFromCollection(slug);
        }

    } catch (err) {
        console.log(clc.red(err));
        // wait for 10s because of api rate limit
        await new Promise(resolve => setTimeout(resolve, 10000));
        await getAllHoldersFromCollection(slug);
    }
}

async function sendOfferToHolder(floorPrice) {
    try {
        const asset = allHolders[currentHolderIdx];
        if (asset.ownerAddress !== '0x1c79EdcaC6F24D7C3069339FFD09dA5DaF4E487f') {
            const offer = await seaport.createBuyOrder({
                asset: {
                    tokenId: asset.tokenId,
                    tokenAddress: asset.tokenAddress
                },
                accountAddress: '0x1c79EdcaC6F24D7C3069339FFD09dA5DaF4E487f',
                startAmount: (floorPrice / 100) * 99
            });

            console.log(offer)
        }

        if (currentHolderIdx < allHolders.length) {
            currentHolderIdx++;
            await sendOfferToHolder(floorPrice);
        }
    } catch (err) {
        console.log(clc.red(err));
        // wait for 10s because of api rate limit
        await new Promise(resolve => setTimeout(resolve, 10000));
        await sendOfferToHolder(floorPrice);
    }
}

async function sendOfferToEveryHolder(floorPrice) {
    try {
        const offer = await seaport.createBundleBuyOrder({
            assets: allHolders.filter(holder => holder.accountAddress !== '0x1c79EdcaC6F24D7C3069339FFD09dA5DaF4E487f'),
            accountAddress: '0x1c79EdcaC6F24D7C3069339FFD09dA5DaF4E487f',
            startAmount: (floorPrice / 100) * 99,
            expirationTime: Math.round(Date.now() / 1000 + 60 * 60 * 24) // One day from now
        });

        console.log(offer);
    } catch (err) {
        console.log(clc.red(err));
    }
}