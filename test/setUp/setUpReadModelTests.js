import uuid from 'uuid';
import {buildModelDefs} from "../../src/infra/readModels";
import Transaction from "../../src/infra/Transaction";
import changeProxyFactory from "../../src/infra/memdb/changeProxy";
import {getTypeName} from "../../src/infra/utils";
import ReadRepository from "../../src/infra/ReadRepository";
import TransactionalRepository from "../../src/infra/TransactionalRepository";
import InMemoryMapper from "../../src/infra/memdb/Mapper";
import NoOpLogger from "../../src/infra/NoOpLogger";

function buildLookups({name, lookups}, {mapper, readRepository, transaction, logger}) {
  const results = {};
  if (lookups) {
    for (const k in lookups) {
      const lookupName = `${name}_${k}_lookup`;
      results[k] = new TransactionalRepository(mapper, lookupName, readRepository, transaction, changeProxyFactory, logger);
    }
  }
  return results;
}

export function setUpReadModelTest({readModels, events, initialState, resultsSetter}) {
  process.on('unhandledRejection', function() {
    // eslint-disable-next-line no-console
    console.log(arguments);
  });

  if (!readModels) throw new Error('Missing readModels.');
  if (!events || !events.length) throw new Error('Missing event(s).');
  if (!resultsSetter) throw new Error('Missing resultsSetter.');
  const logger = new NoOpLogger();
  initialState = initialState || {};
  const eventsData = events.map(event => {
    return {
      event,
      eventId: uuid.v4(),
      typeId: getTypeName(event),
      creationTime: Date.now()
    };
  });
  const readModelList = Object.keys(readModels).map(name => {
    return {name, ...readModels[name]};
  });
  const readModelUnderTest = readModelList[0];
  if (readModelList > 1) {
    throw new Error("Testing more than one read model is not possible.");
  }

  beforeEach(async() => {
    const modelDefs = buildModelDefs(readModelList);
    const mapper = new InMemoryMapper(modelDefs, initialState, logger);
    const readRepository = new ReadRepository(mapper, logger);
    for (const eventData of eventsData) {
      for (const readModel of readModelList) {
        const transaction = new Transaction();
        const modelRepository = new TransactionalRepository(mapper, readModel.name, readRepository, transaction, changeProxyFactory, logger);
        const lookups = buildLookups(readModel, {mapper, readRepository, transaction, logger});
        await readModel.handler(modelRepository, eventData, lookups);
        await transaction.commit();
      }
    }
    const data = await readRepository.findAll(readModelUnderTest.name);
    await resultsSetter(data);
  });
}

export default setUpReadModelTest;
