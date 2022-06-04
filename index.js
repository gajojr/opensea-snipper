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

    // const floorPriceInCollection = await getLowestPriceFromNftCollection(addressOfCollection);
    const holders = await getOwnersOfNftsFromGivenCollection(addressOfCollection);
    console.log(holders.length);
    // await placeOrderToEveryOwner(holders, floorPriceInCollection);
})();

async function getLowestPriceFromNftCollection(collectionAddress) {
    try {
        const lowestPriceInCollection = await Moralis.Web3API.token.getNFTLowestPrice({
            address: collectionAddress,
            chain: '0x4'
        });

        const priceInEth = Moralis.Units.FromWei(lowestPriceInCollection.price);
        console.log(`Floor price of this collection is: ${clc.yellow(priceInEth)} ETH`);

        return priceInEth;
    } catch (err) {
        console.log(clc.red(err));
    }
}

async function getOwnersOfNftsFromGivenCollection(collectionAddress) {
    try {
        let allHolders = [];

        // returns holders list with next function for pagination
        let holdersList = await Moralis.Web3API.token.getNFTOwners({
            address: collectionAddress,
            chain: '0x4'
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
        console.log(clc.red(err));
    }
}

// pass array of owners to this function and loop through them and send them buy order
async function placeOrderToEveryOwner(holders, floorPrice) {
    try {
        const holder = holders[0];
        console.log(holder)
        console.log((floorPrice / 100) * 99);

        await Moralis.Plugins.opensea.createBuyOrder({
            network: 'testnet',
            tokenAddress: holder.token_address,
            tokenId: holder.token_id,
            tokenType: 'ERC721',
            amount: (floorPrice / 100) * 99,
            userAddress: '0x1c79EdcaC6F24D7C3069339FFD09dA5DaF4E487f',
            paymentTokenAddress: '0x2170ed0880ac9a755fd29b2688956bd959f933f8',
        });
    } catch (err) {
        console.log(clc.red(err));
    }
}