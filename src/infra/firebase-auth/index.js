import path from "path";
import {Passport} from "passport";
import {ExtractJwt} from "passport-jwt";
import Strategy from "./Strategy";
import * as firebase from "firebase-admin";

export default function({app, config, findUser, logger}) {
  const {firebaseAuth: firebaseAuthConfig} = config;
  if (!firebaseAuthConfig) {
    throw new Error("Missing firebaseAuthConfig section in config.");
  }

  const options = {
    credential: firebase.credential.cert(typeof firebaseAuthConfig.credential === 'string'
      ? require(path.resolve(firebaseAuthConfig.credential))
      : firebaseAuthConfig.credential),
    databaseURL: firebaseAuthConfig.databaseURL
  };
  firebase.initializeApp(options);

  const passport = new Passport();
  const opts = {
    jwtFromRequest: ExtractJwt.fromExtractors([
      ExtractJwt.fromAuthHeaderWithScheme('Bearer'),
      ExtractJwt.fromBodyField('access_token'),
      ExtractJwt.fromUrlQueryParameter('access_token')
    ])
  };
  passport.use(new Strategy(opts, async function(jwt, done) {
    try {
      const decodedIdToken = await firebase.auth().verifyIdToken(jwt);
      const user = await findUser({userId: decodedIdToken.uid});
      done(null, user || false);
    } catch (e) {
      logger.error("firebase authentication failed:", e.stack || e);
      done(null, false);
    }
  }));
  const authenticator = passport.authenticate('passthru-jwt', {session: false});
  const excludedPaths = firebaseAuthConfig.excludePaths || [];
  app.use(function(req, res, next) {
    if (excludedPaths.some(r => req.originalUrl.startsWith(r))) return next();
    return authenticator(req, res, next);
  });
}
