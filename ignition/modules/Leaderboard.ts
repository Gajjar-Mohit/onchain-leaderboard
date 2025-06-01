import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("ContractDeployerModule", (m) => {
  const contractDeployer = m.contract("Leaderboard");
  return {
    contractDeployer,
  };
});
