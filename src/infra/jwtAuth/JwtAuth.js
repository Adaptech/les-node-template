import {createHmac} from "crypto";
import {fromBase64} from "base64url";

export default class JwtAuth {
  constructor(jwtConf, logger) {
    this._tokenTtlInSeconds = jwtConf.tokenTtlInSeconds || 3600;
    this._secret = jwtConf.secret;
    this._issuer = jwtConf.issuer || 'default';
    this._audience = jwtConf.audience || 'default';
    this._logger = logger;
  }

  _toBase64(obj) {
    return fromBase64(new Buffer(JSON.stringify(obj)).toString('base64'));
  }

  _hmacsha256(value, secret) {
    const hmac = createHmac('sha256', secret);
    hmac.update(value);
    return fromBase64(hmac.digest('base64'));
  }

  createToken(subject, refresh_token, extraProps) {
    const expires = parseInt(Date.now() / 1000) + this._tokenTtlInSeconds;
    const header = this._toBase64({alg: 'HS256', typ: "JWT"});
    const payload = this._toBase64({iss: this._issuer, exp: expires, sub: subject, aud: this._audience, ...extraProps});
    const signature = this._hmacsha256(header + '.' + payload, this._secret);
    const access_token = header + '.' + payload + '.' + signature;
    return {access_token, expires, refresh_token};
  }
}
