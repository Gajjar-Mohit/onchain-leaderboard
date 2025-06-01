// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

contract Leaderboard {
    struct User {
        uint id;
        address userAddress;
        uint score;
        uint rank;
    }
    mapping(address => User) public users;
    address[] public leaderboard;
    uint public userCount;
    event UserRegistered(address indexed userAddress, uint id);
    event ScoreUpdated(
        address indexed userAddress,
        uint newScore,
        uint newRank
    );
    event LeaderboardUpdated();
    modifier onlyRegistered(address userAddress) {
        require(
            users[userAddress].userAddress != address(0),
            "User not registered"
        );
        _;
    }

    function registerUser(address userAddress) public {
        require(
            users[userAddress].userAddress == address(0),
            "User already registered"
        );
        userCount++;
        users[userAddress] = User({
            id: userCount,
            userAddress: userAddress,
            score: 0,
            rank: 0
        });
        leaderboard.push(userAddress);
        emit UserRegistered(userAddress, userCount);
    }

    function climb(
        address userAddress,
        uint scoreIncrement
    ) public onlyRegistered(userAddress) {
        users[userAddress].score += scoreIncrement;
        updateLeaderboard();
        emit ScoreUpdated(
            userAddress,
            users[userAddress].score,
            users[userAddress].rank
        );
    }

    function updateLeaderboard() internal {
        for (uint i = 0; i < leaderboard.length; i++) {
            for (uint j = i + 1; j < leaderboard.length; j++) {
                if (users[leaderboard[i]].score < users[leaderboard[j]].score) {
                    address temp = leaderboard[i];
                    leaderboard[i] = leaderboard[j];
                    leaderboard[j] = temp;
                }
            }
        }
        uint currentRank = 0;
        uint lastScore = type(uint).max;
        for (uint i = 0; i < leaderboard.length; i++) {
            address userAddress = leaderboard[i];
            if (users[userAddress].score < lastScore) {
                currentRank = i + 1;
                lastScore = users[userAddress].score;
            }
            users[userAddress].rank = currentRank;
        }
        emit LeaderboardUpdated();
    }

    function getLeaderboard(uint limit) public view returns (User[] memory) {
        uint length = limit > leaderboard.length ? leaderboard.length : limit;
        User[] memory topUsers = new User[](length);
        for (uint i = 0; i < length; i++) {
            topUsers[i] = users[leaderboard[i]];
        }
        return topUsers;
    }

    function getUser(address userAddress) public view returns (User memory) {
        require(
            users[userAddress].userAddress != address(0),
            "User not registered"
        );
        return users[userAddress];
    }

    function isUserRegistered(address userAddress) public view returns (bool) {
        return users[userAddress].userAddress != address(0);
    }
}
