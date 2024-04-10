import { VM } from '@ethereumjs/vm';
import { Account, Address } from '@ethereumjs/util';
export const insert = async (vm: VM, address: Address, balance?: bigint) => {
  const acctData = {
    nonce: 0,
    balance: balance ?? 1024n * BigInt(10) ** BigInt(18), // default 1024 ethers
  };
  const account = Account.fromAccountData(acctData);
  await vm.stateManager.checkpoint();
  await vm.stateManager.putAccount(address, account);
  await vm.stateManager.commit();
};

export const nonce = async (vm: VM, addr: Address) => {
  const account = await vm.stateManager.getAccount(addr);
  if (account) {
    return account.nonce;
  } else {
    return BigInt(0);
  }
};
