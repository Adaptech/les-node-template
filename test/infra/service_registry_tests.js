import assert from "assert";
import serviceRegistryFactory from "../../src/infra/serviceRegistry";

describe("Given a service registry", function() {
  let serviceRegistry = null;
  beforeEach(function() {
    serviceRegistry = serviceRegistryFactory();
  });

  describe("When I request a service that is not registered", function() {
    let myService;
    let caught;
    beforeEach(function() {
      try {
        myService = serviceRegistry.myService;
      } catch (e) {
        caught = e;
      }
    });
    it('should thrown an error', function() {
      assert.notEqual(caught, null);
      assert.equal(caught.message, "No service registered for \"myService\".");
    });
  });

  describe("When I register a service for the first time", function() {
    const myService = {};
    beforeEach(function() {
      serviceRegistry.myService = myService;
    });
    it('should have the service registered', function() {
      assert.equal(serviceRegistry.myService, myService);
    });
  });

  describe("When I register a service for the second time", function() {
    const myService = {};
    let caught;
    beforeEach(function() {
      try {
        serviceRegistry.myService = myService;
      } catch (e) {
        caught = e;
      }
    });
    it('should thrown an error', function() {
      assert.notEqual(caught, null);
      assert.equal(caught.message, "Service \"myService\" already registered.");
    });
  });

  describe("When I register a null service", function() {
    const nullService = null;
    let caught;
    beforeEach(function() {
      try {
        serviceRegistry.nullService = nullService;
      } catch (e) {
        caught = e;
      }
    });
    it('should thrown an error', function() {
      assert.notEqual(caught, null);
      assert.equal(caught.message, "Service \"nullService\" can't be null or undefined.");
    });
  });

  describe("When I register an undefined service", function() {
    const undefinedService = undefined;
    let caught;
    beforeEach(function() {
      try {
        serviceRegistry.undefinedService = undefinedService;
      } catch (e) {
        caught = e;
      }
    });
    it('should thrown an error', function() {
      assert.notEqual(caught, null);
      assert.equal(caught.message, "Service \"undefinedService\" can't be null or undefined.");
    });
  });
});
