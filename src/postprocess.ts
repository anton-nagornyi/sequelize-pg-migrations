type MigrationType = 'up' | 'down';

const getConstrains = (data: string) => {
  const res = data.matchAll(/CREATE TABLE IF NOT EXISTS (?<table>"\w+"\."\w+")/g);
  const constraints = new Array<{ table: string, foreigns: Array<string> }>();
  for (const r of res) {
    const { table } = r.groups!;
    const statement = data.substring(r.index!, data.indexOf(');`,', r.index));

    const foreigns = statement.match(/CONSTRAINT "\w+" FOREIGN KEY.*/g);
    if (foreigns) {
      constraints.push({
        table,
        foreigns,
      });
    }
  }

  const queries = constraints.map((item) => item.foreigns.map((f) => `    await queryInterface.sequelize.query('ALTER TABLE ${item.table} ADD ${f.replace(',', '')};', {transaction});`)).flat().join('\n');

  return [queries, constraints.map((item) => item.foreigns).flat()];
  // console.log(queries);
};

const getMigrationPos = (data: string, what: MigrationType) => {
  const downStart = data.indexOf('down:');
  const upStart = data.indexOf('up:');
  const upEnd = data.lastIndexOf('}),', downStart);
  const downEnd = data.lastIndexOf('}', data.lastIndexOf('})'));
  if (what === 'up') {
    return [upStart, upEnd];
  }
  return [downStart, downEnd];
};

const getMigrationBody = (data: string, what: MigrationType) => {
  const [start, end] = getMigrationPos(data, what);

  return data.substring(start, end);
};

const moveForeignKeysDown = (data: string): string => {
  let res = data;
  for (const what of ['up', 'down']) {
    const migration = getMigrationBody(res, what as MigrationType);
    const [quireies, foreigns] = getConstrains(migration);

    for (const f of foreigns) {
      res = res.replace(f, '');
    }
    // eslint-disable-next-line no-control-regex,no-tabs
    res = res.replace(/,\n {4}	\n {4}/g, '');
    const [,end] = getMigrationPos(res, 'up');
    res = `${res.slice(0, end)}\n${quireies}\n  ${res.slice(end)}`;
    res = res.replace(/ {2}\n\n/g, '');
  }
  return res;
};

export const postprocess = (data: string): string => moveForeignKeysDown(data);
