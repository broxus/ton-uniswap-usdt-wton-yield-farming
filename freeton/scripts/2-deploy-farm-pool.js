const {
    convertCrystal
} = locklift.utils;

const fs = require('fs')
let deploy_params = JSON.parse(fs.readFileSync('pool_config.json', 'utf-8'))
const BigNumber = require('bignumber.js');

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const afterRun = async (tx) => {
    if (locklift.network === 'dev' || locklift.network == 'main') {
        await sleep(80000);
    }
};

const getRandomNonce = () => Math.random() * 64000 | 0;

const stringToBytesArray = (dataString) => {
    return Buffer.from(dataString).toString('hex')
};

async function main() {
    console.log(`Deploying Farm Pool with next params:`);
    console.dir(deploy_params, {depth: null, colors: true});
    const [keyPair] = await locklift.keys.getKeyPairs();

    const fabric = await locklift.factory.getContract(
        'FarmFabric',
        './build'
    );
    fabric.setAddress(deploy_params.fabric);
    fabric.setKeyPair(keyPair);
    delete deploy_params.fabric;

    const Account = await locklift.factory.getAccount();
    const admin_user = await locklift.giver.deployContract({
        contract: Account,
        constructorParams: {},
        initParams: {
            _randomNonce: getRandomNonce()
        },
        keyPair,
    }, convertCrystal(10, 'nano'));
    admin_user.setKeyPair(keyPair);
    admin_user.afterRun = afterRun;

    console.log(`Deployed account: ${admin_user.address}`);

    await admin_user.runTarget({
        contract: fabric,
        method: 'deployFarmPool',
        params: deploy_params,
        value: convertCrystal(6, 'nano')
    });

    const {
        value: {
            pool: _pool,
            owner: _owner,
            rewardPerSecond: _rewardPerSecond,
            farmStartTime: _farmStartTime,
            farmEndTime: _farmEndTime,
            tokenRoot: _tokenRoot,
            rewardTokenRoot: _rewardTokenRoot
        }
    } = (await fabric.getEvents('NewFarmPool')).pop();

    console.log(`Farm Pool address: ${_pool}`);
    // Wait until farm farm pool is indexed
    await locklift.ton.client.net.wait_for_collection({
        collection: 'accounts',
        filter: {
            id: { eq: _pool },
            balance: { gt: `0x0` }
        },
        result: 'id'
    });

    const _farm_pool = await locklift.factory.getContract(
        'TonFarmPool',
        './build'
    );
    _farm_pool.setAddress(_pool);
    farm_pool = _farm_pool;

    const root = await locklift.factory.getContract(
        'RootTokenContract',
        './node_modules/broxus-ton-tokens-contracts/free-ton/build'
    );
    root.setAddress(deploy_params.tokenRoot);

    const expectedWalletAddr = await root.call({
        method: 'getWalletAddress',
        params: {
            wallet_public_key_: 0,
            owner_address_: farm_pool.address
        }
    });

    // Wait until farm token wallet is indexed
    await locklift.ton.client.net.wait_for_collection({
        collection: 'accounts',
        filter: {
            id: { eq: expectedWalletAddr },
            balance: { gt: `0x0` }
        },
        result: 'id'
    });

    // we wait until last msg in deploy chain is indexed
    // last msg is setReceiveCallback from farm pool to token wallet
    await locklift.ton.client.net.wait_for_collection({
        collection: 'messages',
        filter: {
            dst: { eq: expectedWalletAddr },
            src: { eq: farm_pool.address },
            // this is the body of setReceiveCallback call
            // body: { eq: `te6ccgEBAQEAKAAAS3Hu6HWABHVBJcgv7aQ+zPFad/KtOJMATapHjRzEbZYcCnx3Xrmo` }
            // try catch by value
            value: { eq: "0x2ebae40" },
            status: { eq: 5 }
        },
        result: 'id',
        timeout: 120000
    });


    const farm_pool_wallet_addr = await farm_pool.call({method: 'tokenWallet'});
    console.log(`Farm Pool token wallet: ${farm_pool_wallet_addr}`);

    farm_pool_wallet = await locklift.factory.getContract(
        'TONTokenWallet',
        './node_modules/broxus-ton-tokens-contracts/free-ton/build'
    );
    farm_pool_wallet.setAddress(farm_pool_wallet_addr);

    const farm_pool_reward_wallet_addr = await farm_pool.call({method: 'rewardTokenWallet'});
    console.log(`Farm Pool reward token wallet: ${farm_pool_reward_wallet_addr}`);

    farm_pool_reward_wallet = await locklift.factory.getContract(
        'TONTokenWallet',
        './node_modules/broxus-ton-tokens-contracts/free-ton/build'
    );
    farm_pool_reward_wallet.setAddress(farm_pool_reward_wallet_addr);
    await afterRun();
    // call in order to check if wallet is deployed
    const details = await farm_pool_wallet.call({method: 'getDetails'});
    console.log(`Farm pool token details:`)
    for (let [key, value] of Object.entries(details)) {
        if (BigNumber.isBigNumber(value)) {
            value = value.toNumber();
        }
        console.log(`${key}: ${value}`);
    }

    // call in order to check if wallet is deployed
    // call in order to check if wallet is deployed
    const details2 = await farm_pool_wallet.call({method: 'getDetails'});
    console.log(`\nFarm pool reward token details:`)
    for (let [key, value] of Object.entries(details2)) {
        if (BigNumber.isBigNumber(value)) {
            value = value.toNumber();
        }
        console.log(`${key}: ${value}`);
    }
}


main()
    .then(() => process.exit(0))
    .catch(e => {
        console.log(e);
        process.exit(1);
    });