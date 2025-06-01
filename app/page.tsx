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
  Crown,
  Circle,
  AlertCircle,
  Star,
  Target,
  Shield,
  AlertTriangle,
  Menu,
  X,
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

const CONTRACT_ADDRESS = "0xe03C50865567Fcf026037F290C5a42c68A106f2b";
const SEPOLIA_CHAIN_ID = "0xaa36a7";
export default function OnChainLeaderboard() {
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [interactions, setInteractions] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCorrectChain, setIsCorrectChain] = useState(false);
  const [currentChainId, setCurrentChainId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();

  // Check if user is on the correct chain
  const checkChain = useCallback(async () => {
    if (!isWalletConnected || wallets.length === 0) return;

    try {
      const wallet = wallets[0];
      const provider = await wallet.getEthereumProvider();
      const chainId = await provider.request({ method: "eth_chainId" });
      setCurrentChainId(chainId);
      setIsCorrectChain(chainId === SEPOLIA_CHAIN_ID);
    } catch (error: any) {
      console.error("Error checking chain:", error);
      setErrorMessage("Failed to check network");
    }
  }, [isWalletConnected, wallets]);

  const switchToSepolia = useCallback(async () => {
    if (!isWalletConnected || wallets.length === 0) return;

    try {
      const wallet = wallets[0];
      const provider = await wallet.getEthereumProvider();

      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: SEPOLIA_CHAIN_ID }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: SEPOLIA_CHAIN_ID,
                chainName: "Sepolia Test Network",
                nativeCurrency: {
                  name: "SepoliaETH",
                  symbol: "SEP",
                  decimals: 18,
                },
                rpcUrls: [
                  "https://sepolia.infura.io/v3/469f00099e90495c85f43907abb72ffa",
                ],
                blockExplorerUrls: ["https://sepolia.etherscan.io/"],
              },
            ],
          });
        } else {
          throw switchError;
        }
      }

      // Recheck chain after switching
      setTimeout(checkChain, 1000);
    } catch (error: any) {
      setErrorMessage("Failed to switch network: " + error.message);
    }
  }, [isWalletConnected, wallets, checkChain]);

  useEffect(() => {
    if (wallets.length > 0) {
      setIsWalletConnected(true);
      checkChain();

      // Listen for chain changes
      const wallet = wallets[0];
      wallet.getEthereumProvider().then((provider: any) => {
        provider.on("chainChanged", (chainId: string) => {
          setCurrentChainId(chainId);
          setIsCorrectChain(chainId === SEPOLIA_CHAIN_ID);
        });
      });
    } else {
      setIsWalletConnected(false);
      setIsCorrectChain(false);
    }
  }, [wallets, checkChain]);

  const getContract = useCallback(async () => {
    if (!isWalletConnected || !isCorrectChain) {
      throw new Error("Wallet not connected or wrong network");
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
  }, [isWalletConnected, isCorrectChain, wallets]);

  const checkUserRegistration = useCallback(async () => {
    if (!isWalletConnected || !isCorrectChain) return;

    try {
      const contract = await getContract();
      // Use the isUserRegistered function instead of getUser to avoid revert
      const registered = await contract.isUserRegistered(wallets[0].address);
      setIsRegistered(registered);

      if (registered) {
        // Only call getUser if we know the user is registered
        try {
          const userData = await contract.getUser(wallets[0].address);
          setCurrentUser({
            id: userData.id.toString(),
            address: userData.userAddress,
            score: Number(userData.score),
            rank: Number(userData.rank),
            change: "+0",
          });
        } catch (error: any) {
          console.error("Error fetching user data:", error);
          setErrorMessage("Failed to fetch user data");
        }
      } else {
        setCurrentUser(null);
      }
    } catch (error: any) {
      console.error("Error checking registration:", error);
      setErrorMessage("Failed to check registration: " + error.message);
      setIsRegistered(false);
    }
  }, [isWalletConnected, isCorrectChain, getContract, wallets]);

  const fetchLeaderboard = useCallback(async () => {
    if (!isWalletConnected || !isCorrectChain) return;

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
      console.error("Error fetching leaderboard:", error);
      setErrorMessage("Failed to load leaderboard: " + error.message);
      setUsers([]);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  }, [isWalletConnected, isCorrectChain, getContract]);

  const registerUser = useCallback(async () => {
    if (!isWalletConnected || !isCorrectChain || isRegistered || isRegistering)
      return;

    setIsRegistering(true);
    setErrorMessage("Registering user...");
    try {
      const contract = await getContract();
      const tx = await contract.registerUser(wallets[0].address, {
        gasLimit: 200000,
      });

      setErrorMessage("Transaction submitted. Waiting for confirmation...");
      await tx.wait();

      setIsRegistered(true);
      setErrorMessage("Registration successful!");
      await checkUserRegistration();
      await fetchLeaderboard();
    } catch (error: any) {
      console.error("Registration error:", error);

      // Handle user rejection
      if (
        error.code === 4001 ||
        error.code === "ACTION_REJECTED" ||
        error.message?.includes("user rejected") ||
        error.message?.includes("User denied")
      ) {
        setErrorMessage(
          "Registration cancelled."
        );
        return;
      }

      // Handle contract reverts
      if (error.code === "CALL_EXCEPTION" && error.reason?.includes("revert")) {
        if (error.message.includes("User already registered")) {
          setErrorMessage("This wallet is already registered.");
          setIsRegistered(true);
        } else if (error.message.includes("insufficient gas")) {
          setErrorMessage(
            "Registration failed due to insufficient gas. Please try again."
          );
        } else {
          setErrorMessage(
            "Registration failed. Please try again or contact support."
          );
        }
        return;
      }

      // Handle insufficient funds
      if (error.message?.includes("insufficient funds")) {
        setErrorMessage(
          "Insufficient funds for gas fees. Please add ETH to your wallet."
        );
        return;
      }

      // Handle network errors
      if (
        error.message?.includes("network") ||
        error.code === "NETWORK_ERROR"
      ) {
        setErrorMessage(
          "Network error. Please check your connection and try again."
        );
        return;
      }

      // Generic fallback
      setErrorMessage("Registration failed. Please try again.");
    } finally {
      setIsRegistering(false);
    }
  }, [
    isWalletConnected,
    isCorrectChain,
    isRegistered,
    isRegistering,
    getContract,
    wallets,
    checkUserRegistration,
    fetchLeaderboard,
  ]);

  const handleInteraction = useCallback(async () => {
    if (!isWalletConnected || !isCorrectChain || !isRegistered || isPlaying) {
      setErrorMessage(
        "Please register and connect to the Sepolia network before climbing the leaderboard."
      );
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

      setErrorMessage("Transaction submitted. Climbing leaderboard...");
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
      console.error("Climb error:", error);

      // Handle user rejection
      if (
        error.code === 4001 ||
        error.code === "ACTION_REJECTED" ||
        error.message?.includes("user rejected") ||
        error.message?.includes("User denied")
      ) {
        setErrorMessage(
          "Transaction cancelled."
        );
        return;
      }

      // Handle contract reverts
      if (error.code === "CALL_EXCEPTION" && error.reason?.includes("revert")) {
        if (error.message.includes("User not registered")) {
          setErrorMessage("Please register before climbing the leaderboard.");
          setIsRegistered(false);
        } else if (error.message.includes("insufficient gas")) {
          setErrorMessage(
            "Transaction failed due to insufficient gas. Please try again."
          );
        } else {
          setErrorMessage(
            "Transaction failed. Please try again or contact support."
          );
        }
        return;
      }

      // Handle insufficient funds
      if (error.message?.includes("insufficient funds")) {
        setErrorMessage(
          "Insufficient funds for gas fees. Please add ETH to your wallet."
        );
        return;
      }

      // Handle network errors
      if (
        error.message?.includes("network") ||
        error.code === "NETWORK_ERROR"
      ) {
        setErrorMessage(
          "Network error. Please check your connection and try again."
        );
        return;
      }

      // Handle timeout errors
      if (error.message?.includes("timeout") || error.code === "TIMEOUT") {
        setErrorMessage("Transaction timed out. Please try again.");
        return;
      }

      // Generic fallback
      setErrorMessage("Transaction failed. Please try again.");
    } finally {
      setIsPlaying(false);
    }
  }, [
    isWalletConnected,
    isCorrectChain,
    isRegistered,
    isPlaying,
    streak,
    getContract,
    wallets,
    fetchLeaderboard,
  ]);

  const setupEventListeners = useCallback(async () => {
    if (!isWalletConnected || !isCorrectChain) return;

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
      console.error("Error setting up event listeners:", error);
      setErrorMessage("Failed to set up event listeners: " + error.message);
    }
  }, [
    isWalletConnected,
    isCorrectChain,
    getContract,
    wallets,
    fetchLeaderboard,
    checkUserRegistration,
  ]);

  useEffect(() => {
    if (ready && authenticated && isWalletConnected && isCorrectChain) {
      const initialize = async () => {
        await fetchLeaderboard();
        await setupEventListeners();
        await checkUserRegistration();
      };
      initialize();
    }
  }, [
    ready,
    authenticated,
    isWalletConnected,
    isCorrectChain,
    checkUserRegistration,
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
      setIsCorrectChain(false);
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

  // Network warning component
  const NetworkWarning = () => (
    <div className="mb-6 p-4 md:p-6 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-6 h-6 flex-shrink-0" />
        <div>
          <h3 className="font-semibold">Wrong Network</h3>
          <p className="text-sm">
            Please switch to Ethereum Sepolia Testnet to use this application.
          </p>
          {currentChainId && (
            <p className="text-xs mt-1">Current network: {currentChainId}</p>
          )}
        </div>
      </div>
      <Button
        onClick={switchToSepolia}
        className="bg-orange-500 hover:bg-orange-600 text-white w-full md:w-auto"
      >
        Switch Network
      </Button>
    </div>
  );

  const WelcomeScreen = () => (
    <div className="text-center py-8 md:py-16 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 md:mb-8 shadow-2xl">
          <Trophy className="w-10 h-10 md:w-12 md:h-12 text-white" />
        </div>

        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 md:mb-6">
          Welcome to the On-Chain Leaderboard
        </h2>

        <p className="text-lg md:text-xl text-slate-400 mb-8 md:mb-12 leading-relaxed">
          Compete with others, climb the rankings, and prove your dominance in
          our blockchain-powered leaderboard system.
        </p>

        <div className="grid md:grid-cols-3 gap-4 md:gap-8 mb-8 md:mb-12">
          <div className="bg-slate-800/50 rounded-xl p-4 md:p-6 border border-slate-700">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-3 md:mb-4">
              <Shield className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
            </div>
            <h3 className="text-base md:text-lg font-semibold text-white mb-2">
              Secure & Transparent
            </h3>
            <p className="text-slate-400 text-sm">
              All scores and rankings are stored on-chain for complete
              transparency and immutability.
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-4 md:p-6 border border-slate-700">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-3 md:mb-4">
              <Target className="w-5 h-5 md:w-6 md:h-6 text-green-400" />
            </div>
            <h3 className="text-base md:text-lg font-semibold text-white mb-2">
              Competitive Scoring
            </h3>
            <p className="text-slate-400 text-sm">
              Earn points through interactions and build streaks to maximize
              your climbing potential.
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-4 md:p-6 border border-slate-700">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mx-auto mb-3 md:mb-4">
              <Star className="w-5 h-5 md:w-6 md:h-6 text-purple-400" />
            </div>
            <h3 className="text-base md:text-lg font-semibold text-white mb-2">
              Real-time Updates
            </h3>
            <p className="text-slate-400 text-sm">
              Watch your rank change instantly as you and others compete for the
              top positions.
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl p-6 md:p-8 border border-blue-500/20 mb-6 md:mb-8">
          <h3 className="text-xl md:text-2xl font-bold text-white mb-3 md:mb-4">
            Ready to Start Climbing?
          </h3>
          <p className="text-slate-300 mb-4 md:mb-6">
            Connect your wallet to join the competition and start earning
            points.
          </p>
          <Button
            onClick={handleLogin}
            size="lg"
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-6 md:px-8 py-3 md:py-4 rounded-xl transition-all duration-300 hover:scale-105 shadow-lg w-full md:w-auto"
          >
            <Wallet className="w-5 h-5 mr-2 md:mr-3" />
            Connect Wallet to Begin
          </Button>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 text-xs md:text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <Circle className="w-2 h-2 fill-blue-400" />
            <span>Sepolia Testnet</span>
          </div>
          <div className="flex items-center gap-2">
            <Circle className="w-2 h-2 fill-green-400" />
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 md:mb-16">
          <div className="flex items-center gap-3 md:gap-6">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Trophy className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-white">
                Leaderboard
              </h1>
              <p className="text-sm md:text-base text-slate-400 mt-1 md:mt-2">
                On-chain performance tracking
              </p>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-white"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>

          {/* Desktop connect button */}
          <div className="hidden md:block">
            <Button
              onClick={handleLogin}
              className="bg-white text-black hover:bg-slate-200 px-6 md:px-8 py-2 md:py-3 font-semibold rounded-xl transition-all duration-300 hover:scale-105 shadow-lg"
            >
              <Wallet className="w-4 h-4 md:w-5 md:h-5 mr-2" />
              {isWalletConnected ? "Disconnect" : "Connect Wallet"}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mb-6 p-4 bg-slate-900 rounded-xl border border-slate-800 shadow-lg">
            <div className="space-y-4">
              <Button
                onClick={handleLogin}
                className="bg-white text-black hover:bg-slate-200 w-full py-2 font-semibold rounded-xl"
              >
                <Wallet className="w-4 h-4 mr-2" />
                {isWalletConnected ? "Disconnect" : "Connect Wallet"}
              </Button>

              {isWalletConnected && currentUser && (
                <div className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-sm text-slate-400">Connected as</p>
                  <p className="font-mono text-white truncate">
                    {currentUser.address}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Network Warning */}
        {isWalletConnected && !isCorrectChain && <NetworkWarning />}

        {/* Error Message */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl flex items-center gap-2 text-sm md:text-base">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        <div className="grid lg:grid-cols-4 gap-4 md:gap-8">
          {/* Leaderboard */}
          <div className="lg:col-span-3">
            <Card className="bg-slate-900 border-slate-800 shadow-2xl">
              <CardHeader className="border-b border-slate-800 pb-4 md:pb-6">
                <CardTitle className="text-white flex items-center gap-2 md:gap-3 text-lg md:text-xl font-bold">
                  <Users className="w-5 h-5 md:w-6 md:h-6" />
                  Rankings
                  {isWalletConnected && isCorrectChain && (
                    <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
                      Live
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!isWalletConnected ? (
                  <WelcomeScreen />
                ) : !isCorrectChain ? (
                  <div className="p-6 md:p-12 text-center">
                    <div className="w-14 h-14 md:w-16 md:h-16 bg-orange-500/20 rounded-xl flex items-center justify-center mx-auto mb-4 md:mb-6 border border-orange-500/20">
                      <AlertTriangle className="w-7 h-7 md:w-8 md:h-8 text-orange-400" />
                    </div>
                    <h3 className="text-lg md:text-xl font-semibold text-white mb-2">
                      Wrong Network
                    </h3>
                    <p className="text-slate-400 mb-4 md:mb-6">
                      Please switch to Ethereum Sepolia Testnet to access the
                      leaderboard.
                    </p>
                    <Button
                      onClick={switchToSepolia}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-4 md:px-6 py-2 md:py-3 rounded-lg transition-all duration-300"
                    >
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Switch to Sepolia
                    </Button>
                  </div>
                ) : isLoadingLeaderboard ? (
                  <div className="p-8 md:p-12 text-center">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading leaderboard...</p>
                  </div>
                ) : users.length === 0 ? (
                  <div className="p-6 md:p-12 text-center">
                    <div className="w-14 h-14 md:w-16 md:h-16 bg-slate-800 rounded-xl flex items-center justify-center mx-auto mb-4 md:mb-6 border border-slate-700">
                      <Trophy className="w-7 h-7 md:w-8 md:h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg md:text-xl font-semibold text-white mb-2">
                      Be the First to Climb!
                    </h3>
                    <p className="text-slate-400 mb-4 md:mb-6">
                      No competitors yet. Register and start climbing to claim
                      the #1 spot.
                    </p>
                    {!isRegistered && (
                      <Button
                        onClick={registerUser}
                        disabled={isRegistering}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 md:px-6 py-2 md:py-3 rounded-lg transition-all duration-300"
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
                        className={`flex items-center justify-between p-4 md:p-6 transition-all duration-300 hover:bg-slate-800/50 group ${
                          user.id === currentUser?.id
                            ? "bg-slate-800 border-l-4 border-l-blue-500"
                            : ""
                        }`}
                      >
                        <div className="flex items-center gap-3 md:gap-6">
                          <div
                            className={`flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl font-bold text-base md:text-lg transition-all duration-300 group-hover:scale-110 ${
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
                          <div className="min-w-0">
                            <p className="text-white font-semibold font-mono text-sm md:text-lg group-hover:text-slate-300 transition-colors truncate">
                              {user.address.slice(0, 6) +
                                "..." +
                                user.address.slice(-4)}
                            </p>
                            <div className="flex items-center gap-2 md:gap-3 mt-1">
                              <p className="text-slate-500 text-xs md:text-sm">
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
                          <p className="text-white font-bold text-lg md:text-2xl group-hover:text-slate-300 transition-colors">
                            {user.score.toLocaleString()}
                          </p>
                          <p className="text-slate-500 text-xs md:text-sm">
                            points
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 md:space-y-6">
            {/* Interaction Panel */}
            <Card className="bg-slate-900 border-slate-800 shadow-2xl">
              <CardHeader className="border-b border-slate-800 pb-4 md:pb-6">
                <CardTitle className="text-white flex items-center gap-2 md:gap-3 text-lg md:text-xl font-bold">
                  <Activity className="w-5 h-5 md:w-6 md:h-6" />
                  Interact
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 md:pt-6">
                {!isWalletConnected ? (
                  <div className="text-center py-6 md:py-8">
                    <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4 md:mb-6 shadow-lg">
                      <Wallet className="w-7 h-7 md:w-8 md:h-8 text-white" />
                    </div>
                    <p className="text-slate-400 mb-4 md:mb-6">
                      Connect wallet to start competing
                    </p>
                    <Button
                      onClick={handleLogin}
                      className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white transition-all duration-300 hover:scale-105 shadow-lg w-full"
                    >
                      <Wallet className="w-4 h-4 mr-2" />
                      Connect
                    </Button>
                  </div>
                ) : !isCorrectChain ? (
                  <div className="text-center py-6 md:py-8">
                    <div className="w-14 h-14 md:w-16 md:h-16 bg-orange-500/20 rounded-xl flex items-center justify-center mx-auto mb-4 md:mb-6 border border-orange-500/20">
                      <AlertTriangle className="w-7 h-7 md:w-8 md:h-8 text-orange-400" />
                    </div>
                    <p className="text-slate-400 mb-4 md:mb-6">
                      Please switch to Ethereum Sepolia Testnet to interact
                    </p>
                    <Button
                      onClick={switchToSepolia}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-4 md:px-6 py-2 md:py-3 rounded-lg transition-all duration-300 w-full"
                    >
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Switch Network
                    </Button>
                  </div>
                ) : !isRegistered ? (
                  <div className="text-center py-6 md:py-8">
                    <div className="w-14 h-14 md:w-16 md:h-16 bg-slate-800 rounded-xl flex items-center justify-center mx-auto mb-4 md:mb-6 border border-slate-700">
                      <Users className="w-7 h-7 md:w-8 md:h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-400 mb-4 md:mb-6">
                      Register to start climbing the leaderboard
                    </p>
                    <Button
                      onClick={registerUser}
                      disabled={isRegistering}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-4 md:px-6 py-2 md:py-3 rounded-lg transition-all duration-300 w-full"
                    >
                      {isRegistering ? "Registering..." : "Register Now"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Button
                      onClick={handleInteraction}
                      disabled={isPlaying || !isRegistered}
                      className={`w-full ${
                        isPlaying
                          ? "bg-gray-500 cursor-not-allowed"
                          : "bg-blue-500 hover:bg-blue-600"
                      } text-white font-semibold px-4 md:px-6 py-2 md:py-3 rounded-lg transition-all duration-300`}
                    >
                      {isPlaying ? (
                        <>
                          <Zap className="w-4 h-4 mr-2 animate-spin" />
                          Climbing...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 mr-2" />
                          Climb the Leaderboard
                        </>
                      )}
                    </Button>
                    <div className="text-sm text-slate-400">
                      Interactions: {interactions}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* User Stats */}
            {isWalletConnected && currentUser && isRegistered && (
              <Card className="bg-slate-900 border-slate-800 shadow-2xl">
                <CardHeader className="border-b border-slate-800 pb-4 md:pb-6">
                  <CardTitle className="text-white text-lg md:text-xl font-bold">
                    Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 md:pt-6">
                  <div className="space-y-3 md:space-y-4">
                    <div className="flex justify-between items-center p-3 bg-slate-800 rounded-lg">
                      <span className="text-slate-400 text-sm md:text-base">
                        Current Rank
                      </span>
                      <Badge className="bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold">
                        #{currentUser.rank}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-800 rounded-lg">
                      <span className="text-slate-400 text-sm md:text-base">
                        Total Score
                      </span>
                      <span className="text-white font-bold text-base md:text-lg">
                        {currentUser.score.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-800 rounded-lg">
                      <span className="text-slate-400 text-sm md:text-base">
                        Current Streak
                      </span>
                      <span className="text-yellow-400 font-bold">
                        {streak}x
                      </span>
                    </div>
                    <div className="pt-3 md:pt-4 border-t border-slate-800">
                      <div className="flex items-center gap-2 text-xs md:text-sm text-green-400">
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
              <CardContent className="pt-4 md:pt-6">
                <div className="space-y-3 md:space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm md:text-base">
                      Network
                    </span>
                    <span className="text-white font-semibold text-sm md:text-base">
                      Ethereum
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm md:text-base">
                      Status
                    </span>
                    <div className="flex items-center gap-2">
                      <Circle className="w-2 h-2 fill-green-400" />
                      <span className="text-green-400 font-semibold text-sm md:text-base">
                        Active
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm md:text-base">
                      Gas Price
                    </span>
                    <span className="text-white font-semibold text-sm md:text-base">
                      12 gwei
                    </span>
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
