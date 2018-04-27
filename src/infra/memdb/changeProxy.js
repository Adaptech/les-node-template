export function changeProxyFactory(obj) {
  const handler = {
    getChanges: function() {
      return obj;
    }
  };
  const proxy = new Proxy(obj, {});
  return {proxy, handler};
}

export default changeProxyFactory;
