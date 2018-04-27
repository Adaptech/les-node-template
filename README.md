# les node template

## Requirements

* [NodeJS](https://nodejs.org) v6+
* [Yarn](https://yarnpkg.com) Latest

## Getting started

### Install node modules

    yarn install

### Start the api and web

    yarn start

API are located at: [http://localhost:3001/](http://localhost:3001/)  

### Run the tests

    yarn test
    
## Configuration

### EventStore

You can choose between: ges (Greg's EventStore) or memes (in-memory).

#### ges

You can configure the API to use [EventStore](https://eventstore.org/).

Change the eventStore section of your config file to:
```
"eventStore": {
  "type": "ges",
  "endPoint": "tcp://localhost:1113",
  "credentials": {"username": "admin", "password": "changeit"}
}
```

Steps:
- Download tar.gz archive from the website
- Untar the archive (`tar -zxvf thearchive.tar.gz`) in the folder of your choice
- CD into extracted subfolder (EventStore-OSS-XXX-vX.X.X)
- Start the eventstore
  - `./run-node.sh --memdb --run-projections=all` (start event store)
- Web interface at [http://localhost:2113](http://localhost:2113)
  - login: admin pass: changeit (defaults)
  
#### memes

You can configure the API to store events in memory.

Change the eventStore section of your config file to:
```
"eventStore": {
  "type": "memes"
}
```

### Read model storage

You can choose between: memdb (In memory), LevelDB, Postgres

#### memdb

You can configure the API to store read models in memory.

Change the readModelStore value of your config file to:

```
"readModelStore": "memdb"
```

#### LevelDB

You can configure the API to store read models with LevelDB.

Change the readModelStore value and add leveldb section in your config file to:

```
"readModelStore": "leveldb",
"leveldb": {
  "dbDir": "/path/to/leveldb/storage/dir"
}
```

#### Postgres

You can configure the API to store read models with Postgres.

Change the readModelStore value and add postgres section in your config file to:

```
"readModelStore": "postgres",
"postgres": {
  "host": "localhost",
  "port": 5432,
  "database": "vanillacqrs",
  "user": "vanillacqrs",
  "password": "vanillacqrs"
}
```
