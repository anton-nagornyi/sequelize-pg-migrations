import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import * as child_process from 'child_process';
import { DateTime } from 'luxon';
import { postprocess } from './postprocess';

export const npx = /^win/.test(process.platform) ? 'npx.cmd' : 'npx';

type Config = {
  migrationsPath: string,
  pgDiffConf: any,
  cwd: string
};

const determinConfigs = (): Config => {
  const execPath = process.cwd();
  if (!fs.existsSync(path.join(execPath, 'package.json'))) {
    throw new Error('Please run this at the project\'s root');
  }
  if (!fs.existsSync(path.join(execPath, 'pg-diff-config.json'))) {
    throw new Error('pg-diff-config.json is missing. Place it inside project\'s root folder');
  }

  const seqConf = path.join(execPath, '.sequelizerc');
  // eslint-disable-next-line global-require,import/no-dynamic-require
  const seq = fs.existsSync(seqConf) ? require(seqConf) as any : undefined;
  const res = {} as Config;
  res.migrationsPath = !seq || !seq['migrations-path'] ? path.join(execPath, 'migrations') : seq['migrations-path'];
  // eslint-disable-next-line global-require,import/no-dynamic-require
  res.pgDiffConf = require(path.join(execPath, 'pg-diff-config.json'));
  res.cwd = execPath;
  return res;
};

const config = determinConfigs();

const readStatements = (file: string): string[] => {
  const data = fs.readFileSync(file, 'utf8');

  let statements = data.split(/\r?\n/).filter((s) => !s.startsWith('--') && !s.startsWith('/*') && s.trim() !== '');
  statements = statements.filter((s) => !s.includes(' OWNER TO ') && !s.startsWith('GRANT '));

  const aggregated = new Array<string>();
  const agStatement = new Array<string>();
  for (let i = 0; i < statements.length; ++i) {
    const orig = statements[i];
    agStatement.push(orig);
    if (orig.includes(';')) {
      aggregated.push(agStatement.join('\n    '));
      agStatement.length = 0;
    }
  }

  return aggregated;
};

const getStatementsByDirection = async (direction: string): Promise<string[]> => new Promise((resolve, reject) => {
  const outDir = config.pgDiffConf[direction].compareOptions.outputDirectory;

  console.log(`Getting ${direction} statements...`);
  if (fs.existsSync(outDir)) {
    fs.rmdirSync(outDir, { recursive: true });
  }
  fs.mkdirSync(outDir, { recursive: true });

  const child = child_process.spawn(npx, ['pg-diff', '-c', direction, direction], { cwd: path.resolve(config.cwd) });

  child.stderr.on('data', (data) => {
    console.error(`${data}`);
    reject();
  });
  child.on('exit', () => {
    const files = fs.readdirSync(outDir);

    for (const f of files) {
      const statements = readStatements(path.join(outDir, f));
      resolve(statements);
      break;
    }
  });
});

const statementsToQueries = (statements: string[]): string => (
  `queryInterface.sequelize.transaction(async (transaction) => {
    ${statements.map((s) => `await queryInterface.sequelize.query(\`${s.includes('\n') ? '\n    ' : ''}${s}\`, {transaction});`).join('\n    ')}
    })`);

const genMigrationFile = (forward: string[], backward: string[]) => {
  const upMarker = '==up==';
  const downMarker = '==down==';

  const template = `'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => ${upMarker},

  down: async (queryInterface, Sequelize) => ${downMarker}
};`;

  const outDir = config.migrationsPath;
  fs.mkdirSync(outDir, { recursive: true });

  const d = DateTime.utc();
  const dt = d.toSQLDate().replace(/-/g, '');
  const tm = d.toISOTime().substr(0, 8).replace(/:/g, '');
  const sum = crypto.createHash('md5').update(`${forward.join()}${backward.join()}`).digest('hex');
  const file = path.join(outDir, `${dt}${tm}-${sum}.js`);
  const migrationData = template.replace(upMarker, statementsToQueries(forward)).replace(downMarker, statementsToQueries(backward));
  fs.writeFileSync(file, postprocess(migrationData), 'utf8');

  console.log(`Created migration file at: ${file}`);
};

export const genMigrations = async () => {
  const forward = await getStatementsByDirection('forward');
  const backward = await getStatementsByDirection('backward');

  genMigrationFile(forward, backward);
};
