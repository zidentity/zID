import { ethers } from "hardhat";

async function main() {
    const circuitId = "credentialAtomicQuerySig";
    const validatorAddress = "0xb1e86C4c687B85520eF4fd2a0d14e81970a15aFB";

    // Grab the schema hash from Polygon ID Platform
    const schemaHash = "a8311ea713ebacb57ae21a426cdf1113"

    const schemaEnd = fromLittleEndian(hexToBytes(schemaHash))

    const ownerQuery = {
        schema: ethers.BigNumber.from(schemaEnd),
        slotIndex: 2,
        operator: 1,
        value: [1, ...new Array(63).fill(0).map(i => 0)],
        circuitId,
    };

    // add the address of the contract just deployed
    const contractName ="zkWallet"
    const entryPoint = "ERC20ZKPVerifier";
    const requestId = "1";
    const ZkWallet = await ethers.getContractFactory(contractName);
    const zkWallet = await ZkWallet.deploy(
        entryPoint,
        ethers.constants.AddressZero,
        requestId,
        validatorAddress,
        ownerQuery
    )

    console.log(`txHash: ${zkWallet.deployTransaction.hash}`)
    await zkWallet.deployed()
}

function hexToBytes(hex: any) {
    for (var bytes = [], c = 0; c < hex.length; c += 2)
        bytes.push(parseInt(hex.substr(c, 2), 16));
    return bytes;
}

function fromLittleEndian(bytes: any) {
    const n256 = BigInt(256);
    let result = BigInt(0);
    let base = BigInt(1);
    bytes.forEach((byte: any) => {
      result += base * BigInt(byte);
      base = base * n256;
    });
    return result;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});