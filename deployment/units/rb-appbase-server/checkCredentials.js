"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.getUserTokenFrom_UserToken1 = getUserTokenFrom_UserToken1;exports.getUserTokenFrom_machineAcuityUserToken3 = getUserTokenFrom_machineAcuityUserToken3;exports.getUserAndSessionIDByUserToken1_async = getUserAndSessionIDByUserToken1_async;exports.getUserAndSessionIDByUserToken3_async = getUserAndSessionIDByUserToken3_async;exports.getUserAndSessionIDByUserToken_async = getUserAndSessionIDByUserToken_async;exports.verifyUserToken2 = verifyUserToken2;exports.serveAuthenticationFailed = serveAuthenticationFailed;

var _path = _interopRequireDefault(require("path"));

var _jwtSimple = _interopRequireDefault(require("jwt-simple"));

var _defaultPersister = _interopRequireDefault(require("../_configuration/rb-base-server/graphql/defaultPersister"));
var _UserToken2ServerRendering = _interopRequireDefault(require("../_configuration/rb-base-server/UserToken2ServerRendering"));
var _log = _interopRequireDefault(require("../rb-base-server/log"));function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };} //  weak

// Read environment
require('dotenv').load();

const envHost = process.env.HOST;
if (envHost == null || typeof envHost !== 'string')
throw new Error(
'Error: rb-appbase-webapp requires the environment variable HOST to be set');


//

const staleAnonymousSessionRefreshDelay =
10 * // Minutes
60 * // Seconds in a minute
1000; // Milliseconds in a second

const maxAgeOfAnonymousSessionInSec =
3 * // Days
24 * // Hours in a day
60 * // Minutes in an hour
60; // Seconds in a minute

//

function getUserTokenFrom_UserToken1(req) {
  return req.cookies.UserToken1 || req.headers.usertoken1;
}

function getUserTokenFrom_machineAcuityUserToken3(req) {
  return req.cookies.machineAcuityUserToken3;
}

async function getUserAndSessionIDByUserToken1_async(
objectManager,
req,
bAllowAnonymous)
{
  const userToken = getUserTokenFrom_UserToken1(req);

  return await getUserAndSessionIDByUserToken_async(
  objectManager,
  req,
  bAllowAnonymous,
  userToken);

}

async function getUserAndSessionIDByUserToken3_async(
objectManager,
req,
bAllowAnonymous)
{
  const userToken = getUserTokenFrom_machineAcuityUserToken3(req);

  return await getUserAndSessionIDByUserToken_async(
  objectManager,
  req,
  bAllowAnonymous,
  userToken);

}

async function getUserAndSessionIDByUserToken_async(
objectManager,
req,
bAllowAnonymous,
userToken)
{
  // Retrieve session id from user token
  let session_id = null;
  if (userToken) {
    try {
      if (userToken.length > 10) {
        const decoded = _jwtSimple.default.decode(userToken, process.env.JWT_SECRET);
        session_id = _defaultPersister.default.uuidFromString(decoded.session_id);
      }
    } catch (err) {
      // Do nothing. This most probably means an expired session, or
      // new session secret. Either way the user is consindered not logged in
    }
  }

  // Track if an anonymous session (and user) need a TTL refresh
  let bAnonymousUserAndSessionRefresh = false;

  // Find the session
  let a_UserSession = null;
  if (session_id) {
    // Try to retrieve session. Notice that it may not be found in case that the
    // session got deleted from server
    a_UserSession = await objectManager.getOneObject_async('UserSession', {
      id: session_id,
      UserSession_artifact_id: objectManager.siteInformation.artifact_id,
      _materialized_view: 'UserSession_by_artifact_id_and_id' });


    // Session ID was present, but session was deleted from DB, or fraudulent
    if (!a_UserSession) {
      return null;
    }

    if (a_UserSession.UserSession_IsAnonymous) {
      const timeNow = new Date().getTime();

      const timeUserSession = a_UserSession.UserSession_modified_on.getTime();

      if (timeNow - timeUserSession > staleAnonymousSessionRefreshDelay) {
        bAnonymousUserAndSessionRefresh = true;
      }
    }
  }

  if (!bAllowAnonymous && !a_UserSession) return null;

  // If session is found, use User_id, otherwise use anonymous user id 0
  const user_id = a_UserSession ?
  a_UserSession.UserSession_User_id :
  _defaultPersister.default.uuidNull();

  // Retrieve user
  const a_User = await objectManager.getOneObject_async('User', {
    id: user_id,
    User_artifact_id: objectManager.siteInformation.artifact_id });


  // Has the user been found?
  if (a_User) {
    // Set the user id in object manager. Everyone will reffer to it
    objectManager.setViewerUserId(user_id);

    // If anonymous session, and refresh is needed, go ahead and refresh
    if (bAnonymousUserAndSessionRefresh) {
      // "Refresh" user and session with fresh TTL. Wait till its done just in case
      await Promise.all([
      objectManager.update(
      'User',
      Object.assign({}, a_User, { _ttl: maxAgeOfAnonymousSessionInSec })),

      objectManager.update(
      'UserSession',
      Object.assign({}, a_UserSession, {
        _ttl: maxAgeOfAnonymousSessionInSec }))]);



    }

    // Return both user and session
    return { User: a_User, UserSession: a_UserSession };
  } else {
    return null;
  }
}

function verifyUserToken2(
a_User,
req,
location)
{
  if (!a_User) {
    return { issue: 'User not found' };
  } else {
    const request_UserToken2 =
    location === 'headers' ? req.get('UserToken2') : req.query.UserToken2;
    if (
    request_UserToken2 === a_User.UserToken2 ||
    // A request coming from webapp will come from localhost and will bear the server's user token
    (req.ip === '127.0.0.1' || req.ip === envHost) &&
    request_UserToken2 === _UserToken2ServerRendering.default ||
    // For use with GraphiQL
    process.env.USER_TOKEN_2_BYPASS_IP === req.ip)

    return null;else

    return {
      issue: 'Authentication token expected',
      User_id: a_User.id,
      UserToken2: a_User.UserToken2,
      UserToken2FromRequest: request_UserToken2 };

  }
}

const httpError403FileName = _path.default.resolve(
__dirname,
'../_configuration/rb-base-server/httpError/403.html');


function serveAuthenticationFailed(req, res, err, respondWithJSON) {
  (0, _log.default)('warn', 'rb-appbase-server Checking credentials failed', {
    err,
    req,
    res });


  // Expire cookie. This is the only way to 'delete' a cookie
  res.cookie('UserToken1', '', { httpOnly: true, expires: new Date(1) });

  if (respondWithJSON) {
    res.status(403).send('{ "error": "Authentication Failed" }');
  } else {
    res.status(403).sendFile(httpError403FileName);
  }
}
//# sourceMappingURL=checkCredentials.js.map