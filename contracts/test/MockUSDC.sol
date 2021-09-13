// SPDX-License-Identifier: MIT
pragma solidity 0.7.4;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract MockUSDC is ERC20{
  constructor() ERC20("Mock USDC", "MockUSDC")
  {
    super._setupDecimals(6);
    super._mint(msg.sender, 10**10 * 10**6);
  }
}
