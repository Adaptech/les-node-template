-- login with vanillacqrs on database vanillacqrs
DROP OWNED BY vanillacqrs;
CREATE TABLE "$checkpoints" ( name TEXT PRIMARY KEY, value JSON );
CREATE TABLE "$versions" ( name TEXT PRIMARY KEY, version FLOAT(53) );
