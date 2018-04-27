const DEFAULT_LIMIT = 100;
// This Controller is generic so it distributed with the services in the base
export default class ReadModelGenericController {
  constructor(app, config, readRepository, logger) {
    const defaultLimitForFilter = config.defaultLimitForFilter || DEFAULT_LIMIT;

    function handleResult(findPromise, res) {
      return findPromise
        .then(result => res.json(result))
        .catch(err => {
          logger.error(err.stack);
          res.status(500).json({message: err.message});
        });
    }

    function getFilter(req) {
      const {filter} = req.query;
      if (!filter) {
        return {limit: defaultLimitForFilter};
      }
      if (typeof filter === 'string') {
        const parsedFilter = JSON.parse(filter);
        if (!parsedFilter.limit) parsedFilter.limit = defaultLimitForFilter;
        return parsedFilter;
      }
      if (!filter.limit) filter.limit = defaultLimitForFilter;
      return filter;
    }

    app.get('/api/v1/r/:model', (req, res) => {
      const filter = getFilter(req);
      handleResult(readRepository.findByFilter(req.params.model, filter), res);
    });
    app.get('/api/v1/r/:model/findOne', (req, res) => {
      const filter = getFilter(req);
      const where = filter.where || {};
      handleResult(readRepository.findOne(req.params.model, where), res);
    });
  }
}
