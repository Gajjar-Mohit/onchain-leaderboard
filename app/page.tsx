"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Trophy,
  Wallet,
  Users,
  Activity,
  Zap,
  TrendingUp,
  Crown,
  Circle,
  AlertCircle,
  Star,
  Target,
  Shield,
} from "lucide-react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ethers } from "ethers";
import ABI from "./utils/abi.json";

interface User {
  id: string;
  address: string;
  score: number;
  rank: number;
  change: string;
}

const CONTRACT_ADDRESS = "0xBb6954A97dcaFF385b8B93F3f174136A7D7596fF";

export default function OnChainLeaderboard() {
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [interactions, setInteractions] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false); // New state for registration process
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();

  useEffect(() => {
    if (wallets.length > 0) {
      setIsWalletConnected(true);
    } else {
      setIsWalletConnected(false);
    }
  }, [wallets]);

  const getContract = useCallback(async () => {
    if (!isWalletConnected) {
      throw new Error("No wallet connected");
    }
    try {
      const wallet = wallets[0];
      const provider = await wallet.getEthereumProvider();
      const ethersProvider = new ethers.BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      return new ethers.Contract(CONTRACT_ADDRESS, ABI.abi, signer);
    } catch (error: any) {
      setErrorMessage("Failed to initialize contract: " + error.message);
      throw error;
    }
  }, [isWalletConnected, wallets]);

  const checkUserRegistration = useCallback(async () => {
    if (!isWalletConnected) return;
    try {
      const contract = await getContract();
      const userData = await contract.getUser(wallets[0].address);
      if (userData.userAddress === ethers.ZeroAddress) {
        setIsRegistered(false);
      } else {
        setIsRegistered(true);
        setCurrentUser({
          id: userData.id.toString(),
          address: userData.userAddress,
          score: Number(userData.score),
          rank: Number(userData.rank),
          change: "+0",
        });
      }
    } catch (error: any) {
      if (error.message.includes("User not registered")) {
        setIsRegistered(false);
      } else {
        setErrorMessage("Failed to check registration: " + error.message);
      }
    }
  }, [isWalletConnected, getContract, wallets]);

  const fetchLeaderboard = useCallback(async () => {
    if (!isWalletConnected) return;
    setIsLoadingLeaderboard(true);
    try {
      const contract = await getContract();
      const leaderboardData = await contract.getLeaderboard(10);
      const formattedUsers = leaderboardData.map((user: any) => ({
        id: user.id.toString(),
        address: user.userAddress,
        score: Number(user.score),
        rank: Number(user.rank),
        change: "+0",
      }));
      setUsers(formattedUsers);
    } catch (error: any) {
      setErrorMessage("Failed to load leaderboard: " + error.message);
      setUsers([]);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  }, [isWalletConnected, getContract]);

  const registerUser = useCallback(async () => {
    if (!isWalletConnected || isRegistered || isRegistering) return;
    setIsRegistering(true);
    setErrorMessage("Registering user...");
    try {
      const contract = await getContract();
      const tx = await contract.registerUser(wallets[0].address, {
        gasLimit: 200000,
      });
      await tx.wait();
      setIsRegistered(true);
      setErrorMessage("Registration successful!");
      await checkUserRegistration();
      await fetchLeaderboard();
    } catch (error: any) {
      if (error.message.includes("User already registered")) {
        setErrorMessage("User already registered");
      } else if (error.message.includes("insufficient funds")) {
        setErrorMessage("Insufficient funds for gas");
      } else if (error.message.includes("network error")) {
        setErrorMessage("Network error, please try again");
      } else {
        setErrorMessage("Failed to register: " + error.message);
      }
    } finally {
      setIsRegistering(false);
    }
  }, [
    isWalletConnected,
    isRegistered,
    isRegistering,
    getContract,
    wallets,
    checkUserRegistration,
    fetchLeaderboard,
  ]);

  const handleInteraction = useCallback(async () => {
    if (!isWalletConnected || !isRegistered || isPlaying) {
      setErrorMessage("Please register before climbing the leaderboard");
      return;
    }
    setIsPlaying(true);
    setErrorMessage(null);
    try {
      const contract = await getContract();
      const basePoints = 25;
      const streakBonus = Math.min(streak * 5, 100);
      const totalPoints = basePoints + streakBonus;
      const tx = await contract.climb(wallets[0].address, totalPoints, {
        gasLimit: 150000,
      });
      await tx.wait();
      setInteractions((prev) => prev + 1);
      setStreak((prev) => prev + 1);
      setCurrentUser((prev) => {
        if (!prev) return prev;
        const newScore = prev.score + totalPoints;
        return {
          ...prev,
          score: newScore,
          change: `+${totalPoints}`,
        };
      });
      await fetchLeaderboard();
      setErrorMessage("Points added successfully!");
    } catch (error: any) {
      setErrorMessage(
        error.message.includes("User not registered")
          ? "Please register before climbing"
          : "Failed to climb: " + error.message
      );
    } finally {
      setIsPlaying(false);
    }
  }, [
    isWalletConnected,
    isRegistered,
    isPlaying,
    streak,
    getContract,
    wallets,
    fetchLeaderboard,
  ]);

  const setupEventListeners = useCallback(async () => {
    if (!isWalletConnected) return;
    try {
      const contract = await getContract();
      contract.on("ScoreUpdated", (userAddress, newScore, newRank) => {
        if (userAddress.toLowerCase() === wallets[0]?.address.toLowerCase()) {
          setCurrentUser((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              score: Number(newScore),
              rank: Number(newRank),
              change: `+${Number(newScore) - prev.score}`,
            };
          });
        }
        fetchLeaderboard();
      });
      contract.on("LeaderboardUpdated", () => {
        fetchLeaderboard();
      });
      contract.on("UserRegistered", (userAddress, id) => {
        if (userAddress.toLowerCase() === wallets[0]?.address.toLowerCase()) {
          setIsRegistered(true);
          checkUserRegistration();
          setErrorMessage("Registration successful!");
        }
      });
    } catch (error: any) {
      setErrorMessage("Failed to set up event listeners: " + error.message);
    }
  }, [
    isWalletConnected,
    getContract,
    wallets,
    fetchLeaderboard,
    checkUserRegistration,
  ]);

  useEffect(() => {
    if (ready && authenticated && isWalletConnected) {
      const initialize = async () => {
        await fetchLeaderboard();
        await setupEventListeners();
        await checkUserRegistration();
        // if (!isRegistered) {
        //   await registerUser();
        // }
      };
      initialize();
    }
  }, [
    ready,
    authenticated,
    isWalletConnected,
    checkUserRegistration,
    registerUser,
    fetchLeaderboard,
    setupEventListeners,
  ]);

  const handleLogin = async () => {
    setErrorMessage(null);
    if (authenticated) {
      await logout();
      setIsWalletConnected(false);
      setCurrentUser(null);
      setIsRegistered(false);
      setInteractions(0);
      setStreak(0);
      setUsers([]);
    } else {
      try {
        await login({
          loginMethods: ["wallet"],
          walletChainType: "ethereum-only",
        });
      } catch (error: any) {
        setErrorMessage("Failed to login: " + error.message);
      }
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-4 h-4" />;
    if (rank === 2) return <Trophy className="w-4 h-4 " />;
    if (rank === 3) return <Trophy className="w-4 h-4 " />;
    return null;
  };

  // Welcome screen content for non-authenticated users
  const WelcomeScreen = () => (
    <div className="text-center py-16">
      <div className="max-w-2xl mx-auto">
        <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-2xl">
          <Trophy className="w-12 h-12 text-white" />
        </div>

        <h2 className="text-4xl font-bold text-white mb-6">
          Welcome to the On-Chain Leaderboard
        </h2>

        <p className="text-xl text-slate-400 mb-12 leading-relaxed">
          Compete with others, climb the rankings, and prove your dominance in
          our blockchain-powered leaderboard system.
        </p>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Shield className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Secure & Transparent
            </h3>
            <p className="text-slate-400 text-sm">
              All scores and rankings are stored on-chain for complete
              transparency and immutability.
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Target className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Competitive Scoring
            </h3>
            <p className="text-slate-400 text-sm">
              Earn points through interactions and build streaks to maximize
              your climbing potential.
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Star className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Real-time Updates
            </h3>
            <p className="text-slate-400 text-sm">
              Watch your rank change instantly as you and others compete for the
              top positions.
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl p-8 border border-blue-500/20 mb-8">
          <h3 className="text-2xl font-bold text-white mb-4">
            Ready to Start Climbing?
          </h3>
          <p className="text-slate-300 mb-6">
            Connect your wallet to join the competition and start earning
            points.
          </p>
          <Button
            onClick={handleLogin}
            size="lg"
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-8 py-4 rounded-xl transition-all duration-300 hover:scale-105 shadow-lg"
          >
            <Wallet className="w-5 h-5 mr-3" />
            Connect Wallet to Begin
          </Button>
        </div>

        <div className="flex items-center justify-center gap-6 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <Circle className="w-2 h-2 fill-green-400" />
            <span>Ethereum Network</span>
          </div>
          <div className="flex items-center gap-2">
            <Circle className="w-2 h-2 fill-blue-400" />
            <span>Real-time Scoring</span>
          </div>
          <div className="flex items-center gap-2">
            <Circle className="w-2 h-2 fill-purple-400" />
            <span>On-chain Verified</span>
          </div>
        </div>
      </div>
    </div>
  );

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">Leaderboard</h1>
              <p className="text-slate-400 mt-2">
                On-chain performance tracking
              </p>
            </div>
          </div>
          <Button
            onClick={handleLogin}
            className="bg-white text-black hover:bg-slate-200 px-8 py-3 font-semibold rounded-xl transition-all duration-300 hover:scale-105 shadow-lg"
          >
            <Wallet className="w-5 h-5 mr-2" />
            {isWalletConnected ? "Disconnect" : "Connect Wallet"}
          </Button>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {errorMessage}
          </div>
        )}

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Leaderboard */}
          <div className="lg:col-span-3">
            <Card className="bg-slate-900 border-slate-800 shadow-2xl">
              <CardHeader className="border-b border-slate-800 pb-6">
                <CardTitle className="text-white flex items-center gap-3 text-xl font-bold">
                  <Users className="w-6 h-6" />
                  Rankings
                  {isWalletConnected && (
                    <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
                      Live
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!isWalletConnected ? (
                  <WelcomeScreen />
                ) : isLoadingLeaderboard ? (
                  <div className="p-12 text-center">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading leaderboard...</p>
                  </div>
                ) : users.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 bg-slate-800 rounded-xl flex items-center justify-center mx-auto mb-6 border border-slate-700">
                      <Trophy className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Be the First to Climb!
                    </h3>
                    <p className="text-slate-400 mb-6">
                      No competitors yet. Register and start climbing to claim
                      the #1 spot.
                    </p>
                    {!isRegistered && (
                      <Button
                        onClick={registerUser}
                        disabled={isRegistering}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition-all duration-300"
                      >
                        <Trophy className="w-4 h-4 mr-2" />
                        {isRegistering ? "Registering..." : "Claim Your Spot"}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {users.map((user) => (
                      <div
                        key={user.id}
                        className={`flex items-center justify-between p-6 transition-all duration-300 hover:bg-slate-800/50 group ${
                          user.id === currentUser?.id
                            ? "bg-slate-800 border-l-4 border-l-blue-500"
                            : ""
                        }`}
                      >
                        <div className="flex items-center gap-6">
                          <div
                            className={`flex items-center justify-center w-12 h-12 rounded-xl font-bold text-lg transition-all duration-300 group-hover:scale-110 ${
                              user.rank === 1
                                ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-black shadow-lg"
                                : user.rank === 2
                                ? "bg-gradient-to-br from-slate-300 to-slate-500 text-black shadow-lg"
                                : user.rank === 3
                                ? "bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-lg"
                                : "bg-slate-800 text-slate-300 border border-slate-700"
                            }`}
                          >
                            {getRankIcon(user.rank) || user.rank}
                          </div>
                          <div>
                            <p className="text-white font-semibold font-mono text-lg group-hover:text-slate-300 transition-colors">
                              {user.address.slice(0, 6) +
                                "..." +
                                user.address.slice(-4)}
                            </p>
                            <div className="flex items-center gap-3 mt-1">
                              <p className="text-slate-500 text-sm">
                                Rank #{user.rank}
                              </p>
                              <Badge
                                className={`text-xs ${
                                  user.change.startsWith("+")
                                    ? "bg-green-500/10 text-green-400 border-green-500/20"
                                    : "bg-red-500/10 text-red-400 border-red-500/20"
                                }`}
                              >
                                {user.change}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-bold text-2xl group-hover:text-slate-300 transition-colors">
                            {user.score.toLocaleString()}
                          </p>
                          <p className="text-slate-500 text-sm">points</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Interaction Panel */}
            <Card className="bg-slate-900 border-slate-800 shadow-2xl">
              <CardHeader className="border-b border-slate-800 pb-6">
                <CardTitle className="text-white flex items-center gap-3 text-xl font-bold">
                  <Activity className="w-6 h-6" />
                  Interact
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {isWalletConnected ? (
                  !isRegistered ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                        <Wallet className="w-8 h-8 text-white" />
                      </div>
                      <p className="text-slate-400 mb-6">
                        {isRegistering
                          ? "Registering your account..."
                          : "Register to start climbing the leaderboard"}
                      </p>
                      <Button
                        onClick={registerUser}
                        disabled={isRegistering}
                        className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white transition-all duration-300 hover:scale-105 shadow-lg"
                      >
                        <Wallet className="w-4 h-4 mr-2" />
                        {isRegistering ? "Registering..." : "Register"}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="relative">
                        <Button
                          onClick={handleInteraction}
                          disabled={isPlaying}
                          className={`w-full h-20 text-xl font-bold rounded-xl transition-all duration-300 shadow-lg ${
                            isPlaying
                              ? "bg-slate-700 scale-95"
                              : "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white hover:scale-105"
                          }`}
                        >
                          <Zap className="w-6 h-6 mr-3" />
                          {isPlaying ? "Processing..." : "Climb Ranks"}
                        </Button>
                        {streak > 0 && (
                          <div className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                            {streak}x
                          </div>
                        )}
                      </div>
                      <div className="space-y-4 p-4 bg-slate-800 rounded-xl border border-slate-700">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Interactions</span>
                          <span className="text-white font-bold text-lg">
                            {interactions}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Streak Bonus</span>
                          <span className="text-yellow-400 font-bold">
                            +{Math.min(streak * 5, 100)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Base Points</span>
                          <span className="text-green-400 font-bold">+25</span>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                      <Wallet className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-slate-400 mb-6">
                      Connect wallet to start competing
                    </p>
                    <Button
                      onClick={handleLogin}
                      className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white transition-all duration-300 hover:scale-105 shadow-lg"
                    >
                      <Wallet className="w-4 h-4 mr-2" />
                      Connect
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* User Stats */}
            {isWalletConnected && currentUser && isRegistered && (
              <Card className="bg-slate-900 border-slate-800 shadow-2xl">
                <CardHeader className="border-b border-slate-800 pb-6">
                  <CardTitle className="text-white text-xl font-bold">
                    Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-slate-800 rounded-lg">
                      <span className="text-slate-400">Current Rank</span>
                      <Badge className="bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold">
                        #{currentUser.rank}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-800 rounded-lg">
                      <span className="text-slate-400">Total Score</span>
                      <span className="text-white font-bold text-lg">
                        {currentUser.score.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-800 rounded-lg">
                      <span className="text-slate-400">Current Streak</span>
                      <span className="text-yellow-400 font-bold">
                        {streak}x
                      </span>
                    </div>
                    <div className="pt-4 border-t border-slate-800">
                      <div className="flex items-center gap-2 text-sm text-green-400">
                        <Circle className="w-2 h-2 fill-green-400" />
                        <span>On-chain verified</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Network Status */}
            <Card className="bg-slate-900 border-slate-800 shadow-2xl">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Network</span>
                    <span className="text-white font-semibold">Ethereum</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Status</span>
                    <div className="flex items-center gap-2">
                      <Circle className="w-2 h-2 fill-green-400" />
                      <span className="text-green-400 font-semibold">
                        Active
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Gas Price</span>
                    <span className="text-white font-semibold">12 gwei</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
