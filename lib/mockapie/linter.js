/******************************************************************************/
/*
 * This file is part of the package mockapie. It is subject to the
 * license terms in the LICENSE file found in the top-level directory
 * of this distribution and at git://pmade.com/mockapie/LICENSE. No
 * part of the mockapie package, including this file, may be copied,
 * modified, propagated, or distributed except according to the terms
 * contained in the LICENSE file.
*/

/******************************************************************************/
// Use the JSHint API to lint JavaScript files and report them back
// via Socket.IO.
module.exports = (function() {
  "use strict";

  /****************************************************************************/
  var jshint = require('jshint').JSHINT,
      path   = require('path'),
      fs     = require('fs'),
      db     = require('../mockapie/db');

  /****************************************************************************/
  var clientPath = '/client/linter.js',
      clientFile = require.resolve('../mockapie').replace(/\.js$/, clientPath),
      clientSrc  = fs.readFileSync(clientFile, 'utf-8');

  /****************************************************************************/
  // FIXME: Make this a configuration option.
  var ignore = [
    "jquery.js",
    "handlebars-v3.0.3.js",
    "ember-template-compiler.js",
    "ember.prod.js",
    "underscore-min.js",
    "backbone-min.js",
    "react-dom-0.14.7.min.js",
    "react-0.14.7.min.js",
    "babel.js",
    "angular.min.js",
    "mustache.min.js",
  ];

  /****************************************************************************/
  var testFile = function(dir, request, callback) {
    if (request.url.match(/\.js$/) && request.method === "GET") {
      var src  = path.join(dir, path.normalize(request.url)),
          base = path.basename(src);

      if (ignore.some(function(f) { return f === base; })) return;
      db.fileExists(src, function(bool) {if (bool) callback(src);});
    }
  };

  /******************************************************************************/
  var send = function(file, data, ws) {
    var messages = data.filter(function(msg) {
      return msg;
    }).map(function(msg) {
      return file + ":" + msg.line + " " + msg.reason;
    });

    setTimeout(function() {
      if (messages.length > 0) ws.broadcast(messages);
    }, 1200);
  };

  /****************************************************************************/
  var lint = function(request, ws, base) {
    testFile(base, request, function(src) {
      try {
        jshint(fs.readFileSync(src, 'utf-8'));
        send(src, jshint.errors, ws);
      } catch (e) {
        var msg = {line: 0, reason: e};
        send("internal", [msg], ws);
      }
    });
  };

  /****************************************************************************/
  var sendClientJS = function(response) {
    response.setHeader('Content-Type', 'application/javascript');
    response.writeHead(200);
    response.end(clientSrc);
  };

  /****************************************************************************/
  return {lint: lint, sendClientJS: sendClientJS};
})();
