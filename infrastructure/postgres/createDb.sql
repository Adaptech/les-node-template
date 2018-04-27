-- require superuser
CREATE ROLE vanillacqrs WITH LOGIN PASSWORD 'vanillacqrs';
CREATE DATABASE vanillacqrs WITH owner = vanillacqrs;
