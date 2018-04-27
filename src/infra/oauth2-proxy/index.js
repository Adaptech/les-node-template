import passport from "passport";
import Strategy from "./Strategy";
import fakeAuthentication from "./fakeAuthentication";

const fakeConfigName = 'x-user';

export default function({app, config, findUser}) {
  if (!app) {
    throw new Error('Missing parameter "app".');
  }
  if (!config) {
    throw new Error('Missing parameter "config".');
  }
  if (!findUser) {
    throw new Error('Missing parameter "findUser".');
  }

  if (process.env.NODE_ENV !== 'production' && config[fakeConfigName]) {
    app.use(fakeAuthentication(config[fakeConfigName]));
  }

  const verifyUser = async(userId, done) => {
    try {
      const user = await findUser({userId});
      done(null, user);
    } catch (e) {
      done(e);
    }
  };

  passport.use(new Strategy(verifyUser));
  app.use(passport.authenticate('oauth2-proxy', {session: false}));

  app.get('/logout', (req, res) => res.redirect("/oauth2/sign_in"));
}
