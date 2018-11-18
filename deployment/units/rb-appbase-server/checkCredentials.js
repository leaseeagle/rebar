"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.getSessionIdFromRequest = getSessionIdFromRequest;exports.getUserAndSessionIDByUserToken1_async = getUserAndSessionIDByUserToken1_async;exports.verifyUserToken2 = verifyUserToken2;exports.serveAuthenticationFailed = serveAuthenticationFailed;

var _path = _interopRequireDefault(require("path"));

var _jwtSimple = _interopRequireDefault(require("jwt-simple"));

var _defaultPersister = _interopRequireDefault(require("../_configuration/rb-base-server/graphql/defaultPersister"));
var _UserToken2ServerRendering = _interopRequireDefault(require("../_configuration/rb-base-server/UserToken2ServerRendering"));
var _log = _interopRequireDefault(require("../rb-base-server/log"));function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };} //  weak

// Read environment
require('dotenv').load();

const envHost = process.env.HOST;
if (envHost == null || typeof envHost !== 'string')
throw new Error('Error: rb-appbase-webapp requires the environment variable HOST to be set');

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

function getSessionIdFromRequest(req) {
  const UserToken1 = req.cookies.UserToken1 || req.headers.usertoken1;

  if (UserToken1) {
    try {
      if (UserToken1.length > 10) {
        const decoded = _jwtSimple.default.decode(UserToken1, process.env.JWT_SECRET);
        return _defaultPersister.default.uuidFromString(decoded.session_id);
      }
    } catch (err) {
      // Do nothing. This most probably means an expired session, or
      // new session secret. Either way the user is consindered not logged in
    }
  }

  return null; // Anonymous, unless cookie is passed
}

async function getUserAndSessionIDByUserToken1_async(
objectManager,
req,
bAllowAnonymous)
{
  // Get session, and if session is present, user from session
  const session_id = getSessionIdFromRequest(req);

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
  const user_id = a_UserSession ? a_UserSession.UserSession_User_id : _defaultPersister.default.uuidNull();

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
      Object.assign({}, a_UserSession, { _ttl: maxAgeOfAnonymousSessionInSec }))]);


    }

    // Return both user and session
    return { User: a_User, UserSession: a_UserSession };
  } else {
    return null;
  }
}

function verifyUserToken2(a_User, req) {
  if (!a_User) {
    return 'User not found';
  } else {
    const request_UserToken2 = req.get('UserToken2');
    if (
    request_UserToken2 === a_User.UserToken2 ||
    // A request coming from webapp will come from localhost and will bear the server's user token
    (req.ip === '127.0.0.1' || req.ip === envHost) &&
    request_UserToken2 === _UserToken2ServerRendering.default ||
    // For use with GraphiQL
    process.env.USER_TOKEN_2_BYPASS_IP === req.ip)

    return null;else

    return (
      'Authentication token expected: ' + a_User.UserToken2 + ', provided:' + request_UserToken2);

  }
}

const httpError403FileName = _path.default.resolve(
__dirname,
'../_configuration/rb-base-server/httpError/403.html');


function serveAuthenticationFailed(req, res, err, respondWithJSON) {
  (0, _log.default)('warn', 'rb-appbase-server Checking credentials failed', { err, req, res });

  // Expire cookie. This is the only way to 'delete' a cookie
  res.cookie('UserToken1', '', { httpOnly: true, expires: new Date(1) });

  if (respondWithJSON) {
    res.status(403).send('{ "error": "Authentication Failed" }');
  } else {
    res.status(403).sendFile(httpError403FileName);
  }
}
//# sourceMappingURL=checkCredentials.js.map