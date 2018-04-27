import Strategy from "passport-strategy";

export default class OAuth2ProxyStrategy extends Strategy {
  constructor(options, verify) {
    if (typeof options === 'function') {
      verify = options;
      options = {};
    }
    if (!verify) { throw new TypeError('OAuth2ProxyStrategy requires a verify callback'); }

    super();

    this.name = 'oauth2-proxy';
    this._verify = verify;
    this._passReqToCallback = options.passReqToCallback;
  }

  authenticate(req) {
    const xUser = req.header('x-user');
    if (!xUser) {
      return this.fail({message: 'Missing credentials'});
    }

    const verified = (err, user, info) => {
      if (err) { return this.error(err); }
      if (!user) { return this.fail(info); }
      this.success(user, info);
    };

    try {
      if (this._passReqToCallback) {
        this._verify(req, xUser, verified);
      } else {
        this._verify(xUser, verified);
      }
    } catch (e) {
      return this.error(e);
    }
  }
}
