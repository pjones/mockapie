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
// Fake JSON RESTful service using YAML files.
module.exports = (function() {
  "use strict";

  /****************************************************************************/
  var db   = require('./db'),
      url  = require('url'),
      path = require('path');

  /****************************************************************************/
  var fileName = function(dir, collection) {
    return path.join(dir, path.normalize(collection) + ".yml");
  };

  /****************************************************************************/
  var badRoute = function(response, error) {
    var body = error === undefined ? "No such entity" : error.toString();

    response.writeHead(404, {
      "Content-Type":   "text/plain",
      "Content-Length": body.length,
    });

    response.end(body);
  };

  /****************************************************************************/
  var withRoute = function(request, response, prefix, dir, callback) {
    var path  = url.parse(request.url).pathname;
    var match = (new RegExp("^" + prefix + "([^/]+)(/(\\d+))?$")).exec(path);

    if (match) {
      var file = fileName(dir, match[1]);
      // FIXME: Send callback the collection name.
      callback(file, match[3] === undefined ? null : parseInt(match[3]));
    } else {
      badRoute(response, "invalid REST path");
    }
  };

  /****************************************************************************/
  var sendJSON = function(response, object, status) {
    var body = object === undefined ? "" : JSON.stringify(object);

    response.writeHead(status || 200, {
      "Content-Type":   "application/json",
      "Content-Length": body.length,
    });

    response.end(body);
  };

  /****************************************************************************/
  var readJSON = function(request, callback) {
    var json = "";

    request.on("data", function(d) {json += d.toString();});
    request.on("end",  function()  {callback(JSON.parse(json));});
  };

  /****************************************************************************/
  var dropBody = function(request, callback) {
    request.on("end", callback).resume();
  };

  /****************************************************************************/
  var get = function(response, file, id) {
    db.readFile(file, function(error, objects) {
      if (error) return badRoute(response, error);

      if (id) {
        var matches = objects.filter(function(e) {
          return e.hasOwnProperty("id") && e.id === id;
        });

        if (matches.length === 0) return badRoute(response, "invalid ID");
        sendJSON(response, matches[0]);
      } else {
        sendJSON(response, objects);
      }
    });
  };

  /****************************************************************************/
  var create = function(request, response, file) {
    readJSON(request, function(object) {
      if (Array.isArray(object)) return badRoute(response, "POST with array!");

      db.modifyFile(file, function(error, objects) {
        if (error) return badRoute(response, error);

        var maxID = objects.reduce(function(acc, elem) {
          if (elem.hasOwnProperty("id") && elem.id > acc) {
            return elem.id;
          } else {
            return acc;
          }
        }, 0);

        object.id = maxID + 1;
        objects.push(object);
        sendJSON(response, object, 201); // FIXME: Send Location header.
        return objects;
      });
    });
  };

  /****************************************************************************/
  var update = function(request, response, file, id) {
    readJSON(request, function(object) {
      if (Array.isArray(object)) return badRoute(response, "PUT/PATCH with array!");

      db.modifyFile(file, function(error, objects) {
        if (error) return badRoute(response, error);
        var found = false;

        var updated = objects.map(function(e) {
          if (e.hasOwnProperty("id") && e.id === id) {
            object.id = id;
            found = true;
            return object;
          } else {
            return e;
          }
        });

        sendJSON(response, undefined, found ? 204 : 404);
        return updated;
      });
    });
  };

  /****************************************************************************/
  var destroy = function(response, file, id) {
    db.modifyFile(file, function(error, objects) {
      if (error) return badRoute(response, error);

      var updated = objects.filter(function(e) {
        return e.hasOwnProperty("id") && e.id !== id;
      });

      var found = updated.length !== objects.length;
      sendJSON(response, undefined, found ? 204 : 404);

      return updated;
    });
  };

  /****************************************************************************/
  var route = function(request, response, prefix, dir) {
    withRoute(request, response, prefix, dir, function(file, id) {
      switch (request.method) {
      case "GET":
        dropBody(request, function() {get(response, file, id);});
        break;

      case "POST":
        if (id !== null) return badRoute(response, "POST must not have an ID");
        create(request, response, file);
        break;

      case "PATCH":
      case "PUT":
        if (id === null) return badRoute(response, "PUT must have an ID");
        update(request, response, file, id);
        break;

      case "DELETE":
        if (id === null) return badRoute(response, "DELETE must have an ID");
        dropBody(request, function() {destroy(response, file, id);});
        break;

      default:
        return badRoute(response, "invalid REST method");
      }
    });
  };

  /****************************************************************************/
  return {
    route: route,
  };
})();
