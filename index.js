require('dotenv').config();
const Moralis = require('moralis/node');
const clc = require('cli-color');
const prompt = require('prompt-sync')();

const addressOfCollection = prompt('Please enter the address of nft collection:');

if (!addressOfCollection.length) {
    console.log(clc.red(`You haven't entered collection address, exiting the program...`));
    return;
}

(async() => {
    // start the moralis server that plugin is installed on
    await Moralis.start({
        serverUrl: process.env.SERVER_URL,
        appId: process.env.APP_ID,
        masterKey: process.env.MASTER_KEY
    });

    const floorPriceInCollection = await getLowestPriceFromNftCollection(addressOfCollection);
    const holders = await getOwnersOfNftsFromGivenCollection(addressOfCollection);

    // await placeOrderToEveryOwner(holders);
})();

async function getLowestPriceFromNftCollection(collectionAddress) {
    try {
        const lowestPriceInCollection = await Moralis.Web3API.token.getNFTLowestPrice({
            address: collectionAddress
        });

        const priceInEth = Moralis.Units.FromWei(lowestPriceInCollection.price);
        console.log(`Floor price of this collection is: ${clc.yellow(priceInEth)} ETH`);

        return priceInEth;
    } catch (err) {
        console.log(err);
    }
}

async function getOwnersOfNftsFromGivenCollection(collectionAddress) {
    try {
        let allHolders = [];

        // returns holders list with next function for pagination
        let holdersList = await Moralis.Web3API.token.getNFTOwners({
            address: collectionAddress
        });

        /*
        	token_address -> contract address
        	token_id -> index in collection
        	owner_of -> wallet of owner
        */
        holdersList = {
            list: holdersList.result.map(({ token_address, token_id, owner_of }) => ({
                token_address,
                token_id,
                owner_of
            })),
            next: holdersList.next
        };

        allHolders = [...holdersList.list];

        while (holdersList.next) {
            holdersList = await holdersList.next();
            allHolders = [...allHolders, ...holdersList.result.map(({ token_address, token_id, owner_of }) => ({
                token_address,
                token_id,
                owner_of
            }))];
        }

        // list of all holders
        return allHolders;
    } catch (err) {
        console.log(err);
    }
}

async function placeOrderToEveryOwner(holders) {
    // pass array of owners to this function and loop through them and send them buy order
    try {
        await Moralis.Plugins.opensea.createBuyOrder()
    } catch (err) {
        console.log(err);
    }
}