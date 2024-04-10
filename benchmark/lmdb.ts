import { Database, open } from 'lmdb';
import { existsSync, rmSync } from 'fs';
import { randomBytes, keccak256 } from 'ethers';
import { expect } from 'chai';
const path = new URL('./benchdata', import.meta.url).toString().slice(8);
if (existsSync(path)) {
  rmSync(path, { force: true, recursive: true });
}
const db = open({
  noMemInit: true,
  commitDelay: 10,
  cache: true,
  compression: false,
  name: '@ethereumjs/trie',
  path,
  strictAsyncOrder: true,
  //maxReaders: 1024 * 1024,
});
const defaultData = {
  name: 'test',
};
const keys = [];
const randomKey = () => {
  const raw = randomBytes(8);
  const key = keccak256(raw);
  keys.push(key);
  return { key, raw };
};

const writeSync = async (loop: number) => {
  const datas = [...Array(loop)].map((x) => ({
    ...defaultData,
    ...randomKey(),
  }));
  const begin = Date.now();
  console.time('writeSync');
  for (const data of datas) {
    db.putSync(data.key, data);
  }
  console.log(`writeSync:${(loop / (Date.now() - begin)) * 1000} tps`);
  console.timeEnd('writeSync');
};
const writeAsync = async (loop: number) => {
  const datas = [...Array(loop)].map((x) => ({
    ...defaultData,
    ...randomKey(),
  }));
  const begin = Date.now();
  console.time('writeAsync');
  for (const data of datas) {
    void db.put(data.key, data);
  }
  await db.committed;
  console.log(`writeAsync:${(loop / (Date.now() - begin)) * 1000} tps`);
  console.timeEnd('writeAsync');
};
const readAsync = async () => {
  const begin = Date.now();
  console.time('readAsync');
  let total = 0;
  for (const key of keys) {
    const value = db.get(key);
    expect(value.key).equal(key);
    total += 1;
  }
  console.log(`readAsync:${(keys.length / (Date.now() - begin)) * 1000} qps`);
  console.timeEnd('readAsync');
  return total;
};
const loop = 100_000;
await writeSync(loop);
await writeAsync(loop);
await readAsync();
