require('dotenv').config();
const axios = require('axios');
const clc = require('cli-color');
const prompt = require('prompt-sync')();

const collectionSlug = prompt('Please enter the slug of nft collection:');

if (!collectionSlug.length) {
    console.log(clc.red(`You haven't entered collection slug, exiting the program...`));
    return;
}

// keep global since holders fetching is done through pagination
let allHolders = [];
let nextCursor = '';

async function main() {
    // const floorPrice = await getFloorPriceBySlug(collectionSlug);
    await getAllHoldersFromCollection(collectionSlug);
    console.log(allHolders.length);
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
        while (true) {
            res = await axios.get(`https://api.opensea.io/api/v1/assets`, {
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

            holdersList = {
                list: res.data.assets.map(asset => ({
                    contractAddress: asset.asset_contract.address,
                    tokenId: asset.token_id,
                    ownerAddress: asset.owner.address
                })),
                next: res.data.next
            };

            allHolders = [...allHolders, ...holdersList.list];

            if (!res.data.next) {
                break;
            }

            nextCursor = holdersList.next;
        }
    } catch (err) {
        console.log(clc.red(err));
        // wait for 10s because of api rate limit
        await new Promise(resolve => setTimeout(resolve, 10000));
        await getAllHoldersFromCollection(slug);
    }
}