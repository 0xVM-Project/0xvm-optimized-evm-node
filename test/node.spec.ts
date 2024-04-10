import { it, describe } from 'mocha';
import { expect } from 'chai';
import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import { ethers } from 'ethers';

describe('node', () => {
  it('get health', async () => {
    const resp = await fetch('http://localhost:3000/health');
    if (resp.ok) {
      const data: { success: boolean } = (await resp.json()) as any;
      expect(data.success).equal(true);
      console.log(data);
    }
  });
  it('brc20 contract', async () => {
    const jsonWeth = JSON.parse(readFileSync('./test/deployments/MockBrc20.json', 'utf8'));
    const factory = new ethers.ContractFactory(jsonWeth.abi, jsonWeth.bytecode);

    //deploy
    const argv = ['Gold', 'GLD', ethers.parseEther('1') * 2100_000_000n, ethers.parseEther('1') * 1_000n, 8];
    const deploy = await fetch('http://localhost:3000/deploy', {
      method: 'post',
      body: new URLSearchParams({ bytecode: factory.bytecode, argv: factory.interface.encodeDeploy(argv) }),
    });
    expect(deploy.ok).eq(true);
    const deployData: { success: boolean; address: string } = (await deploy.json()) as any;
    expect(deployData.success).equal(true);
    const contract = deployData.address;

    const mintAmount = ethers.parseEther('1') * 1_000n;
    const mintAddr = ethers.getAddress('0x3A5cF02ff066738009b7B4D47525CF766e5eCb47');
    const start = Date.now();
    //send
    let total = 0n;
    const loop = 5000n;
    for (let i = 0; i < loop; i++) {
      const write_params = factory.interface.encodeFunctionData('mint', [mintAddr, mintAmount]);
      const mint = await fetch('http://localhost:3000/write', {
        method: 'post',
        /*
        body: new URLSearchParams({ contract, params: write_params, value: undefined }),
*/

        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contract, params: write_params, value: undefined }),
      });
      if (mint.status == 400) {
        console.log(await mint.json());
      }
      expect(mint.ok).eq(true);
      const mintData: {
        success: boolean;
        returns: string;
        logs: { address: string; topics: string[]; data: string }[];
      } = (await mint.json()) as any;
      expect(mintData.success).equal(true);
      const returns = factory.interface.decodeFunctionResult('mint', mintData.returns);
      expect(returns[0]).equal(mintAmount);
      const mintTopicHash = factory.interface.getEvent('Mint').topicHash;
      const logs = mintData.logs.filter(
        (x) => x.address == contract && x.topics.length > 0 && x.topics[0] == mintTopicHash
      );
      const mintEvent = factory.interface.decodeEventLog('Mint', logs[0].data, logs[0].topics);
      expect(mintEvent[0] == mintAddr && mintEvent[1] == mintAmount).equal(true);
      total += mintAmount;
    }
    console.log(
      `loop(${loop}) mint used ${(Date.now() - start) / 1000}s,tps(${(loop * 1000n) / BigInt(Date.now() - start)})`
    );

    //read
    const read_params = factory.interface.encodeFunctionData('balanceOf', [mintAddr]);
    const balanceOf = await fetch('http://localhost:3000/read', {
      method: 'post',
      body: new URLSearchParams({ contract, params: read_params }),
    });
    expect(balanceOf.ok).eq(true);
    const balanceOfData: { success: boolean; returns: string } = (await balanceOf.json()) as any;
    expect(balanceOfData.success).eq(true);
    expect(factory.interface.decodeFunctionResult('balanceOf', balanceOfData.returns)[0] >= mintAmount * loop).eq(true);
  });
  it('mint error', async () => {
    const jsonWeth = JSON.parse(readFileSync('./test/deployments/MockBrc20.json', 'utf8'));
    const factory = new ethers.ContractFactory(jsonWeth.abi, jsonWeth.bytecode);

    //deploy
    const argv = ['Gold', 'GLD', ethers.parseEther('1') * 21_000_000n, ethers.parseEther('1') * 1_000n, 8];
    const deploy = await fetch('http://localhost:3000/deploy', {
      method: 'post',
      body: new URLSearchParams({ bytecode: factory.bytecode, argv: factory.interface.encodeDeploy(argv) }),
    });
    expect(deploy.ok).eq(true);
    const deployData: { success: boolean; address: string } = (await deploy.json()) as any;
    expect(deployData.success).equal(true);
    const contract = deployData.address;
    console.log(contract);
    const mintAmount = ethers.parseEther('1') * 21_000_000n;
    const mintAddr = ethers.getAddress('0x3A5cF02ff066738009b7B4D47525CF766e5eCb47');
    console.log(factory.interface.getFunction('mint').selector);
    const write_params = factory.interface.encodeFunctionData('mint', [mintAddr, mintAmount]);
    const mint = await fetch('http://localhost:3000/write', {
      method: 'post',
      body: new URLSearchParams({ contract, params: write_params, value: undefined }),
    });
    expect(!mint.ok && mint.status == 400).eq(true);
    const mintData = (await mint.json()) as any;
    expect(mintData.success == false && mintData.error == 'write is revert,reason:mint limitPer').eq(true);
  });
});
