# sequelize-pg-migrations

The intention of this package is to generate sequelize migration files for a postgres db automatically.

To do so:

```shell script
npm install --save-dev sequelize-pg-migrations
```

Place `.sequelizerc` into your project's root folder and configure 'migrations-path'.

pg-diff-cli is used to generate sql statements. To make it properly work place `pg-diff-config.json`
into your project's root folder. You must have `forward` and `backward` configurations
in it.

```json
{
  "forward": {
    "sourceClient": {
      "host": "localhost",
      "port": 5432,
      "database": "dbname",
      "user": "postgres",
      "password": "pass",
      "applicationName": "pg-diff-cli"
    },
    "targetClient": {
      "host": "target.host",
      "port": 5432,
      "database": "targetdb",
      "user": "postgres",
      "password": "pass",
      "applicationName": "pg-diff-cli"
    },
    "compareOptions": {
      "author": "",
      "outputDirectory": ".temp",
      "getAuthorFromGit": true,
      "schemaCompare": {
        "namespaces": ["public"],
        "dropMissingTable": true,
        "dropMissingView": true,
        "dropMissingFunction": true,
        "dropMissingAggregate": true,
        "roles": []
      },
      "dataCompare": {
        "enable": false
      }
    }
  },
  "backward": {
    "targetClient": {
      "host": "localhost",
      "port": 5432,
      "database": "dbname",
      "user": "postgres",
      "password": "pass",
      "applicationName": "pg-diff-cli"
    },
    "sourceClient": {
      "host": "target.host",
      "port": 5432,
      "database": "targetdb",
      "user": "postgres",
      "password": "pass",
      "applicationName": "pg-diff-cli"
    },
    "compareOptions": {
      "author": "",
      "outputDirectory": ".temp",
      "getAuthorFromGit": true,
      "schemaCompare": {
        "namespaces": ["public"],
        "dropMissingTable": true,
        "dropMissingView": true,
        "dropMissingFunction": true,
        "dropMissingAggregate": true,
        "roles": []
      },
      "dataCompare": {
        "enable": false
      }
    }
  }
}

```

To generate migrations run:

```shell script
npx migen
```
