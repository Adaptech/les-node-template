import crypto from "crypto";
import {Passport} from "passport";
import {Strategy as JwtStrategy, ExtractJwt} from "passport-jwt";
import JwtAuth from "./JwtAuth";
import ModelDefinition from "../ModelDefinition";

const refreshTokenModel = {
  name: "refreshTokens",
  config: {
    key: "refreshToken",
    schema: {
      refreshToken: {type: "string", nullable: false},
      subject: {type: "string", nullable: false}
    }
  }
};

export default function bootstrap(services) {
  const {app, mapper, config, findUser, logger} = services;
  const {jwtAuth: jwtAuthConfig} = config;
  if (!jwtAuthConfig) {
    throw new Error('Missing jwtAuth section in config.');
  }
  const passport = new Passport();
  const opts = {
    jwtFromRequest: ExtractJwt.fromExtractors([
      ExtractJwt.fromAuthHeaderWithScheme('Bearer'),
      ExtractJwt.fromBodyField('access_token'),
      ExtractJwt.fromUrlQueryParameter('access_token')
    ]),
    secretOrKey: jwtAuthConfig.secret,
    issuer: jwtAuthConfig.issuer,
    audience: jwtAuthConfig.audience
  };
  passport.use(new JwtStrategy(opts, function(jwt_payload, done) {
    findUser({userId: jwt_payload.sub})
      .then(user => {
        if (user) {
          done(null, user);
        } else {
          done(null, false);
        }
      }, done);
  }));
  mapper.addModel(new ModelDefinition(refreshTokenModel, true, true));
  const jwtAuth = new JwtAuth(jwtAuthConfig, logger);
  async function getToken(req, res) {
    const {username, password} = req.body;
    try {
      if (!username) {
        return res.status(400).json({message: "Username is mandatory."});
      }
      if (!password) {
        return res.status(400).json({message: "Password is mandatory."});
      }
      const user = await findUser({username});
      if (!user) {
        return res.status(401).end();
      }
      const hash = crypto.createHash('sha256');
      hash.update(user.passwordSalt + password);
      if (user.passwordHash !== hash.digest("base64")) {
        return res.status(401).end();
      }
      const refresh_token = crypto.randomBytes(20).toString('base64');
      await mapper.insert(refreshTokenModel.name, {refreshToken: refresh_token, subject: user.userId});
      const token = jwtAuth.createToken(user.userId, refresh_token, {roles: user.roles});
      res.json(token);
    } catch (e) {
      logger.error("getToken failed", e);
      res.status(500).json({message: e.message});
    }
  }
  async function refreshToken(req, res) {
    const {refresh_token} = req.body;
    try {
      if (!refresh_token) {
        return res.status(400).json({message: "refresh_token is mandatory."});
      }
      const result = await mapper.select(refreshTokenModel.name, {limit: 1, where: {refresh_token}});
      if (result.total === 0) {
        return res.status(401).end();
      }
      const userId = result.results[0].subject;
      const user = await findUser({userId});
      if (!user) {
        return res.status(401).end();
      }
      const token = jwtAuth.createToken(user.userId, refresh_token, {roles: user.roles});
      res.json(token);
    } catch (e) {
      logger.error("refreshToken failed", e);
      res.status(500).json({message: e.message});
    }
  }
  app.post('/api/v1/auth/token', getToken);
  app.post('/api/v1/auth/refresh', refreshToken);
  const excludedPaths = jwtAuthConfig.excludePaths || [];
  const authenticator = passport.authenticate('jwt', {session: false});
  app.use(function(req, res, next) {
    if (excludedPaths.some(r => req.originalUrl.startsWith(r))) return next();
    return authenticator(req, res, next);
  });
}
