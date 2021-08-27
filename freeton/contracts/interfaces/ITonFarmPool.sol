pragma ton-solidity ^0.39.0;
pragma AbiHeader expire;

interface ITonFarmPool {
    // Events
    event Deposit(address user, uint128 amount);
    event Withdraw(address user, uint128 amount);
    event Reward(address user, uint128[] amount);
    event RewardDeposit(address token_root, uint128 amount);

    struct RewardRound {
        uint32 startTime;
        uint128[] rewardPerSecond;
    }

    struct Details {
        uint32 lastRewardTime;
        uint32 farmEndTime;
        uint32 vestingPeriod;
        uint32 vestingRatio;
        address tokenRoot;
        address tokenWallet;
        uint128 tokenBalance;
        RewardRound[] rewardRounds;
        uint256[] accTonPerShare;
        address[] rewardTokenRoot;
        address[] rewardTokenWallet;
        uint128[] rewardTokenBalance;
        uint128[] rewardTokenBalanceCumulative;
        uint128[] unclaimedReward;
        address owner;
        address fabric;
    }
    function finishDeposit(
        uint64 _nonce,
        uint128[] vested
    ) external;
    function finishWithdraw(
        address user,
        uint128 withdrawAmount,
        uint128[] vested,
        address send_gas_to
    ) external;
    function finishSafeWithdraw(address user, uint128 amount, address send_gas_to) external;
}
