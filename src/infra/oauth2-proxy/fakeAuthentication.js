const logoutUrl = '/oauth2/sign_in';
const headerName = 'x-user';

export default function fakeAuthentication(xUser) {
  return (req, res, next) => {
    if (req.url.startsWith(logoutUrl)) return res.redirect('/');
    req.headers[headerName] = xUser;
    next();
  };
}
