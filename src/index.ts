import { execa } from 'execa';
import { cli } from 'console-craft';
import { node } from './node';
import cluster from 'cluster';
import { cpus } from 'os';
const commands = [
  {
    name: 'node',
    args: [
      { flags: '-p, --port <port>', default: 3000 },
      { flags: '-w, --worker <worker number>', default: 1 },
    ],
  },
  { name: 'test', args: ['-r, --round <round>'] },
];
cli.initialize(commands, {
  globalArgs: [{ flags: '-c, --config <config>', description: 'config file' }, '-log,  --log-level'],
  author: 'topabomb(hualei.hb@gmail.com)',
  description: 'node console app.',
  version: '[VI]{version} - {date}[/VI]', //from rollup-plugin-version-injector
});
cli.command('node', async ({ name, args, logger }) => {
  const proc = async () => {
    const port = Number(args['port']);
    await node.start(port);
    logger.level = args['log-level'] ? args['log-level'] : 'debug';
    logger.info(
      `${name}${cluster.isWorker ? `-worker(${cluster.worker.id})` : ''} listening : http://localhost:${args['port']}`
    );
  };
  if (cluster.isPrimary === true) {
    const workers = args['worker'] === 'auto' ? cpus().length / 2 : Number(args['worker']);
    if (workers <= 1) await proc();
    else {
      for (const idx in [...Array(workers)]) {
        const w = cluster.fork({ port: args['port'] });
        w.on('error', (err: NodeJS.ErrnoException) => {
          if (err.code !== 'EPIPE') throw err;
          setTimeout(() => {
            if (!w.isDead()) throw err;
          }, 100);
        });
      }
    }
  } else {
    await proc();
  }
});
cli.command('test', async ({ name, args, logger }) => {
  await node.start(3000);
  const round = args['round'] ? Number(args['round']) : 1;
  for (let i = 0; i < round; i++) await execa('mocha', []).pipeStdout(process.stdout);
  await node.close();
  logger.log('test complete.');
});
await cli.run();
