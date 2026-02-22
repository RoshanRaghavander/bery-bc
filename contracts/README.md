# Token Standards — Bery Chain

Deploy ERC20 and ERC721 contracts on Bery using standard Solidity.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/) or [Hardhat](https://hardhat.org/)
- MetaMask connected to Bery (Chain ID 8379, RPC: https://bery.in/rpc)

## ERC20

### Deploy with Foundry

```bash
forge create contracts/ERC20.sol:ERC20 --rpc-url https://bery.in/rpc \
  --private-key <YOUR_PRIVATE_KEY> \
  --constructor-args "MyToken" "MTK"
```

### Deploy with Hardhat

1. Create `hardhat.config.js`:

```javascript
require("@nomicfoundation/hardhat-toolbox");
module.exports = {
  solidity: "0.8.20",
  networks: {
    bery: {
      url: "https://bery.in/rpc",
      chainId: 8379,
      accounts: [process.env.PRIVATE_KEY],
    },
  },
};
```

2. Deploy script:

```javascript
const hre = require("hardhat");
async function main() {
  const ERC20 = await hre.ethers.getContractFactory("ERC20");
  const token = await ERC20.deploy("MyToken", "MTK");
  await token.waitForDeployment();
  console.log("Deployed to:", await token.getAddress());
}
main();
```

### Verify Contract

After deployment, verify on Bery:

```bash
curl -X POST https://bery.in/v1/contracts/verify \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0xYOUR_CONTRACT_ADDRESS",
    "name": "MyToken",
    "compilerVersion": "0.8.20",
    "source": "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0; ...",
    "abi": [...]
  }'
```

## ERC721

Use OpenZeppelin or a minimal implementation:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ERC721 {
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;

    string public name;
    string public symbol;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }

    function mint(address to, uint256 tokenId) external {
        require(_owners[tokenId] == address(0));
        _owners[tokenId] = to;
        _balances[to]++;
        emit Transfer(address(0), to, tokenId);
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        return _owners[tokenId];
    }

    function balanceOf(address owner) external view returns (uint256) {
        return _balances[owner];
    }
}
```

Deploy the same way as ERC20; ensure MetaMask has BRY for gas.
