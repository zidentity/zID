import {
    arrayify,
    BytesLike,
    defaultAbiCoder,
    getCreate2Address,
    hexDataSlice,
    hexValue,
    keccak256
  } from 'ethers/lib/utils'
import { ethers } from 'ethers'
import { UserOperation } from './userOperation'
import { TransactionResponse } from '@ethersproject/abstract-provider'
import Web3 from 'web3'

let EntryPoint = "0x1b98F08dB8F12392EAE339674e568fe29929bC47"

const web3 = new Web3('http://localhost:8545');

function encode (typevalues: Array<{ type: string, val: any }>, forSignature: boolean): string {
const types = typevalues.map(typevalue => typevalue.type === 'bytes' && forSignature ? 'bytes32' : typevalue.type)
const values = typevalues.map((typevalue) => typevalue.type === 'bytes' && forSignature ? keccak256(typevalue.val) : typevalue.val)
return defaultAbiCoder.encode(types, values)
}

  // used for getting the signatrue and not include the signature
  export function packUserOp (op: UserOperation, forSignature = true): string {
    if (forSignature) {
      // lighter signature scheme (must match UserOperation#pack): do encode a zero-length signature, but strip afterwards the appended zero-length value
      const userOpType = {
        components: [
          { type: 'address', name: 'sender' },
          { type: 'uint256', name: 'nonce' },
          { type: 'bytes', name: 'initCode' },
          { type: 'bytes', name: 'callData' },
          { type: 'uint256', name: 'callGasLimit' },
          { type: 'uint256', name: 'verificationGasLimit' },
          { type: 'uint256', name: 'preVerificationGas' },
          { type: 'uint256', name: 'maxFeePerGas' },
          { type: 'uint256', name: 'maxPriorityFeePerGas' },
          { type: 'bytes', name: 'paymasterAndData' },
          { type: 'bytes', name: 'signature' }
        ],
        name: 'userOp',
        type: 'tuple'
      }
      let encoded = defaultAbiCoder.encode([userOpType as any], [{ ...op, signature: '0x' }])
      // remove leading word (total length) and trailing word (zero-length signature)
      encoded = '0x' + encoded.slice(66, encoded.length - 64)
      return encoded
    }
    const typevalues = [
      { type: 'address', val: op.sender },
      { type: 'uint256', val: op.nonce },
      { type: 'bytes', val: op.initCode },
      { type: 'bytes', val: op.callData },
      { type: 'uint256', val: op.callGasLimit },
      { type: 'uint256', val: op.verificationGasLimit },
      { type: 'uint256', val: op.preVerificationGas },
      { type: 'uint256', val: op.maxFeePerGas },
      { type: 'uint256', val: op.maxPriorityFeePerGas },
      { type: 'bytes', val: op.paymasterAndData }
    ]
    if (!forSignature) {
      // for the purpose of calculating gas cost, also hash signature
      typevalues.push({ type: 'bytes', val: op.signature })
    }
    return encode(typevalues, forSignature)
  }
  
  
  export function getRequestId (op: UserOperation, entryPoint: string, chainId: number): string {
    const userOpHash = keccak256(packUserOp(op, true))
    const enc = defaultAbiCoder.encode(
      ['bytes32', 'address', 'uint256'],
      [userOpHash, entryPoint, chainId])
    return keccak256(enc)
  }
  
  export const DefaultsForUserOp: UserOperation = {
    sender: ethers.constants.AddressZero,
    nonce: 0,
    initCode: '0x',
    callData: '0x',
    callGasLimit: 0,
    verificationGasLimit: 100000, // default verification gas. will add create2 cost (3200+200*length) if initCode exists
    preVerificationGas: 21000, // should also cover calldata cost.
    maxFeePerGas: 0,
    maxPriorityFeePerGas: 1e9,
    paymasterAndData: '0x',
    signature: '0x'
  }
  
  export function signUserOp (op: UserOperation, zkProof: string): UserOperation {
    return {
      ...op,
      signature: zkProof
    }
  }

export type SendUserOp = (userOp: UserOperation) => Promise<TransactionResponse | undefined>
/**
 * send a request using rpc.
 *
 * @param provider - rpc provider that supports "eth_sendUserOperation" 
 */
export function rpcUserOpSender (provider: ethers.providers.JsonRpcProvider, entryPointAddress: string): SendUserOp {
    let chainId: number
  
    return async function (userOp) {
        console.log('sending eth_sendUserOperation', {
            ...userOp,
            initCode: (userOp.initCode ?? '').length,
            callData: (userOp.callData ?? '').length
        }, entryPointAddress)
      if (chainId === undefined) {
        chainId = await provider.getNetwork().then(net => net.chainId)
      }
  
      const cleanUserOp = Object.keys(userOp).map(key => {
        let val = (userOp as any)[key]
        if (typeof val !== 'string' || !val.startsWith('0x')) {
          val = hexValue(val)
        }
        return [key, val]
      })
        .reduce((set, [k, v]) => ({ ...set, [k]: v }), {})
      await provider.send('eth_sendUserOperation', [cleanUserOp, entryPointAddress]).catch(e => {
        throw e.error ?? e
      })
      return undefined
    }
  }

interface ZKProof {
  requestId: number,
  inputs: number[],
  a: number[],
  b: number[][],
  c: number[],
}

export function callOp(walletAddress: string, url: string, zk: ZKProof) {
    let RPCProvider = new ethers.providers.JsonRpcProvider(url);
    let incABI = Object({"inputs":[],"name":"inc","outputs":[],"stateMutability":"nonpayable","type":"function"});
    let execFromEntrypointABI = Object({"inputs":[{"internalType":"address","name":"dest","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bytes","name":"func","type":"bytes"}],"name":"execFromEntryPoint","outputs":[],"stateMutability":"nonpayable","type":"function"});
    let countAddress = "0x744f2af121b717a3Bc594f56111B8244a89199D5"
    let countCalldata = web3.eth.abi.encodeFunctionCall(incABI, []);
    let walletCalldata = web3.eth.abi.encodeFunctionCall(execFromEntrypointABI, [countAddress, '0', countCalldata]);
    let zkProof = defaultAbiCoder.encode([ 
      "uint64", "uint256[]","uint256[2]", "uint256[2][2]","uint256[2]"], [
      zk.requestId, zk.inputs, zk.a, zk.b, zk.c ]
    );
    const UserOp: UserOperation = {
        sender: walletAddress,
        nonce: 0,
        initCode: '0x',
        callData: walletCalldata,
        callGasLimit: 0,
        verificationGasLimit: 300000, // default verification gas. will add create2 cost (3200+200*length) if initCode exists
        preVerificationGas: 21000, // should also cover calldata cost.
        maxFeePerGas: 0,
        maxPriorityFeePerGas: 1e9,
        paymasterAndData: '0x',
        signature: zkProof
      }
    // let signedUserOp =  signUserOp(testUserOp, zkProof)
    // let sendUserOp

    return rpcUserOpSender(RPCProvider, EntryPoint)(UserOp)
}