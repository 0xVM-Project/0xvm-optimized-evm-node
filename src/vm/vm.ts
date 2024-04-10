import { VM } from '@ethereumjs/vm';
import { Chain, Common, Hardfork } from '@ethereumjs/common';
import { Block } from '@ethereumjs/block';
import { Trie } from '@ethereumjs/trie';
import { LMDB } from './stateManager/lmdb';
import { LevelDB } from './stateManager/level';
import { DefaultStateManager, CacheType } from '@ethereumjs/statemanager';
import { Address, bytesToHex, hexToBytes, Account, toAscii } from '@ethereumjs/util';
import { LegacyTransaction, TxData } from '@ethereumjs/tx';
import { EvmError, EVMErrorMessage, EVM } from '@ethereumjs/evm';

import * as acct from './account';
import { ethers } from 'ethers';

const adminPk = hexToBytes('0xe331b6d69882b4cb4ea581d88e0b604039a3de5967688d3dcffdd2270c0fd109');
const adminAddr = Address.fromPrivateKey(adminPk);
const common = new Common({ chain: Chain.Mainnet, hardfork: Hardfork.Istanbul });
let _runtime: VM | undefined;
const _epoch = {
  start: Date.now(),
};
const buildBlock = () => {
  const height = Math.floor((Date.now() - _epoch.start) / 1000 / 1);
  return Block.fromBlockData({ header: { number: height, timestamp: _epoch.start + height * 1 * 1000 } }, { common });
};
const getReasonText = (hex: string) => {
  const errorMethodId = '0x08c379a0'; // Numeric.toHexString(Hash.sha3("Error(string)".getBytes())).substring(0, 10)
  if (hex.toLowerCase().startsWith(errorMethodId)) {
    let codeString;
    codeString = `0x${hex.substring(138)}`.replace(/0+$/, '');

    // If the codeString is an odd number of characters, add a trailing 0
    if (codeString.length % 2 === 1) {
      codeString += '0';
    }
    return ethers.toUtf8String(codeString);
  } else return toAscii(hex);
};
const db = new LMDB('./.lmdb');
console.log(db.keys().length);
const vm = {
  createInstance: async () => {
    if (!_runtime) {
      const dbtrie = await Trie.create({ db, useRootPersistence: true, useNodePruning: true });
      /*
      const db = new LevelDB(new Level('./level'));
      const dbtrie = new Trie({ db, useRootPersistence: true });
      */
      const stateManager = new DefaultStateManager({
        trie: dbtrie,
      });
      _runtime = await VM.create({ common, stateManager, profilerOpts: { reportAfterTx: false } });
      _runtime.evm.events.on('newContract', (data) => {
        console.log(`newContract(${data.address.toString()}),codeHash(${ethers.hashMessage(data.code)})`);
      });
      let adminData = await _runtime.stateManager.getAccount(adminAddr);
      if (!adminData) {
        await acct.insert(_runtime, adminAddr);
        adminData = await _runtime.stateManager.getAccount(adminAddr);
      } else console.log(adminAddr.toString(), adminData.nonce, adminData.balance);
    } else throw 'runtime instantiated.';
    return _runtime;
  },

  deploy: async (bytecode: string, argv?: string) => {
    const OLDADDR = '0x61de9dc6f6cff1df2809480882cfd3c2364b28f7';
    const old = await _runtime.stateManager.getAccount(Address.fromString(OLDADDR));
    if (old && old.isContract()) {
      return OLDADDR;
    }
    if (!ethers.isHexString(bytecode) && (!argv || ethers.isHexString(argv))) throw 'deploy(bytecode) need HexString';
    let deploymentData = bytecode;
    if (argv) {
      deploymentData += argv.slice(2);
    }
    const txData = {
      nonce: await acct.nonce(_runtime, adminAddr),
      gasLimit: 10_000_000, // We assume that 10M is enough,
      gasPrice: 1,
      value: 0,
      data: deploymentData,
    };

    const tx = LegacyTransaction.fromTxData(txData, { common }).sign(adminPk);
    const result = await _runtime.runTx({ tx, block: buildBlock() });
    if (result.execResult.exceptionError || !result.createdAddress) {
      throw result.execResult.exceptionError ?? new EvmError(EVMErrorMessage.REVERT);
    }
    await db.committed();

    return result.createdAddress ? result.createdAddress.toString() : undefined;
  },
  read: async (contract: string, param: string) => {
    const result = await _runtime.evm.runCall({
      to: Address.fromString(contract),
      caller: adminAddr,
      origin: adminAddr, // The tx.origin is also the caller here
      data: hexToBytes(param),
      block: buildBlock(),
    });
    if (result.execResult.exceptionError) {
      if (result.execResult.returnValue && result.execResult.returnValue.length > 0) {
        throw new Error(
          `read is ${result.execResult.exceptionError.error},reason:${getReasonText(
            bytesToHex(result.execResult.returnValue)
          )}`
        );
      } else throw new Error(`read is ${result.execResult.exceptionError.error},Not reason returned`);
    }
    return { returns: bytesToHex(result.execResult.returnValue) };
  },
  write: async (contract: string, param: string, value?: string) => {
    const txData = {
      to: Address.fromString(contract),
      nonce: await acct.nonce(_runtime, adminAddr),
      gasLimit: 10_000_000, // We assume that 10M is enough,
      gasPrice: 1,
      value: 0,
      data: param,
    };
    //const tx = LegacyTransaction.fromTxData(txData, { common, freeze: false }).sign(adminPk);
    const tx = LegacyTransaction.fromTxData(txData, { common, freeze: false });
    tx.getSenderAddress = () => adminAddr; //FakeTransaction not need sign
    const result = await _runtime.runTx({
      tx,
      block: buildBlock(),
      skipNonce: true,
      skipBalance: true,
      skipBlockGasLimitValidation: true,
      skipHardForkValidation: true,
    });
    //console.log(total, await db.committed());
    if (result.execResult.exceptionError) {
      if (result.execResult.returnValue && result.execResult.returnValue.length > 0) {
        throw new Error(
          `write is ${result.execResult.exceptionError.error},reason:${getReasonText(
            bytesToHex(result.execResult.returnValue)
          )}`
        );
      } else throw new Error(`write is ${result.execResult.exceptionError.error},Not reason returned`);
    }
    await db.committed();

    return {
      returns: bytesToHex(result.execResult.returnValue),
      logs: result.receipt.logs.map((x) => ({
        address: bytesToHex(x[0]),
        topics: x[1].map((v) => bytesToHex(v)),
        data: bytesToHex(x[2]),
      })),
    };
  },
};

export { vm };
