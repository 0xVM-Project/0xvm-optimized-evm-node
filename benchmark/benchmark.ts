import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import { ethers } from 'ethers';
import { expect } from 'chai';

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

const mintAmount = ethers.parseEther('1') * 1_000n;
const mintAddr = ethers.getAddress('0x3A5cF02ff066738009b7B4D47525CF766e5eCb47');
const start = Date.now();
//send

const proc = async (params) => {
  const mint = await fetch('http://localhost:3000/write', {
    method: 'post',
    body: new URLSearchParams({ contract, params: params, value: undefined }),
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
  console.log(mintEvent[1]);
};
const loop = 2000n;
const params = [];
for (let i = 0; i < loop; i++) {
  const write_params = factory.interface.encodeFunctionData('mint', [mintAddr, mintAmount]);
  params.push(write_params);
}
await Promise.all(params.map((x) => proc(x)));
console.log(
  `loop(${loop}) mint used ${(Date.now() - start) / 1000}s,tps(${(loop * 1000n) / BigInt(Date.now() - start)})`
);
