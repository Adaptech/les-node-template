import Strategy from "passport-strategy";

export default class PassthruJwtStrategy extends Strategy {
  constructor(options, verify) {
    if (typeof options === 'function') {
      verify = options;
      options = {};
    }
    if (!verify) { throw new TypeError('PassthruJwtStrategy requires a verify callback'); }

    super();

    this.name = 'passthru-jwt';
    this._verify = verify;
    this._passReqToCallback = options.passReqToCallback;
    this._jwtFromRequest = options.jwtFromRequest;
  }

  authenticate(req) {
    const jwt = this._jwtFromRequest(req);
    if (!jwt) return this.fail();

    const verified = (err, user, info) => {
      if (err) { return this.error(err); }
      if (!user) { return this.fail(info); }
      this.success(user, info);
    };

    try {
      if (this._passReqToCallback) {
        this._verify(req, jwt, verified);
      } else {
        this._verify(jwt, verified);
      }
    } catch (e) {
      return this.error(e);
    }
  }
}
