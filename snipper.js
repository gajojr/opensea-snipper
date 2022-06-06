require('dotenv').config();
const axios = require('axios');
const clc = require('cli-color');
const prompt = require('prompt-sync')();
const Web3 = require('web3');
const { OpenSeaPort, Network } = require('opensea-js');

// const opensea = require("opensea-js");
// const { WyvernSchemaName } = require('opensea-js/lib/types');
// const OpenSeaPort = opensea.OpenSeaPort;
// const Network = opensea.Network;
// const MnemonicWalletSubprovider = require("@0x/subproviders")
//   .MnemonicWalletSubprovider;
// const RPCSubprovider = require("web3-provider-engine/subproviders/rpc");
// const Web3ProviderEngine = require("web3-provider-engine");

// const BASE_DERIVATION_PATH = `44'/60'/0'/0`;
// const mnemonicWalletSubprovider = new MnemonicWalletSubprovider({
// 	mnemonic: MNEMONIC,
// 	baseDerivationPath: BASE_DERIVATION_PATH,
//   });
//   const network =
//   NETWORK === "mainnet" || NETWORK === "live" ? "mainnet" : "rinkeby";
// const infuraRpcSubprovider = new RPCSubprovider({
//   rpcUrl: isInfura
//     ? "https://" + network + ".infura.io/v3/" + NODE_API_KEY
//     : "https://eth-" + network + ".alchemyapi.io/v2/" + NODE_API_KEY,
// });

// const providerEngine = new Web3ProviderEngine();
// providerEngine.addProvider(mnemonicWalletSubprovider);
// providerEngine.addProvider(infuraRpcSubprovider);
// providerEngine.start();

// const seaport = new OpenSeaPort(
//   providerEngine,
//   {
//     networkName:
//       NETWORK === "mainnet" || NETWORK === "live"
//         ? Network.Main
//         : Network.Rinkeby,
//     apiKey: API_KEY,
//   },
//   (arg) => console.log(arg)
// );

// This example provider won't let you make transactions, only read-only calls:
const provider = new Web3.providers.HttpProvider('https://mainnet.infura.io');

const seaport = new OpenSeaPort(provider, {
    networkName: Network.Main,
    apiKey: process.env.OPENSEA_API_KEY
});

const collectionSlug = prompt('Please enter the slug of nft collection:');

if (!collectionSlug.length) {
    console.log(clc.red(`You haven't entered collection slug, exiting the program...`));
    return;
}

// keep global since holders fetching is done through pagination
// and errors might occur with status 429
let allHolders = [];
let nextCursor = '';

async function main() {
    const floorPrice = await getFloorPriceBySlug(collectionSlug);
    await getAllHoldersFromCollection(collectionSlug);

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
                contractAddress: asset.asset_contract.address,
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

async function sendOfferToEveryHolder(floorPrice) {
    // Token ID and smart contract address for a non-fungible token:
    const { tokenId, tokenAddress } = YOUR_ASSET;
    // The offerer's wallet address:
    const accountAddress = "0x1234...";

    const offer = await seaport.createBuyOrder({
        asset: {
            tokenId,
            tokenAddress,
            // schemaName WyvernSchemaName. If omitted, defaults to 'ERC721'. Other options include 'ERC20' and 'ERC1155'
        },
        accountAddress,
        // Value of the offer, in units of the payment token (or wrapped ETH if none is specified):
        startAmount: 1.2,
    });
}